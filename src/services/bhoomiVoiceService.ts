import { supabase } from '@/lib/supabase';
import { analyticsService } from '@/services/analyticsService';
import { documentService } from '@/services/documents/documentService';
import { landRecordService } from '@/services/land-records/landRecordService';
import { verificationService } from '@/services/verification/verificationService';
import { duplicateService } from '@/services/duplicateService';
import { riskService } from '@/services/risk/riskService';
import { monitoringService } from '@/services/monitoring/monitoringService';
import { gisService } from '@/services/gisService';
import { toAppError } from '@/utils/errorHandler';

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

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();

const hasAnyKeyword = (value: string, keywords: string[]) => keywords.some((keyword) => value.includes(keyword));

const getQuestionIntent = (question: string): string | null => {
  const text = normalizeText(question);

  if (hasAnyKeyword(text, ['how many land records', 'total land records', 'count land records', 'land record count']) || /(^|\s)(how many|total|count).*(land records?)/.test(text)) {
    return 'land_record_count';
  }

  if (hasAnyKeyword(text, ['pending verification', 'pending verification tasks', 'show pending verification', 'verification tasks awaiting review', 'verification tasks']) || /verification.*(pending|awaiting review)/.test(text)) {
    return 'verification_pending';
  }

  if (hasAnyKeyword(text, ['high risk', 'high-risk', 'high risk records', 'show high risk']) || /show.*high.*risk/.test(text)) {
    return 'risk_high';
  }

  if (hasAnyKeyword(text, ['active alerts', 'show active alerts', 'alerts', 'what active alerts']) || /active.*alert/.test(text)) {
    return 'monitoring_alerts';
  }

  if (hasAnyKeyword(text, ['duplicate candidates', 'show duplicate candidates', 'pending duplicate', 'duplicate review']) || /duplicate/.test(text)) {
    return 'duplicates';
  }

  if (hasAnyKeyword(text, ['show analytics', 'analytics summary', 'dashboard summary', 'analytics']) || /analytics/.test(text)) {
    return 'analytics_summary';
  }

  if (hasAnyKeyword(text, ['land records', 'records in', 'show records', 'show land records']) || /show.*records/.test(text)) {
    return 'land_record_search';
  }

  if (hasAnyKeyword(text, ['documents', 'show documents', 'what documents']) || /document/.test(text)) {
    return 'documents';
  }

  if (hasAnyKeyword(text, ['risk assessment', 'risk assessments', 'show risk']) || /risk/.test(text)) {
    return 'risk_assessments';
  }

  if (hasAnyKeyword(text, ['district', 'taluk', 'village', 'state']) || /(state|district|taluk|village)/.test(text)) {
    return 'geography';
  }

  return null;
};

const requirePermissions = (permissions: string[], required: string[]) => {
  const missing = required.filter((permission) => !permissions.includes(permission));
  if (missing.length > 0) {
    throw new Error(`You do not have permission to access this data (${missing.join(', ')}).`);
  }
};

const getLocationMatch = async (type: 'state' | 'district' | 'taluk' | 'village', name: string) => {
  const tableName = `${type}s` as 'states' | 'districts' | 'taluks' | 'villages';
  const { data, error } = await supabase
    .from(tableName)
    .select('id, name')
    .ilike('name', `%${name}%`)
    .limit(5);

  if (error) throw toAppError(error);
  return data?.[0] ?? null;
};

const extractLocationName = (question: string) => {
  const text = normalizeText(question);
  const match = text.match(/(?:in|for|from|near|at)\s+([a-z0-9][a-z0-9\s-]{1,40})$/i);
  if (match?.[1]) {
    return match[1].replace(/\s+(district|state|taluk|village)\s*$/, '').trim();
  }

  const districtMatch = text.match(/(?:district)\s+([a-z0-9\s-]+)/i);
  if (districtMatch?.[1]) return districtMatch[1].trim();

  return null;
};

const buildRecordItem = (record: Record<string, any>) => ({
  title: record.record_number || record.survey_number || record.patta_number || record.id,
  subtitle: [
    record.districts?.name || record.district_id,
    record.taluks?.name || record.taluk_id,
    record.villages?.name || record.village_id,
  ].filter(Boolean).join(' • '),
  href: record.id ? `/land-records/${record.id}` : undefined,
  meta: [record.land_type || 'Unspecified type', record.record_status || 'Unknown status'],
});

const buildDocumentItem = (document: Record<string, any>) => ({
  title: document.original_filename || 'Unnamed document',
  subtitle: document.document_type || 'Document',
  href: document.id ? `/documents/${document.id}` : undefined,
  meta: [document.processing_status || 'Unknown status', document.verification_status || 'Unknown verification'],
});

const buildVerificationItem = (task: Record<string, any>) => ({
  title: task.id || 'Verification task',
  subtitle: task.land_records?.record_number || task.land_record_id || 'Task without record reference',
  href: task.id ? `/verification/${task.id}` : undefined,
  meta: [task.status || 'Unknown status', task.priority || 'No priority'],
});

