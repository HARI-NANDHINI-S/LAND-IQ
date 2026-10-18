import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type LandRecordVersionRow = Database['public']['Tables']['land_record_versions']['Row'];

export interface LandRecordVersionWithActor extends LandRecordVersionRow {
  actor?: {
    full_name: string;
    email: string;
  } | null;
  documents?: {
    file_name: string;
    document_type: string;
  } | null;
}

export interface FieldDiff {
  fieldName: string;
  label: string;
  oldValue: any;
  newValue: any;
  isModified: boolean;
}

export const versionService = {
  /**
   * Fetches all immutable historical versions for a given land record in chronological order.
   */
  async getRecordVersions(landRecordId: string): Promise<LandRecordVersionWithActor[]> {
    const { data, error } = await supabase
      .from('land_record_versions')
      .select('*, actor:profiles!actor_id(full_name, email), documents(file_name, document_type)')
      .eq('land_record_id', landRecordId)
      .order('version_number', { ascending: false });

    if (error) throw toAppError(error);
    return (data as unknown as LandRecordVersionWithActor[]) || [];
  },

  /**
   * Creates an explicit immutable snapshot version for a land record using the server-side RPC.
   */
  async createVersion(params: {
    landRecordId: string;
    eventType: LandRecordVersionRow['event_type'];
    documentId?: string | null;
    reason?: string | null;
    fieldChanges?: Record<string, { old_value: any; new_value: any }> | null;
  }): Promise<LandRecordVersionRow> {
    const { data, error } = await supabase.rpc('create_record_version', {
      p_land_record_id: params.landRecordId,
      p_event_type: params.eventType,
      p_document_id: params.documentId || null,
      p_reason: params.reason || null,
      p_field_changes: (params.fieldChanges as unknown as Json) || null,
    });

    if (error) throw toAppError(error);
    if (!data) throw new Error('Failed to record version snapshot.');
    return data;
  },

  /**
   * Computes a structured diff between two version snapshots.
   */
  compareVersions(vOlder: LandRecordVersionWithActor, vNewer: LandRecordVersionWithActor): FieldDiff[] {
    const olderSnapshot = (vOlder.snapshot as Record<string, any>) || {};
    const newerSnapshot = (vNewer.snapshot as Record<string, any>) || {};

    const keyLabels: Record<string, string> = {
      record_number: 'Record Number',
      survey_number: 'Survey Number',
      subdivision_number: 'Subdivision Number',
      patta_number: 'Patta Number',
      land_type: 'Land Classification',
      land_area: 'Land Area',
      area_unit: 'Area Unit',
      owner_name: 'Owner Name',
      relative_name: 'Relative Name',
      relationship_type: 'Relationship',
      verification_status: 'Verification Status',
      risk_level: 'Risk Level',
      is_active: 'Active Status',
      source_document_id: 'Source Document',
    };

    const allKeys = Array.from(new Set([...Object.keys(olderSnapshot), ...Object.keys(newerSnapshot)])).filter(
      (key) => !['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key)
    );

    return allKeys.map((key) => {
      const oldVal = olderSnapshot[key] !== undefined ? olderSnapshot[key] : null;
      const newVal = newerSnapshot[key] !== undefined ? newerSnapshot[key] : null;
      const isModified = JSON.stringify(oldVal) !== JSON.stringify(newVal);

      return {
        fieldName: key,
        label: keyLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        oldValue: oldVal,
        newValue: newVal,
        isModified,
      };
    });
  },
};
