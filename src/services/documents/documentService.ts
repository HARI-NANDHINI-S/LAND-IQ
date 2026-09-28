import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

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
  validateFile(file: File): string | null {
    const mimeType = file.type || '';
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return 'Only PDF, JPG, JPEG, and PNG files are allowed.';
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
      uploaded_by: string;
    }
  ) {
    const validationError = this.validateFile(file);
    if (validationError) {
      throw { name: 'AppError', message: validationError };
    }

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
      query = query.or(
        'original_filename.ilike.%' + search + '%,document_type.ilike.%' + search + '%'
      );
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

  async deleteDocument(id: string) {
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', id)
      .single();

    if (docError) throw toAppError(docError);

    const { error: deleteError } = await supabase.from('documents').delete().eq('id', id);
    if (deleteError) throw toAppError(deleteError);

    if (doc?.storage_path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);
    }

    return true;
  },
};
