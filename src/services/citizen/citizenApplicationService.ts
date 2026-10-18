import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { toAppError } from '@/utils/errorHandler';

export type CitizenApplicationRow = Database['public']['Tables']['citizen_applications']['Row'];
export type ApplicationTimelineRow = Database['public']['Tables']['application_timeline']['Row'];
export type ApplicationDocumentRow = Database['public']['Tables']['application_documents']['Row'];

export type ApplicationStatus = CitizenApplicationRow['status'];
export type ApplicationRequestType = CitizenApplicationRow['request_type'];

export interface CitizenApplicationDetails extends CitizenApplicationRow {
  states?: { name: string; code: string } | null;
  districts?: { name: string; code: string } | null;
  villages?: { name: string; code: string } | null;
  assigned_officer?: { full_name: string; email: string } | null;
  assigned_clerk?: { full_name: string; email: string } | null;
  documents?: {
    id: string;
    document_id: string;
    document_type: string;
    is_clarification_evidence: boolean;
    created_at: string;
    document?: {
      file_name: string;
      file_path: string;
      mime_type: string;
      file_size: number;
    } | null;
  }[];
  timeline?: ApplicationTimelineRow[];
}

export const citizenApplicationService = {
  /**
   * Submit a new citizen application (digitization, correction, mutation, or title verification).
   */
  async submitApplication(params: {
    requestType: ApplicationRequestType;
    stateId: string;
    districtId: string;
    villageId: string;
    surveyNumber: string;
    applicantName: string;
    applicantPhone: string;
    description: string;
    documentIds?: string[];
  }): Promise<CitizenApplicationRow> {
    const { data, error } = await supabase.rpc('submit_citizen_application', {
      p_request_type: params.requestType,
      p_state_id: params.stateId,
      p_district_id: params.districtId,
      p_village_id: params.villageId,
      p_survey_number: params.surveyNumber.trim(),
      p_applicant_name: params.applicantName.trim(),
      p_applicant_phone: params.applicantPhone.trim(),
      p_description: params.description.trim(),
      p_document_ids: params.documentIds || [],
    });

    if (error) throw toAppError(error);
    if (!data) throw new Error('Failed to submit application.');
    return data;
  },

  /**
   * Fetches applications belonging to the currently authenticated citizen.
   */
  async getMyApplications(): Promise<CitizenApplicationDetails[]> {
    const { data, error } = await supabase
      .from('citizen_applications')
      .select('*, states(name, code), districts(name, code), villages(name, code)')
      .order('created_at', { ascending: false });

    if (error) throw toAppError(error);
    return (data as unknown as CitizenApplicationDetails[]) || [];
  },

  /**
   * Fetches full application details including documents and chronological timeline.
   */
  async getApplicationDetails(applicationId: string): Promise<CitizenApplicationDetails | null> {
    const { data: appData, error: appError } = await supabase
      .from('citizen_applications')
      .select(`
        *,
        states(name, code),
        districts(name, code),
        villages(name, code),
        assigned_officer:profiles!assigned_officer_id(full_name, email),
        assigned_clerk:profiles!assigned_clerk_id(full_name, email)
      `)
      .eq('id', applicationId)
      .maybeSingle();

    if (appError) throw toAppError(appError);
    if (!appData) return null;

    // Fetch attached documents
    const { data: docsData, error: docsError } = await supabase
      .from('application_documents')
      .select('*, document:documents(file_name, file_path, mime_type, file_size)')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true });

    if (docsError) throw toAppError(docsError);

    // Fetch timeline
    const { data: timelineData, error: timelineError } = await supabase
      .from('application_timeline')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true });

    if (timelineError) throw toAppError(timelineError);

    return {
      ...(appData as unknown as CitizenApplicationDetails),
      documents: (docsData as any) || [],
      timeline: (timelineData as any) || [],
    };
  },

  /**
   * For staff/clerks/officers: lists applications within their permitted geographic scope.
   */
  async listApplicationsForStaff(filters?: {
    status?: ApplicationStatus;
    requestType?: ApplicationRequestType;
    districtId?: string;
  }): Promise<CitizenApplicationDetails[]> {
    let query = supabase
      .from('citizen_applications')
      .select('*, states(name, code), districts(name, code), villages(name, code)')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.requestType) {
      query = query.eq('request_type', filters.requestType);
    }
    if (filters?.districtId) {
      query = query.eq('district_id', filters.districtId);
    }

    const { data, error } = await query;
    if (error) throw toAppError(error);
    return (data as unknown as CitizenApplicationDetails[]) || [];
  },

  /**
   * Officer or Clerk requests clarification from the applicant.
   */
  async requestClarification(applicationId: string, message: string): Promise<CitizenApplicationRow> {
    const { data, error } = await supabase.rpc('request_application_clarification', {
      p_application_id: applicationId,
      p_message: message.trim(),
    });

    if (error) throw toAppError(error);
    if (!data) throw new Error('Failed to request clarification.');
    return data;
  },

  /**
   * Citizen responds to clarification and optionally provides supporting evidence document.
   */
  async respondClarification(
    applicationId: string,
    response: string,
    newDocumentId?: string | null
  ): Promise<CitizenApplicationRow> {
    const { data, error } = await supabase.rpc('respond_application_clarification', {
      p_application_id: applicationId,
      p_response: response.trim(),
      p_new_document_id: newDocumentId || null,
    });

    if (error) throw toAppError(error);
    if (!data) throw new Error('Failed to submit clarification response.');
    return data;
  },

  /**
   * Officer makes a final decision: APPROVED or REJECTED.
   */
  async decideApplication(
    applicationId: string,
    decision: 'APPROVE' | 'REJECT',
    reason: string
  ): Promise<CitizenApplicationRow> {
    const { data, error } = await supabase.rpc('decide_citizen_application', {
      p_application_id: applicationId,
      p_decision: decision,
      p_reason: reason.trim(),
    });

    if (error) throw toAppError(error);
    if (!data) throw new Error('Failed to record decision for application.');
    return data;
  },

  /**
   * Fetches unread notifications for the current authenticated user.
   */
  async getNotifications(): Promise<any[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw toAppError(error);
    return data || [];
  },

  /**
   * Marks a notification as read.
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw toAppError(error);
  },
};
