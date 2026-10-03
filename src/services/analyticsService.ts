import { supabase } from '@/lib/supabase';
import { toAppError } from '@/utils/errorHandler';

export interface AnalyticsFilters {
  state_id?: string;
  district_id?: string;
  taluk_id?: string;
  village_id?: string;
  land_type?: string;
  record_status?: string;
  verification_status?: string;
  risk_level?: string;
  alert_status?: string;
  alert_priority?: string;
  created_from?: string;
  created_to?: string;
}

export interface DistributionItem {
  label: string;
  value: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface AnalyticsFilterOptions {
  states: Array<{ id: string; name: string }>;
  districts: Array<{ id: string; state_id: string | null; name: string }>;
  taluks: Array<{ id: string; district_id: string | null; name: string }>;
  villages: Array<{ id: string; taluk_id: string | null; name: string }>;
  landTypes: string[];
  recordStatuses: string[];
  verificationStatuses: string[];
  riskLevels: string[];
  alertStatuses: string[];
  alertPriorities: string[];
}

export interface AnalyticsDashboardData {
  summary: {
    totalLandRecords: number;
    activeRecords: number;
    pendingRecords: number;
    approvedRecords: number;
    rejectedRecords: number;
    totalDocuments: number;
    pendingDocuments: number;
    totalVerificationTasks: number;
    pendingVerificationTasks: number;
    totalDuplicateCandidates: number;
    totalRiskAssessments: number;
    totalAlerts: number;
    activeAlerts: number;
  };
  landRecords: {
    total: number;
    byStatus: DistributionItem[];
    byLandType: DistributionItem[];
    byDistrict: DistributionItem[];
    byTaluk: DistributionItem[];
    byVillage: DistributionItem[];
    totalLandArea: number;
    landAreaByDistrict: DistributionItem[];
    trends: TrendPoint[];
  };
  documents: {
    total: number;
    byStatus: DistributionItem[];
    byType: DistributionItem[];
    byVerificationStatus: DistributionItem[];
    trends: TrendPoint[];
  };
  verification: {
    total: number;
    byStatus: DistributionItem[];
    workloadByAssigned: DistributionItem[];
    trends: TrendPoint[];
  };
  duplicates: {
    total: number;
    byStatus: DistributionItem[];
    similarityDistribution: DistributionItem[];
    trends: TrendPoint[];
  };
  risk: {
    total: number;
    byRiskLevel: DistributionItem[];
    byStatus: DistributionItem[];
    bySignalType: DistributionItem[];
    trends: TrendPoint[];
  };
  monitoring: {
    total: number;
    byStatus: DistributionItem[];
    byPriority: DistributionItem[];
    trends: TrendPoint[];
  };
  geography: {
    recordsByDistrict: DistributionItem[];
    recordsByTaluk: DistributionItem[];
    recordsByVillage: DistributionItem[];
    verificationByDistrict: DistributionItem[];
    riskByDistrict: DistributionItem[];
    alertsByDistrict: DistributionItem[];
  };
  trends: {
    recordsCreated: TrendPoint[];
    documentsUploaded: TrendPoint[];
    verificationActivity: TrendPoint[];
    alertsCreated: TrendPoint[];
    riskAssessments: TrendPoint[];
  };
}

const EMPTY_DISTRIBUTION: DistributionItem[] = [];
const EMPTY_TREND: TrendPoint[] = [];

const normalizeLabel = (value: string | null | undefined): string => {
  if (!value) return 'Unspecified';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDistribution = (
  rows: DistributionItem[],
  normalize = true,
  sortTiesByLabel = true
): DistributionItem[] => {
  const counts = new Map<string, number>();
  rows.forEach(({ label: rawLabel, value }) => {
    const label = normalize ? normalizeLabel(rawLabel) : rawLabel;
    counts.set(label, (counts.get(label) ?? 0) + value);
  });
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || (sortTiesByLabel ? a.label.localeCompare(b.label) : 0));
};

const formatGeographicDistribution = (
  rows: DistributionItem[],
  sortTiesByLabel = true
): DistributionItem[] => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const formatted = rows.map((row) => ({
    ...row,
    label: uuidPattern.test(row.label) ? normalizeLabel(row.label) : row.label,
  }));
  return sortTiesByLabel
    ? formatDistribution(formatted, false)
    : formatted.sort((a, b) => b.value - a.value);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDistributionArray = (value: unknown): value is DistributionItem[] =>
  Array.isArray(value) && value.every((item) =>
    isRecord(item) && typeof item.label === 'string' && typeof item.value === 'number');

const isTrendArray = (value: unknown): value is TrendPoint[] => isDistributionArray(value);

const isAnalyticsDashboardData = (value: unknown): value is AnalyticsDashboardData => {
  if (!isRecord(value) || !isRecord(value.summary)) return false;
  const summary = value.summary;
  if (!isRecord(value.landRecords) || !isRecord(value.documents) ||
      !isRecord(value.verification) || !isRecord(value.duplicates) ||
      !isRecord(value.risk) || !isRecord(value.monitoring) ||
      !isRecord(value.geography) || !isRecord(value.trends)) return false;

  const numericKeys = [
    'totalLandRecords', 'activeRecords', 'pendingRecords', 'approvedRecords',
    'rejectedRecords', 'totalDocuments', 'pendingDocuments',
    'totalVerificationTasks', 'pendingVerificationTasks',
    'totalDuplicateCandidates', 'totalRiskAssessments', 'totalAlerts', 'activeAlerts',
  ];
  if (!numericKeys.every((key) => typeof summary[key] === 'number')) return false;

  const distributionKeys: Array<[Record<string, unknown>, string[]]> = [
    [value.landRecords, ['byStatus', 'byLandType', 'byDistrict', 'byTaluk', 'byVillage', 'landAreaByDistrict']],
    [value.documents, ['byStatus', 'byType', 'byVerificationStatus']],
    [value.verification, ['byStatus', 'workloadByAssigned']],
    [value.duplicates, ['byStatus', 'similarityDistribution']],
    [value.risk, ['byRiskLevel', 'byStatus', 'bySignalType']],
    [value.monitoring, ['byStatus', 'byPriority']],
    [value.geography, ['recordsByDistrict', 'recordsByTaluk', 'recordsByVillage', 'verificationByDistrict', 'riskByDistrict', 'alertsByDistrict']],
  ];
  if (!distributionKeys.every(([section, keys]) => keys.every((key) => isDistributionArray(section[key])))) {
    return false;
  }

  const trendKeys: Array<[Record<string, unknown>, string[]]> = [
    [value.landRecords, ['trends']],
    [value.documents, ['trends']],
    [value.verification, ['trends']],
    [value.duplicates, ['trends']],
    [value.risk, ['trends']],
    [value.monitoring, ['trends']],
    [value.trends, ['recordsCreated', 'documentsUploaded', 'verificationActivity', 'alertsCreated', 'riskAssessments']],
  ];
  return typeof value.landRecords.total === 'number' &&
    typeof value.landRecords.totalLandArea === 'number' &&
    typeof value.documents.total === 'number' &&
    typeof value.verification.total === 'number' &&
    typeof value.duplicates.total === 'number' &&
    typeof value.risk.total === 'number' &&
    typeof value.monitoring.total === 'number' &&
    trendKeys.every(([section, keys]) => keys.every((key) => isTrendArray(section[key])));
};

export const analyticsService = {
  async getFilterOptions(): Promise<AnalyticsFilterOptions> {
    const [states, districts, taluks, villages, landTypeRows, recordStatusRows, verificationStatusRows, riskLevelRows, alertStatusRows, alertPriorityRows] = await Promise.all([
      supabase.from('states').select('id, name').eq('is_active', true).order('name'),
      supabase.from('districts').select('id, state_id, name').eq('is_active', true).order('name'),
      supabase.from('taluks').select('id, district_id, name').eq('is_active', true).order('name'),
      supabase.from('villages').select('id, taluk_id, name').eq('is_active', true).order('name'),
      supabase.from('land_records').select('land_type').not('land_type', 'is', null),
      supabase.from('land_records').select('record_status').not('record_status', 'is', null),
      supabase.from('land_records').select('verification_status').not('verification_status', 'is', null),
      supabase.from('risk_assessments').select('risk_level').not('risk_level', 'is', null),
      supabase.from('alerts').select('status').not('status', 'is', null),
      supabase.from('alerts').select('priority').not('priority', 'is', null),
    ]);

    const collectDistinct = (rows: Array<Record<string, unknown>> | null, key: string) => {
      if (!rows) return [] as string[];
      const values = new Set<string>();
      rows.forEach((row) => {
        const value = row[key];
        if (typeof value === 'string' && value.trim()) values.add(value);
      });
      return Array.from(values).sort();
    };

    if (states.error) throw toAppError(states.error);
    if (districts.error) throw toAppError(districts.error);
    if (taluks.error) throw toAppError(taluks.error);
    if (villages.error) throw toAppError(villages.error);
    if (landTypeRows.error) throw toAppError(landTypeRows.error);
    if (recordStatusRows.error) throw toAppError(recordStatusRows.error);
    if (verificationStatusRows.error) throw toAppError(verificationStatusRows.error);
    if (riskLevelRows.error) throw toAppError(riskLevelRows.error);
    if (alertStatusRows.error) throw toAppError(alertStatusRows.error);
    if (alertPriorityRows.error) throw toAppError(alertPriorityRows.error);

    return {
      states: (states.data ?? []) as Array<{ id: string; name: string }>,
      districts: (districts.data ?? []) as Array<{ id: string; state_id: string | null; name: string }>,
      taluks: (taluks.data ?? []) as Array<{ id: string; district_id: string | null; name: string }>,
      villages: (villages.data ?? []) as Array<{ id: string; taluk_id: string | null; name: string }>,
      landTypes: collectDistinct(landTypeRows.data ?? [], 'land_type'),
      recordStatuses: collectDistinct(recordStatusRows.data ?? [], 'record_status'),
      verificationStatuses: collectDistinct(verificationStatusRows.data ?? [], 'verification_status'),
      riskLevels: collectDistinct(riskLevelRows.data ?? [], 'risk_level'),
      alertStatuses: collectDistinct(alertStatusRows.data ?? [], 'status'),
      alertPriorities: collectDistinct(alertPriorityRows.data ?? [], 'priority'),
    };
  },

  async getDashboardData(filters: AnalyticsFilters = {}): Promise<AnalyticsDashboardData> {
    const { data, error } = await supabase.rpc('get_analytics_dashboard_data', {
      p_state_id: filters.state_id ?? null,
      p_district_id: filters.district_id ?? null,
      p_taluk_id: filters.taluk_id ?? null,
      p_village_id: filters.village_id ?? null,
      p_land_type: filters.land_type ?? null,
      p_record_status: filters.record_status ?? null,
      p_verification_status: filters.verification_status ?? null,
      p_risk_level: filters.risk_level ?? null,
      p_alert_status: filters.alert_status ?? null,
      p_alert_priority: filters.alert_priority ?? null,
      p_created_from: filters.created_from ?? null,
      p_created_to: filters.created_to ?? null,
    });
    if (error) throw toAppError(error);
    if (!isAnalyticsDashboardData(data)) {
      throw new Error('Analytics aggregation returned an invalid response.');
    }

    return {
      ...data,
      landRecords: {
        ...data.landRecords,
        byStatus: formatDistribution(data.landRecords.byStatus),
        byLandType: formatDistribution(data.landRecords.byLandType),
        landAreaByDistrict: formatGeographicDistribution(data.landRecords.landAreaByDistrict, false),
      },
      documents: {
        ...data.documents,
        byStatus: formatDistribution(data.documents.byStatus),
        byType: formatDistribution(data.documents.byType),
        byVerificationStatus: formatDistribution(data.documents.byVerificationStatus),
      },
      verification: {
        ...data.verification,
        byStatus: formatDistribution(data.verification.byStatus),
      },
      duplicates: {
        ...data.duplicates,
        byStatus: formatDistribution(data.duplicates.byStatus),
      },
      risk: {
        ...data.risk,
        byRiskLevel: formatDistribution(data.risk.byRiskLevel),
        byStatus: formatDistribution(data.risk.byStatus),
        bySignalType: formatDistribution(data.risk.bySignalType),
      },
      monitoring: {
        ...data.monitoring,
        byStatus: formatDistribution(data.monitoring.byStatus),
        byPriority: formatDistribution(data.monitoring.byPriority),
      },
      geography: {
        ...data.geography,
        recordsByDistrict: formatGeographicDistribution(data.geography.recordsByDistrict),
        recordsByTaluk: formatGeographicDistribution(data.geography.recordsByTaluk),
        recordsByVillage: formatGeographicDistribution(data.geography.recordsByVillage),
        verificationByDistrict: formatGeographicDistribution(data.geography.verificationByDistrict, false),
        riskByDistrict: formatGeographicDistribution(data.geography.riskByDistrict, false),
        alertsByDistrict: formatGeographicDistribution(data.geography.alertsByDistrict, false),
      },
    };
  },
};

export const analyticsDefaults = {
  emptyDistribution: EMPTY_DISTRIBUTION,
  emptyTrend: EMPTY_TREND,
};
