import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

export type BhoomiVoiceSession = Database['public']['Tables']['bhoomivoice_sessions']['Row'];
export type BhoomiVoiceMessage = Database['public']['Tables']['bhoomivoice_messages']['Row'];

const getAuthenticatedUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to use BhoomiVoice session history.');
  return data.user.id;
};

export interface BhoomiVoiceItem {
  title: string;
  subtitle?: string;
  href?: string;
  meta?: string[];
}

export interface BhoomiVoiceResult {
  intent: string;
  status: 'success' | 'unsupported' | 'error';
  answer: string;
  summary?: string;
  count?: number;
  items?: BhoomiVoiceItem[];
  error?: string;
}

export const bhoomiVoiceService = {
  async createSession(language = 'en'): Promise<BhoomiVoiceSession> {
    const userId = await getAuthenticatedUserId();
    const insert: Database['public']['Tables']['bhoomivoice_sessions']['Insert'] = { user_id: userId, language };
    const { data, error } = await supabase
      .from('bhoomivoice_sessions')
      .insert(insert)
      .select('*')
      .single();

    if (error) throw error;
    return data as BhoomiVoiceSession;
  },

  async listSessions(): Promise<BhoomiVoiceSession[]> {
    await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from('bhoomivoice_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data as BhoomiVoiceSession[];
  },

  async loadMessages(sessionId: string): Promise<BhoomiVoiceMessage[]> {
    await getAuthenticatedUserId();
    const { data, error } = await supabase
      .from('bhoomivoice_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as BhoomiVoiceMessage[];
  },

  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    responseType: string | null = 'text',
    metadata: Json | null = null,
  ): Promise<BhoomiVoiceMessage> {
    await getAuthenticatedUserId();
    const { error: sessionError } = await supabase
      .from('bhoomivoice_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (sessionError) throw sessionError;

    const insert: Database['public']['Tables']['bhoomivoice_messages']['Insert'] = {
      session_id: sessionId,
      role,
      content,
      response_type: responseType,
      metadata,
    };
    const { data, error } = await supabase
      .from('bhoomivoice_messages')
      .insert(insert)
      .select('*')
      .single();

    if (error) throw error;
    return data as BhoomiVoiceMessage;
  },

  async deleteSession(sessionId: string): Promise<void> {
    await getAuthenticatedUserId();
    const { error } = await supabase
      .from('bhoomivoice_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  },

  async ask(
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ): Promise<BhoomiVoiceResult> {
    const { data, error } = await supabase.functions.invoke('bhoomivoice-chat', {
      body: { question, history },
    });
    if (error) {
      if (error instanceof FunctionsHttpError && error.context instanceof Response) {
        const responseText = await error.context.clone().text();
        let responseBody: unknown = null;
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = null;
        }
        if (responseBody && typeof responseBody === 'object' &&
            'error' in responseBody && typeof responseBody.error === 'string') {
          throw new Error(responseBody.error);
        }
      }
      throw new Error(error.message || 'BhoomiVoice model request failed.');
    }
    if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
      throw new Error('BhoomiVoice returned an invalid model response.');
    }
    return {
      intent: 'model',
      status: 'success',
      answer: data.answer,
    };
  },
};
