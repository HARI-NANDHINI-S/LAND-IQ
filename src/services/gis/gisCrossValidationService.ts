import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type GISValidationStatus =
  | 'MATCHED'
  | 'POSSIBLE_MISMATCH'
  | 'AMBIGUOUS_MATCH'
  | 'NO_MATCH'
  | 'SOURCE_DATA_UNAVAILABLE'
  | 'NOT_YET_VALIDATED';

export type OfficerResolutionStatus =
  | 'PENDING'
  | 'ACCEPTED_OVERRIDE'
  | 'CONFIRMED_MATCH'
  | 'REJECTED_DISCREPANCY';

export type GISCrossValidation = Database['public']['Tables']['gis_cross_validations']['Row'];
export type CadastralParcel = Database['public']['Tables']['cadastral_parcels']['Row'];

export interface GISCrossValidationDetails extends GISCrossValidation {
  land_records?: {
    record_number: string;
    survey_number: string;
    land_area: string | null;
    verification_status: string;
    villages?: { name: string } | null;
    districts?: { name: string } | null;
  } | null;
  resolver?: {
    full_name: string;
    email: string;
  } | null;
}

export const gisCrossValidationService = {
  /**
   * Triggers an automated cross-validation comparison between extracted record attributes
   * and authoritative cadastral survey parcels in the database.
   */
  async performCrossValidation(landRecordId: string, documentId?: string | null): Promise<GISCrossValidation> {
    const { data, error } = await supabase.rpc('perform_gis_cross_validation', {
      p_land_record_id: landRecordId,
      p_document_id: documentId || null,
    });
    if (error) throw toAppError(error);
    if (!data) throw new Error('No validation result returned from GIS cross-validation engine.');
    return data;
  },

  /**
   * Retrieves the latest GIS cross-validation record for a specific land record.
   */
  async getValidationForRecord(landRecordId: string): Promise<GISCrossValidationDetails | null> {
    const { data, error } = await supabase
      .from('gis_cross_validations')
      .select('*, land_records(record_number, survey_number, land_area, verification_status, villages(name), districts(name)), resolver:profiles!resolved_by(full_name, email)')
      .eq('land_record_id', landRecordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw toAppError(error);
    return (data as unknown as GISCrossValidationDetails) || null;
  },

  /**
   * Officer resolves or accepts a flagged GIS discrepancy with rationale.
   */
  async resolveDiscrepancy(
    validationId: string,
    resolutionStatus: OfficerResolutionStatus,
    notes: string
  ): Promise<GISCrossValidation> {
    const { data, error } = await supabase.rpc('resolve_gis_discrepancy', {
      p_validation_id: validationId,
      p_resolution_status: resolutionStatus,
      p_notes: notes.trim(),
    });
    if (error) throw toAppError(error);
    if (!data) throw new Error('Failed to record resolution for GIS cross-validation.');
    return data;
  },

  /**
   * Lists all GIS cross-validations within the officer's jurisdiction, filtered by status.
   */
  async listValidations(filters?: {
    validation_status?: GISValidationStatus;
    resolution_status?: OfficerResolutionStatus;
    district_id?: string;
  }): Promise<GISCrossValidationDetails[]> {
    let query = supabase
      .from('gis_cross_validations')
      .select('*, land_records(record_number, survey_number, land_area, verification_status, villages(name), districts(name)), resolver:profiles!resolved_by(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filters?.validation_status) {
      query = query.eq('validation_status', filters.validation_status);
    }
    if (filters?.resolution_status) {
      query = query.eq('officer_resolution_status', filters.resolution_status);
    }
    if (filters?.district_id) {
      query = query.eq('district_id', filters.district_id);
    }

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as unknown as GISCrossValidationDetails[]) || [];
  },

  /**
   * Fetches the authoritative cadastral parcel geometry and attributes by survey number & village.
   */
  async getCadastralParcel(villageId: string, surveyNumber: string): Promise<CadastralParcel | null> {
    const { data, error } = await supabase
      .from('cadastral_parcels')
      .select('*')
      .eq('village_id', villageId)
      .eq('survey_number', surveyNumber.trim())
      .maybeSingle();

    if (error) throw toAppError(error);
    return data;
  },
};
