export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ---- Enums ----
export type RecordStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';
export type ProcessingStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'OCR_PROCESSING' | 'EXTRACTION' | 'VALIDATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
export type AlertType = 'RISK_ALERT' | 'CRITICAL_CHANGE' | 'DUPLICATE_ALERT' | 'VERIFICATION_ALERT' | 'WATCHLIST_UPDATE' | 'SYSTEM_ALERT';
export type DuplicateStatus = 'PENDING' | 'UNDER_REVIEW' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'LEGITIMATE_SUBDIVISION' | 'DISPUTED';
export type ChangePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type VerificationTaskStatus = 'QUEUED' | 'ASSIGNED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';
export type WatchlistStatus = 'ACTIVE' | 'RESOLVED';
export type ExtractionMethod = 'OCR' | 'RULE_ENGINE' | 'ML_MODEL' | 'HUMAN_CORRECTION' | 'SEEDED';

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: { id: string; code: string; name: string; description: string | null; created_at: string }
        Insert: { id?: string; code: string; name: string; description?: string | null }
        Update: { name?: string; description?: string | null }
      }
      permissions: {
        Row: { id: string; code: string; description: string | null; created_at: string }
        Insert: { id?: string; code: string; description?: string | null }
        Update: { description?: string | null }
      }
      role_permissions: {
        Row: { role_id: string; permission_id: string; created_at: string }
        Insert: { role_id: string; permission_id: string }
        Update: never
      }
      settings: {
        Row: { key: string; value: any; description: string | null; is_public: boolean; updated_at: string; updated_by: string | null }
        Insert: { key: string; value?: any; description?: string | null; is_public?: boolean; updated_at?: string; updated_by?: string | null }
        Update: { key?: string; value?: any; description?: string | null; is_public?: boolean; updated_at?: string; updated_by?: string | null }
      }
      states: {
        Row: { id: string; name: string; code: string; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; code: string; is_active?: boolean }
        Update: { name?: string; code?: string; is_active?: boolean }
      }
      districts: {
        Row: { id: string; state_id: string; name: string; code: string; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; state_id: string; name: string; code: string; is_active?: boolean }
        Update: { name?: string; is_active?: boolean }
      }
      taluks: {
        Row: { id: string; district_id: string; name: string; code: string; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; district_id: string; name: string; code: string; is_active?: boolean }
        Update: { name?: string; is_active?: boolean }
      }
      villages: {
        Row: { id: string; taluk_id: string; name: string; code: string; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; taluk_id: string; name: string; code: string; is_active?: boolean }
        Update: { name?: string; is_active?: boolean }
      }
      profiles: {
        Row: {
          id: string; full_name: string; email: string; phone: string | null; avatar_url: string | null;
          role_id: string | null; state_id: string | null; district_id: string | null; village_id: string | null;
          employee_code: string | null; designation: string | null; is_active: boolean;
          created_at: string; updated_at: string;
        }
        Insert: { id: string; full_name: string; email: string; role_id?: string | null; state_id?: string | null; district_id?: string | null }
        Update: { full_name?: string; phone?: string | null; avatar_url?: string | null; employee_code?: string | null; designation?: string | null }
      }
      land_records: {
        Row: {
          id: string; record_number: string; survey_number: string; subdivision_number: string | null;
          patta_number: string | null; state_id: string | null; district_id: string | null;
          taluk_id: string | null; village_id: string | null; land_area: number | null;
          land_area_unit: string | null; land_classification: string | null; land_type: string | null;
          record_status: string; registration_number: string | null; registration_date: string | null;
          remarks: string | null; verification_status: string;
          created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
        }
        Insert: {
          id?: string; record_number: string; survey_number: string; subdivision_number?: string | null;
          patta_number?: string | null; state_id?: string | null; district_id?: string | null;
          taluk_id?: string | null; village_id?: string | null; land_area?: number | null;
          land_area_unit?: string | null; land_classification?: string | null; land_type?: string | null;
          record_status?: string; registration_number?: string | null; remarks?: string | null;
          verification_status?: string; created_by?: string | null;
        }
        Update: {
          survey_number?: string; patta_number?: string | null; land_area?: number | null;
          record_status?: string; verification_status?: string; updated_by?: string | null;
        }
      }
      land_owners: {
        Row: { id: string; full_name: string; identification_reference: string | null; contact_reference: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; full_name: string; identification_reference?: string | null; contact_reference?: string | null }
        Update: { full_name?: string }
      }
      land_record_owners: {
        Row: { id: string; land_record_id: string; owner_id: string; ownership_percentage: number | null; ownership_type: string | null; is_primary: boolean | null; effective_from: string | null; effective_to: string | null; created_at: string; updated_at: string }
        Insert: { land_record_id: string; owner_id: string; ownership_percentage?: number | null; ownership_type?: string | null; is_primary?: boolean | null; effective_from?: string | null }
        Update: { ownership_percentage?: number | null; is_primary?: boolean | null; effective_to?: string | null }
      }
      documents: {
        Row: {
          id: string; land_record_id: string | null; document_type: string; original_filename: string;
          storage_path: string; mime_type: string | null; file_size: number | null; sha256: string | null;
          document_year: number | null; state_id: string | null; district_id: string | null;
          village_id: string | null; processing_status: string; verification_status: string;
          uploaded_by: string | null; created_at: string; updated_at: string;
        }
        Insert: {
          id?: string; land_record_id?: string | null; document_type: string; original_filename: string;
          storage_path: string; mime_type?: string | null; file_size?: number | null; sha256?: string | null;
          document_year?: number | null; state_id?: string | null; district_id?: string | null;
          village_id?: string | null; processing_status?: string; uploaded_by?: string | null;
        }
        Update: { processing_status?: string; verification_status?: string; land_record_id?: string | null }
      }
      document_pages: {
        Row: { id: string; document_id: string; page_number: number; storage_path: string | null; width: number | null; height: number | null; ocr_status: string | null; created_at: string; updated_at: string }
        Insert: { document_id: string; page_number: number; storage_path?: string | null; ocr_status?: string | null }
        Update: { ocr_status?: string | null; storage_path?: string | null }
      }
      extracted_fields: {
        Row: { id: string; document_id: string; land_record_id: string | null; field_name: string; field_value: string | null; normalized_value: string | null; confidence_score: number | null; source_page_id: string | null; extraction_method: string | null; validation_status: string | null; verified_value: string | null; verified_by: string | null; verified_at: string | null; created_at: string; updated_at: string }
        Insert: { document_id: string; field_name: string; field_value?: string | null; confidence_score?: number | null; extraction_method?: string | null; validation_status?: string | null }
        Update: { verified_value?: string | null; verified_by?: string | null; verified_at?: string | null; validation_status?: string | null }
      }
      verification_tasks: {
        Row: { id: string; document_id: string; land_record_id: string | null; assigned_to: string | null; status: string; priority: string | null; due_at: string | null; started_at: string | null; completed_at: string | null; created_at: string; updated_at: string }
        Insert: { document_id: string; land_record_id?: string | null; assigned_to?: string | null; status?: string; priority?: string | null }
        Update: { status?: string; assigned_to?: string | null; started_at?: string | null; completed_at?: string | null }
      }
      verification_actions: {
        Row: { id: string; verification_task_id: string; actor_id: string | null; action: string; field_name: string | null; old_value: string | null; new_value: string | null; comment: string | null; created_at: string }
        Insert: { verification_task_id: string; actor_id?: string | null; action: string; field_name?: string | null; old_value?: string | null; new_value?: string | null; comment?: string | null }
        Update: never
      }
      duplicate_candidates: {
        Row: { id: string; record_a_id: string; record_b_id: string; similarity_score: number | null; match_signals: Json | null; status: string; reviewed_by: string | null; reviewed_at: string | null; resolution_notes: string | null; created_at: string; updated_at: string }
        Insert: { record_a_id: string; record_b_id: string; similarity_score?: number | null; match_signals?: Json | null; status?: string }
        Update: { status?: string; reviewed_by?: string | null; reviewed_at?: string | null; resolution_notes?: string | null }
      }
      risk_assessments: {
        Row: { id: string; land_record_id: string; risk_score: number | null; risk_level: string | null; status: string | null; calculated_at: string; calculation_version: string | null; created_at: string; updated_at: string }
        Insert: { land_record_id: string; risk_score?: number | null; risk_level?: string | null; status?: string | null; calculation_version?: string | null }
        Update: { risk_score?: number | null; risk_level?: string | null; status?: string | null }
      }
      risk_signals: {
        Row: { id: string; risk_assessment_id: string; signal_type: string; description: string | null; contribution: number | null; evidence: Json | null; created_at: string }
        Insert: { risk_assessment_id: string; signal_type: string; description?: string | null; contribution?: number | null; evidence?: Json | null }
        Update: never
      }
      record_changes: {
        Row: { id: string; land_record_id: string; entity_type: string; entity_id: string; field_name: string; old_value: string | null; new_value: string | null; change_priority: string | null; changed_by: string | null; changed_at: string; reason: string | null; created_at: string }
        Insert: { land_record_id: string; entity_type: string; entity_id: string; field_name: string; old_value?: string | null; new_value?: string | null; change_priority?: string | null; changed_by?: string | null; reason?: string | null }
        Update: never
      }
      watchlists: {
        Row: { id: string; land_record_id: string; user_id: string; reason: string | null; status: string; created_at: string; updated_at: string }
        Insert: { land_record_id: string; user_id: string; reason?: string | null; status?: string }
        Update: { status?: string; reason?: string | null }
      }
      alerts: {
        Row: { id: string; land_record_id: string | null; alert_type: string; priority: string; title: string; description: string | null; status: string; assigned_to: string | null; created_by: string | null; acknowledged_at: string | null; resolved_at: string | null; created_at: string; updated_at: string }
        Insert: { land_record_id?: string | null; alert_type: string; priority?: string; title: string; description?: string | null; status?: string; created_by?: string | null }
        Update: { status?: string; assigned_to?: string | null; acknowledged_at?: string | null; resolved_at?: string | null }
      }
      notifications: {
        Row: { id: string; user_id: string; notification_type: string; title: string; message: string; entity_type: string | null; entity_id: string | null; is_read: boolean; read_at: string | null; created_at: string }
        Insert: { user_id: string; notification_type: string; title: string; message: string; entity_type?: string | null; entity_id?: string | null }
        Update: { is_read?: boolean; read_at?: string | null }
      }
      audit_logs: {
        Row: { id: string; actor_id: string | null; actor_role: string | null; actor_email: string | null; action: string; entity_type: string; entity_id: string | null; before_state: Json | null; after_state: Json | null; ip_address: string | null; user_agent: string | null; request_id: string | null; correlation_id: string | null; metadata: Json | null; status: string | null; remarks: string | null; created_at: string }
        Insert: { actor_id?: string | null; actor_role?: string | null; actor_email?: string | null; action: string; entity_type: string; entity_id?: string | null; before_state?: Json | null; after_state?: Json | null; metadata?: Json | null; status?: string | null; remarks?: string | null; correlation_id?: string | null }
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: {
      admin_update_profile_authorization: {
        Args: {
          p_profile_id: string
          p_role_id?: string | null
          p_state_id?: string | null
          p_district_id?: string | null
          p_village_id?: string | null
          p_is_active?: boolean | null
        }
        Returns: Database['public']['Tables']['profiles']['Row']
      }
    }
    Enums: Record<string, never>
  }
}