const buildDuplicateItem = (candidate: Record<string, any>) => ({
  title: `Duplicate candidate ${candidate.id?.slice(0, 8) ?? 'Record'}`,
  subtitle: [candidate.record_a?.record_number || candidate.record_a_id, candidate.record_b?.record_number || candidate.record_b_id].filter(Boolean).join(' vs '),
  href: candidate.id ? `/duplicates/${candidate.id}` : undefined,
  meta: [candidate.status || 'Unknown status', `${candidate.similarity_score ?? 0}%`],
});

const buildRiskItem = (assessment: Record<string, any>) => ({
  title: assessment.land_records?.record_number || assessment.land_record_id || 'Risk assessment',
  subtitle: assessment.land_records?.districts?.name || 'Risk assessment',
  href: assessment.id ? `/risk/${assessment.id}` : undefined,
  meta: [assessment.risk_level || 'Unknown', assessment.status || 'Unknown status'],
});

const buildAlertItem = (alert: Record<string, any>) => ({
  title: alert.title || 'Alert',
  subtitle: alert.land_records?.record_number || alert.land_record_id || 'Linked record unavailable',
  href: alert.id ? `/monitoring/alerts/${alert.id}` : undefined,
  meta: [alert.status || 'Unknown', alert.priority || 'No priority'],
});

