import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OcrField {
  name: string;
  value: string | number | boolean;
  normalized_value?: string | null;
  confidence?: number | null;
}

interface OcrPage {
  page_number: number;
  text: string;
  fields?: OcrField[];
  width?: number | null;
  height?: number | null;
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return jsonResponse({ error: 'An authenticated user session is required.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase function configuration is incomplete. A service role key is required for trusted OCR result persistence.' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const processingClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return jsonResponse({ error: 'The authenticated session is invalid.' }, 401);

  let documentId: string;
  try {
    const body = await request.json();
    documentId = typeof body.document_id === 'string' ? body.document_id : '';
  } catch {
    return jsonResponse({ error: 'A valid document_id is required.' }, 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
    return jsonResponse({ error: 'A valid document_id is required.' }, 400);
  }

  const { data: documentRows, error: beginError } = await userClient.rpc('begin_document_processing', {
    p_document_id: documentId,
  });
  if (beginError) return jsonResponse({ error: beginError.message }, 403);
  const document = Array.isArray(documentRows) ? documentRows[0] : null;
  if (!document?.storage_path) return jsonResponse({ error: 'The document storage path is unavailable.' }, 404);

  const markFailed = async (message: string) => {
    const { error } = await processingClient.rpc('fail_document_processing', {
      p_document_id: documentId,
      p_error: message,
      p_actor_id: authData.user.id,
    });
    if (error) console.error('Unable to record OCR failure state:', error.message);
  };

  const providerUrl = Deno.env.get('OCR_PROVIDER_URL');
  const providerKey = Deno.env.get('OCR_PROVIDER_API_KEY');
  if (!providerUrl || !providerKey) {
    const message = 'OCR provider is not configured. Set OCR_PROVIDER_URL and OCR_PROVIDER_API_KEY in Supabase Edge Function secrets.';
    await markFailed(message);
    return jsonResponse({ error: message, code: 'OCR_PROVIDER_NOT_CONFIGURED' }, 503);
  }

  let provider: URL;
  try {
    provider = new URL(providerUrl);
    if (provider.protocol !== 'https:') throw new Error('HTTPS is required.');
  } catch {
    const message = 'OCR provider configuration is invalid; OCR_PROVIDER_URL must be an HTTPS endpoint.';
    await markFailed(message);
    return jsonResponse({ error: message, code: 'OCR_PROVIDER_CONFIGURATION_INVALID' }, 503);
  }

  const { data: signedFile, error: signedUrlError } = await userClient.storage
    .from('bhoomi-documents')
    .createSignedUrl(document.storage_path, 300);
  if (signedUrlError || !signedFile?.signedUrl) {
    const message = 'The document could not be opened through the current storage permissions.';
    await markFailed(message);
    return jsonResponse({ error: message }, 403);
  }

  try {
    const providerResponse = await fetch(provider, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_id: documentId,
        document_url: signedFile.signedUrl,
        mime_type: document.mime_type,
        response_format: 'land-iq-ocr-v1',
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!providerResponse.ok) {
      const message = `OCR provider request failed with HTTP ${providerResponse.status}.`;
      await markFailed(message);
      return jsonResponse({ error: message }, 502);
    }

    const result = await providerResponse.json();
    const pages = result?.pages as OcrPage[] | undefined;
    if (!Array.isArray(pages) || pages.length < 1 || pages.length > 2000) {
      throw new Error('OCR provider response did not contain a valid pages array.');
    }
    for (const page of pages) {
      if (!Number.isInteger(page.page_number) || page.page_number < 1 || typeof page.text !== 'string' ||
          (page.fields !== undefined && !Array.isArray(page.fields))) {
        throw new Error('OCR provider returned an invalid page result.');
      }
      for (const field of page.fields ?? []) {
        if (typeof field.name !== 'string' || !field.name.trim() || field.name.length > 100 ||
            !['string', 'number', 'boolean'].includes(typeof field.value) ||
            (field.confidence != null && (!Number.isFinite(field.confidence) || field.confidence < 0 || field.confidence > 100))) {
          throw new Error('OCR provider returned an invalid field result.');
        }
      }
    }

    const providerName = Deno.env.get('OCR_PROVIDER_NAME') || provider.hostname;
    const { data: pageCount, error: completeError } = await processingClient.rpc('complete_document_processing', {
      p_document_id: documentId,
      p_provider: providerName,
      p_pages: pages,
      p_actor_id: authData.user.id,
    });
    if (completeError) throw new Error('OCR results could not be persisted within the current database permissions.');

    return jsonResponse({ processed_pages: pageCount, provider: providerName }, 200);
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'OCR provider timed out. Retry processing when the provider is available.'
      : error instanceof Error
        ? error.message
        : 'OCR processing failed.';
    await markFailed(message);
    return jsonResponse({ error: message }, 502);
  }
});