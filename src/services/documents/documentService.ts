import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type DocumentRow = Database['public']['Tables']['documents']['Row'];

const STORAGE_BUCKET = 'bhoomi-documents';
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const documentService = {
  validateFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return 'Only PDF, JPG, and PNG files are allowed.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must not exceed 25 MB.';
    }
    return null;
  },

  sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
  },

  buildStoragePath(districtId: string, recordId: string | null, docId: string, filename: string) {
    const safe = this.sanitizeFilename(filename);
    return recordId
      ? 'documents/' + districtId + '/' + recordId + '/' + docId + '/' + safe
      : 'documents/' + districtId + '/unlinked/' + docId + '/' + safe;
  },

  async uploadDocument(
    file: File,
    metadata: { district_id?: string; state_id?: string; village_id?: string; land_record_id?: string; document_type: string; uploaded_by: string }
  ) {
    const validationError = this.validateFile(file);
    if (validationError) throw { name: 'AppError', message: validationError };

    const docId = crypto.randomUUID();
    const storagePath = this.buildStoragePath(
      metadata.district_id ?? 'unscoped',
      metadata.land_record_id ?? null,
      docId,
      file.name
    );

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadError) throw toAppError(uploadError as any);

    const insertPayload = {
      id: docId,
      land_record_id: metadata.land_record_id ?? null,
      document_type: metadata.document_type,
      original_filename: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      state_id: metadata.state_id ?? null,
      district_id: metadata.district_id ?? null,
      processing_status: 'PENDING',
      uploaded_by: metadata.uploaded_by,
    };

    const { data, error: dbError } = await supabase
      .from('documents')
      .insert(insertPayload as any)
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      throw toAppError(dbError);
    }

    return data as DocumentRow;
  },

  async getSignedUrl(storagePath: string, expiresInSeconds = 3600) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error) throw toAppError(error as any);
    return data.signedUrl;
  },

  async getDocuments(filters: { land_record_id?: string; district_id?: string; processing_status?: string } = {}) {
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (filters.land_record_id) query = query.eq('land_record_id', filters.land_record_id);
    if (filters.district_id) query = query.eq('district_id', filters.district_id);
    if (filters.processing_status) query = query.eq('processing_status', filters.processing_status);
    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data ?? []) as DocumentRow[];
  },
};