export const bhoomiVoiceService = {
  async ask(question: string, permissions: string[] = []): Promise<BhoomiVoiceResult> {
    const intent = getQuestionIntent(question);

    if (!intent) {
      return {
        intent: 'unsupported',
        status: 'unsupported',
        answer: 'I can currently help with land records, documents, verification, duplicates, risk, monitoring, geography, and analytics.',
      };
    }

    try {
      const locationName = extractLocationName(question);
      const recordIdMatch = question.match(/record\s+(?:id\s+)?([a-z0-9-]{8,})/i);
      const recordId = recordIdMatch?.[1] ?? null;

      switch (intent) {
        case 'land_record_count': {
          requirePermissions(permissions, ['land_record:read']);
          const result = await landRecordService.getLandRecords({ page: 1, pageSize: 1 });
          return {
            intent,
            status: 'success',
            count: result.total,
            answer: `Land records: ${result.total}`,
            summary: result.total === 0 ? 'No land records are available in the current scope.' : `There are ${result.total} land records in the current scope.`,
          };
        }

        case 'land_record_search': {
          requirePermissions(permissions, ['land_record:read']);
          let filters: Record<string, string> = {};

          if (locationName) {
            const district = await getLocationMatch('district', locationName);
            const taluk = district ? null : await getLocationMatch('taluk', locationName);
            const village = district || taluk ? null : await getLocationMatch('village', locationName);
            const state = district || taluk || village ? null : await getLocationMatch('state', locationName);

            if (district) filters.district_id = district.id;
            else if (taluk) filters.taluk_id = taluk.id;
            else if (village) filters.village_id = village.id;
            else if (state) filters.state_id = state.id;
          }

          if (recordId) {
            const record = await landRecordService.getLandRecord(recordId);
            return {
              intent,
              status: 'success',
              count: 1,
              answer: `Land record ${record.record_number || record.id} is available.`,
              summary: `Open record ${record.record_number || record.id} for details.`,
              items: [buildRecordItem(record)],
            };
          }

          const result = await landRecordService.getLandRecords({
            search: locationName || undefined,
            page: 1,
            pageSize: 8,
            ...filters,
          });

          const answerSuffix = locationName ? ` in ${locationName}` : '';
          return {
            intent,
            status: 'success',
            count: result.total,
            answer: `Land records${answerSuffix}: ${result.total}`,
            summary: result.total === 0 ? 'No land records match the supplied filters.' : `Showing ${Math.min(result.data.length, 8)} matching land records.`,
            items: result.data.slice(0, 8).map(buildRecordItem),
          };
        }

        case 'documents': {
          requirePermissions(permissions, ['document:read']);
          const term = locationName || (recordId ? 'record' : '');
          const result = await documentService.getDocuments({
            land_record_id: recordId ?? undefined,
            search: term || undefined,
            page: 1,
            pageSize: 8,
          });

          return {
            intent,
            status: 'success',
            count: result.total,
            answer: `Documents: ${result.total}`,
            summary: result.total === 0 ? 'No documents match the current request.' : `Showing ${Math.min(result.data.length, 8)} matching documents.`,
            items: result.data.slice(0, 8).map(buildDocumentItem),
          };
        }

        case 'verification_pending': {
          requirePermissions(permissions, ['verification:read']);
          const result = await verificationService.getVerificationTasks({ page: 1, pageSize: 25 });
          const pending = result.data.filter((task) => ['QUEUED', 'ASSIGNED'].includes(task.status || ''));

          return {
            intent,
            status: 'success',
            count: pending.length,
            answer: `Pending verification tasks: ${pending.length}`,
            summary: pending.length === 0 ? 'There are no pending verification tasks.' : `There are ${pending.length} tasks requiring review.`,
            items: pending.slice(0, 8).map(buildVerificationItem),
          };
        }

        case 'duplicates': {
          requirePermissions(permissions, ['duplicate:read']);
          const result = await duplicateService.getDuplicateCandidates({ page: 1, pageSize: 10 });
          const pendingOnly = result.data.filter((candidate) => ['PENDING', 'UNDER_REVIEW'].includes(candidate.status || ''));

          return {
            intent,
            status: 'success',
            count: pendingOnly.length || result.total,
            answer: `Duplicate candidates: ${pendingOnly.length || result.total}`,
            summary: result.total === 0 ? 'No duplicate candidates were found.' : `There are ${pendingOnly.length || result.total} duplicate candidates to review.`,
            items: (pendingOnly.length ? pendingOnly : result.data).slice(0, 8).map(buildDuplicateItem),
          };
        }

        case 'risk_high': {
          requirePermissions(permissions, ['risk:read']);
          const assessments = await riskService.getRiskAssessments({ risk_level: 'HIGH', page: 1, pageSize: 10 });
          return {
            intent,
            status: 'success',
            count: assessments.total,
            answer: `High-risk records: ${assessments.total}`,
            summary: assessments.total === 0 ? 'No high-risk records are currently flagged.' : `${assessments.total} records are currently marked high risk.`,
            items: assessments.data.slice(0, 8).map(buildRiskItem),
          };
        }

        case 'risk_assessments': {
          requirePermissions(permissions, ['risk:read']);
          const assessments = await riskService.getRiskAssessments({ page: 1, pageSize: 8 });
          return {
            intent,
            status: 'success',
            count: assessments.total,
            answer: `Risk assessments: ${assessments.total}`,
            summary: assessments.total === 0 ? 'No risk assessments were found.' : `Showing ${assessments.data.length} recent risk assessments.`,
            items: assessments.data.slice(0, 8).map(buildRiskItem),
          };
        }

        case 'monitoring_alerts': {
          requirePermissions(permissions, ['monitoring:read']);
          const alertsResult = await monitoringService.getAlerts({ page: 1, pageSize: 10 });
          const activeAlerts = alertsResult.data.filter((alert) => alert.status !== 'RESOLVED');

          return {
            intent,
            status: 'success',
            count: activeAlerts.length,
            answer: `Active alerts: ${activeAlerts.length}`,
            summary: activeAlerts.length === 0 ? 'There are no active alerts.' : `${activeAlerts.length} active alerts are currently in scope.`,
            items: activeAlerts.slice(0, 8).map(buildAlertItem),
          };
        }

        case 'geography': {
          requirePermissions(permissions, ['land_record:read']);
          const hierarchy = await gisService.getGeographyHierarchy();
          const districtNames = hierarchy.districts.slice(0, 10).map((district) => district.name);
          return {
            intent,
            status: 'success',
            count: hierarchy.districts.length,
            answer: `Available districts: ${districtNames.join(', ') || 'None'}`,
            summary: `The current geography dataset contains ${hierarchy.states.length} states, ${hierarchy.districts.length} districts, ${hierarchy.taluks.length} taluks, and ${hierarchy.villages.length} villages.`,
            items: hierarchy.districts.slice(0, 8).map((district) => ({
              title: district.name,
              subtitle: 'District',
              href: '/gis',
              meta: [district.code || 'No code'],
            })),
          };
        }

        case 'analytics_summary': {
          requirePermissions(permissions, ['analytics:read']);
          const dashboard = await analyticsService.getDashboardData({});
          const summary = dashboard.summary;
          return {
            intent,
            status: 'success',
            count: summary.totalLandRecords,
            answer: `Analytics summary: ${summary.totalLandRecords} land records, ${summary.pendingVerificationTasks} pending verification tasks, ${summary.activeAlerts} active alerts.`,
            summary: `The dashboard currently reports ${summary.totalLandRecords} records, ${summary.totalDocuments} documents, ${summary.pendingVerificationTasks} pending verification tasks, ${summary.totalDuplicateCandidates} duplicate candidates, and ${summary.activeAlerts} active alerts.`,
            items: [
              { title: 'Land records', subtitle: `${summary.totalLandRecords} total`, href: '/analytics' },
              { title: 'Verification', subtitle: `${summary.pendingVerificationTasks} pending`, href: '/analytics' },
              { title: 'Alerts', subtitle: `${summary.activeAlerts} active`, href: '/analytics' },
            ],
          };
        }

        default: {
          return {
            intent: 'unsupported',
            status: 'unsupported',
            answer: 'I can currently help with land records, documents, verification, duplicates, risk, monitoring, geography, and analytics.',
          };
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        intent,
        status: 'error',
        answer: `I couldn’t answer that request from the live database.`,
        error: message,
      };
    }
  },
};
