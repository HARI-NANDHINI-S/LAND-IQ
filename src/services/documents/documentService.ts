import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';
import { buildIlikeOrFilter } from '@/utils/postgrestSearch';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];

const STORAGE_BUCKET = 'bhoomi-documents';
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export interface DocumentFilters {
  land_record_id?: string;
  district_id?: string;
  processing_status?: string;
  verification_status?: string;
  document_type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const documentService = {
  async validateFile(file: File): Promise<string | null> {
    const mimeType = file.type || '';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return 'Only PDF, JPG, JPEG, and PNG files are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must not exceed 25 MB.';
    }

    const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isPdf = mimeType === 'application/pdf'
      && signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46 && signature[4] === 0x2d;
    const isPng = mimeType === 'image/png'
      && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => signature[index] === byte);
    const isJpeg = (mimeType === 'image/jpeg' || mimeType === 'image/jpg')
      && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
    if (!isPdf && !isPng && !isJpeg) {
      return 'The file contents do not match a supported PDF, JPG, JPEG, or PNG format.';
    }
    return null;
  },

  sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
  },

  buildStoragePath(districtId: string, recordId: string | null, docId: string, filename: string) {
    const safe = this.sanitizeFilename(filename);
    const base = districtId && districtId !== 'unscoped' ? `documents/${districtId}` : 'documents/unscoped';
    return recordId ? `${base}/${recordId}/${docId}/${safe}` : `${base}/unlinked/${docId}/${safe}`;
  },

  async uploadDocument(
    file: File,
    metadata: {
      district_id?: string | null;
      state_id?: string | null;
      village_id?: string | null;
      land_record_id?: string | null;
      document_type: string;
    }
  ) {
    const validationError = await this.validateFile(file);
    if (validationError) {
      throw { name: 'AppError', message: validationError };
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw toAppError(authError);
    if (!authData.user) throw new Error('Sign in to upload documents.');

    const docId = crypto.randomUUID();
    const storagePath = this.buildStoragePath(
      metadata.district_id ?? 'unscoped',
      metadata.land_record_id ?? null,
      docId,
      file.name
    );

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      throw toAppError(uploadError as any);
    }

    const insertPayload = {
      id: docId,
      land_record_id: metadata.land_record_id ?? null,
      document_type: metadata.document_type,
      original_filename: file.name,
      storage_path: storagePath,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      state_id: metadata.state_id ?? null,
      district_id: metadata.district_id ?? null,
      village_id: metadata.village_id ?? null,
      processing_status: 'PENDING',
      verification_status: 'PENDING',
      uploaded_by: authData.user.id,
    };

    const { data, error: dbError } = await supabase
      .from('documents')
      .insert(insertPayload as any)
      .select()
      .single();

    if (dbError) {
      const { error: cleanupError } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      if (cleanupError) {
        throw new Error('Document metadata could not be saved, and the uploaded file could not be removed. Contact an administrator.');
      }
      throw toAppError(dbError);
    }

    return data as DocumentRow;
  },

  async getDocument(id: string) {
    const { data, error } = await supabase
      .from('documents')
      .select('*, land_records(id, record_number, survey_number, districts(name), villages(name), taluks(name)), profiles!uploaded_by(full_name, email)')
      .eq('id', id)
      .single();

    if (error) throw toAppError(error);
    return data as DocumentRow & {
      land_records?: { id: string; record_number: string; survey_number: string; districts?: { name: string | null } | null; villages?: { name: string | null } | null; taluks?: { name: string | null } | null } | null;
      profiles?: { full_name: string | null; email: string | null } | null;
    };
  },

  async getDocuments(filters: DocumentFilters = {}) {
    const {
      land_record_id,
      district_id,
      processing_status,
      verification_status,
      document_type,
      search,
      page = 1,
      pageSize = 10,
    } = filters;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('documents')
      .select('*, land_records(id, record_number, survey_number), profiles!uploaded_by(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (land_record_id) query = query.eq('land_record_id', land_record_id);
    if (district_id) query = query.eq('district_id', district_id);
    if (processing_status) query = query.eq('processing_status', processing_status);
    if (verification_status) query = query.eq('verification_status', verification_status);
    if (document_type) query = query.eq('document_type', document_type);
    if (search) {
      query = query.or(buildIlikeOrFilter(['original_filename', 'document_type'], search));
    }

    const { data, error, count } = await query;
    if (error) throw toAppError(error);

    return {
      data: (data ?? []) as Array<DocumentRow & {
        land_records?: { id: string; record_number: string; survey_number: string } | null;
        profiles?: { full_name: string | null } | null;
      }>,
      total: count ?? 0,
    };
  },

  async getSignedUrl(storagePath: string, expiresInSeconds = 3600) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) throw toAppError(error as any);
    return data.signedUrl;
  },

  async processDocument(documentId: string): Promise<{ processed_pages: number; provider: string }> {
    const { data, error } = await supabase.functions.invoke('process-document', {
      body: { document_id: documentId },
    });
    if (error) throw toAppError(error as any);
    if (data?.error) throw new Error(String(data.error));
    return data as { processed_pages: number; provider: string };
  },

  async getExtractedFields(documentId: string) {
    const { data, error } = await supabase
      .from('extracted_fields')
      .select('*, document_pages(page_number, extraction_provider)')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    if (error) throw toAppError(error);
    return data ?? [];
  },

  async getDocumentPages(documentId: string) {
    const { data, error } = await supabase
      .from('document_pages')
      .select('id, page_number, ocr_status, extracted_text, extraction_provider, processing_error, attempt_count')
      .eq('document_id', documentId)
      .order('page_number', { ascending: true });
    if (error) throw toAppError(error);
    return data ?? [];
  },

  async verifyExtractedField(fieldId: string, verifiedValue: string) {
    const { data, error } = await supabase.rpc('verify_extracted_field', {
      p_field_id: fieldId,
      p_verified_value: verifiedValue,
    });
    if (error) throw toAppError(error);
    return data;
  },

  async deleteDocument(id: string) {
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, storage_path, land_record_id, original_filename, document_type')
      .eq('id', id)
      .single();

    if (docError) throw toAppError(docError);

    const { error: deleteError } = await supabase.from('documents').delete().eq('id', id);
    if (deleteError) throw toAppError(deleteError);

    if (doc?.storage_path) {
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
      if (storageError) {
        throw new Error('Document metadata was deleted, but its storage file could not be removed. Contact an administrator.');
      }
    }

    return { id: doc.id, land_record_id: doc.land_record_id };
  },
};
