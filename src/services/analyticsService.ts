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

const toDistribution = (
  rows: Array<Record<string, unknown>>,
  key: string,
  transform?: (value: string) => string
): DistributionItem[] => {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const rawValue = row[key];
    const value = typeof rawValue === 'string' ? rawValue : rawValue == null ? 'Unspecified' : String(rawValue);
    const label = transform ? transform(value) : normalizeLabel(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, value: count }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
};

const toTrendSeries = (
  rows: Array<Record<string, unknown>>,
  key: string
): TrendPoint[] => {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const value = row[key];
    if (typeof value !== 'string' || !value) return;

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return;

    const label = timestamp.toISOString().slice(0, 10);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));
};

const applyLandRecordFilters = (
  query: any,
  filters: AnalyticsFilters
) => {
  let mutated: any = query;

  if (filters.state_id) mutated = mutated.eq('state_id', filters.state_id);
  if (filters.district_id) mutated = mutated.eq('district_id', filters.district_id);
  if (filters.taluk_id) mutated = mutated.eq('taluk_id', filters.taluk_id);
  if (filters.village_id) mutated = mutated.eq('village_id', filters.village_id);
  if (filters.land_type) mutated = mutated.eq('land_type', filters.land_type);
  if (filters.record_status) mutated = mutated.eq('record_status', filters.record_status);
  if (filters.verification_status) mutated = mutated.eq('verification_status', filters.verification_status);

  return mutated;
};

const fetchLandRecords = async (filters: AnalyticsFilters) => {
  let query = supabase
    .from('land_records')
    .select('id, state_id, district_id, taluk_id, village_id, land_type, record_status, verification_status, land_area, created_at');

  query = applyLandRecordFilters(query, filters);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw toAppError(error);

  return (data ?? []) as Array<Record<string, unknown>>;
};

const fetchDocuments = async (filters: AnalyticsFilters, recordIds: string[]) => {
  let query = supabase
    .from('documents')
    .select('id, document_type, processing_status, verification_status, state_id, district_id, village_id, land_record_id, created_at');

  if (filters.state_id) query = query.eq('state_id', filters.state_id);
  if (filters.district_id) query = query.eq('district_id', filters.district_id);
  if (filters.village_id) query = query.eq('village_id', filters.village_id);
  if (recordIds.length) query = query.in('land_record_id', recordIds);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw toAppError(error);

  return (data ?? []) as Array<Record<string, unknown>>;
};

const fetchVerificationTasks = async (filters: AnalyticsFilters, recordIds: string[]) => {
  let query = supabase
    .from('verification_tasks')
    .select('id, status, priority, created_at, land_record_id, assigned_to');

  if (filters.verification_status) query = query.eq('status', filters.verification_status);
  if (recordIds.length) query = query.in('land_record_id', recordIds);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw toAppError(error);

  return (data ?? []) as Array<Record<string, unknown>>;
};

const fetchDuplicateCandidates = async (recordIds: string[]) => {
  let query = supabase
    .from('duplicate_candidates')
    .select('id, status, similarity_score, created_at, record_a_id, record_b_id');

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw toAppError(error);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (!recordIds.length) return rows;

  const scopedRecordIds = new Set(recordIds);
  return rows.filter((row) => {
    const recordAId = row.record_a_id as string | null;
    const recordBId = row.record_b_id as string | null;
    return Boolean(recordAId && scopedRecordIds.has(recordAId)) || Boolean(recordBId && scopedRecordIds.has(recordBId));
  });
};

const fetchRiskAssessments = async (filters: AnalyticsFilters, recordIds: string[]) => {
  let query = supabase
    .from('risk_assessments')
    .select('id, risk_score, risk_level, status, calculated_at, land_record_id, created_at');

  if (filters.risk_level) query = query.eq('risk_level', filters.risk_level);
  if (recordIds.length) query = query.in('land_record_id', recordIds);

  const { data, error } = await query.order('calculated_at', { ascending: false });
  if (error) throw toAppError(error);

  return (data ?? []) as Array<Record<string, unknown>>;
};

const fetchRiskSignals = async (riskAssessments: Array<Record<string, unknown>>) => {
  if (!riskAssessments.length) return [] as Array<Record<string, unknown>>;

  const assessmentIds = riskAssessments.map((row) => row.id as string).filter(Boolean);
  if (!assessmentIds.length) return [];

  const { data, error } = await supabase
    .from('risk_signals')
    .select('id, risk_assessment_id, signal_type, description, contribution')
    .in('risk_assessment_id', assessmentIds);

  if (error) throw toAppError(error);
  return (data ?? []) as Array<Record<string, unknown>>;
};

const fetchAlerts = async (filters: AnalyticsFilters, recordIds: string[]) => {
  let query = supabase
    .from('alerts')
    .select('id, land_record_id, alert_type, priority, status, title, description, created_at');

  if (filters.alert_status) query = query.eq('status', filters.alert_status);
  if (filters.alert_priority) query = query.eq('priority', filters.alert_priority);
  if (recordIds.length) query = query.in('land_record_id', recordIds);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw toAppError(error);

  return (data ?? []) as Array<Record<string, unknown>>;
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
    const landRecords = await fetchLandRecords(filters);
    const landRecordIds = landRecords.map((row) => row.id as string).filter(Boolean);

    const [riskAssessments, documents, verificationTasks, duplicateCandidates, alerts] = await Promise.all([
      fetchRiskAssessments(filters, landRecordIds),
      fetchDocuments(filters, landRecordIds),
      fetchVerificationTasks(filters, landRecordIds),
      fetchDuplicateCandidates(landRecordIds),
      fetchAlerts(filters, landRecordIds),
    ]);

    const riskSignals = await fetchRiskSignals(riskAssessments);

    const summary = {
      totalLandRecords: landRecords.length,
      activeRecords: landRecords.filter((row) => row.record_status === 'ACTIVE').length,
      pendingRecords: landRecords.filter((row) => row.verification_status === 'PENDING').length,
      approvedRecords: landRecords.filter((row) => row.verification_status === 'APPROVED').length,
      rejectedRecords: landRecords.filter((row) => row.verification_status === 'REJECTED').length,
      totalDocuments: documents.length,
      pendingDocuments: documents.filter((row) => row.processing_status === 'PENDING').length,
      totalVerificationTasks: verificationTasks.length,
      pendingVerificationTasks: verificationTasks.filter((row) => row.status === 'QUEUED' || row.status === 'ASSIGNED').length,
      totalDuplicateCandidates: duplicateCandidates.length,
      totalRiskAssessments: riskAssessments.length,
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter((row) => row.status !== 'RESOLVED').length,
    };

    const districtNames = new Map<string, string>();
    const talukNames = new Map<string, string>();
    const villageNames = new Map<string, string>();

    const [{ data: districtRows }, { data: talukRows }, { data: villageRows }] = await Promise.all([
      supabase.from('districts').select('id, name').eq('is_active', true),
      supabase.from('taluks').select('id, name').eq('is_active', true),
      supabase.from('villages').select('id, name').eq('is_active', true),
    ]);

    (districtRows ?? []).forEach((row) => districtNames.set(String(row.id), String(row.name ?? 'Unspecified')));
    (talukRows ?? []).forEach((row) => talukNames.set(String(row.id), String(row.name ?? 'Unspecified')));
    (villageRows ?? []).forEach((row) => villageNames.set(String(row.id), String(row.name ?? 'Unspecified')));

    const landRecordsByStatus = toDistribution(landRecords, 'record_status');
    const byLandType = toDistribution(landRecords, 'land_type');
    const byDistrict = toDistribution(landRecords, 'district_id', (value) => districtNames.get(value) ?? normalizeLabel(value));
    const byTaluk = toDistribution(landRecords, 'taluk_id', (value) => talukNames.get(value) ?? normalizeLabel(value));
    const byVillage = toDistribution(landRecords, 'village_id', (value) => villageNames.get(value) ?? normalizeLabel(value));
    const totalLandArea = landRecords.reduce((sum, row) => {
      const raw = Number(row.land_area ?? 0);
      return Number.isFinite(raw) ? sum + raw : sum;
    }, 0);
    const landAreaByDistrict = Array.from(
      landRecords.reduce((map, row) => {
        const districtKey = (row.district_id as string | null) ?? 'Unspecified';
        const districtLabel = districtNames.get(districtKey) ?? normalizeLabel(districtKey);
        const current = map.get(districtLabel) ?? 0;
        const area = Number(row.land_area ?? 0);
        map.set(districtLabel, current + (Number.isFinite(area) ? area : 0));
        return map;
      }, new Map<string, number>()).entries()
    )
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const documentStatus = toDistribution(documents, 'processing_status');
    const documentType = toDistribution(documents, 'document_type');
    const documentVerification = toDistribution(documents, 'verification_status');

    const verificationByStatus = toDistribution(verificationTasks, 'status');
    const workloadByAssigned = toDistribution(verificationTasks, 'assigned_to', (value) => value === 'null' ? 'Unassigned' : value);

    const duplicateStatus = toDistribution(duplicateCandidates, 'status');
    const similarityDistribution = (() => {
      const bins = new Map<string, number>();
      duplicateCandidates.forEach((row) => {
        const raw = Number(row.similarity_score ?? 0);
        const bucket = raw >= 0.8 ? '>= 80%' : raw >= 0.6 ? '60-79%' : raw >= 0.4 ? '40-59%' : raw > 0 ? '1-39%' : '0%';
        bins.set(bucket, (bins.get(bucket) ?? 0) + 1);
      });
      return Array.from(bins.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    })();

    const riskByLevel = toDistribution(riskAssessments, 'risk_level');
    const riskByStatus = toDistribution(riskAssessments, 'status');
    const signalType = toDistribution(riskSignals, 'signal_type');

    const alertByStatus = toDistribution(alerts, 'status');
    const alertByPriority = toDistribution(alerts, 'priority');

    const recordsByDistrict = toDistribution(landRecords, 'district_id', (value) => districtNames.get(value) ?? normalizeLabel(value));
    const recordsByTaluk = toDistribution(landRecords, 'taluk_id', (value) => talukNames.get(value) ?? normalizeLabel(value));
    const recordsByVillage = toDistribution(landRecords, 'village_id', (value) => villageNames.get(value) ?? normalizeLabel(value));
    const verificationByDistrict = (() => {
      const grouped = new Map<string, number>();
      verificationTasks.forEach((row) => {
        const recordId = row.land_record_id as string | null;
        const matchingRecord = landRecords.find((record) => record.id === recordId);
        const districtId = (matchingRecord?.district_id as string | null) ?? 'Unspecified';
        const districtLabel = districtNames.get(districtId) ?? normalizeLabel(districtId);
        grouped.set(districtLabel, (grouped.get(districtLabel) ?? 0) + 1);
      });
      return Array.from(grouped.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    })();
    const riskByDistrict = (() => {
      const grouped = new Map<string, number>();
      riskAssessments.forEach((row) => {
        const recordId = row.land_record_id as string | null;
        const matchingRecord = landRecords.find((record) => record.id === recordId);
        const districtId = (matchingRecord?.district_id as string | null) ?? 'Unspecified';
        const districtLabel = districtNames.get(districtId) ?? normalizeLabel(districtId);
        grouped.set(districtLabel, (grouped.get(districtLabel) ?? 0) + 1);
      });
      return Array.from(grouped.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    })();
    const alertsByDistrict = (() => {
      const grouped = new Map<string, number>();
      alerts.forEach((row) => {
        const recordId = row.land_record_id as string | null;
        const matchingRecord = landRecords.find((record) => record.id === recordId);
        const districtId = (matchingRecord?.district_id as string | null) ?? 'Unspecified';
        const districtLabel = districtNames.get(districtId) ?? normalizeLabel(districtId);
        grouped.set(districtLabel, (grouped.get(districtLabel) ?? 0) + 1);
      });
      return Array.from(grouped.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    })();

    const dashboard: AnalyticsDashboardData = {
      summary,
      landRecords: {
        total: landRecords.length,
        byStatus: landRecordsByStatus,
        byLandType: byLandType,
        byDistrict: byDistrict,
        byTaluk: byTaluk,
        byVillage: byVillage,
        totalLandArea,
        landAreaByDistrict,
        trends: toTrendSeries(landRecords, 'created_at'),
      },
      documents: {
        total: documents.length,
        byStatus: documentStatus,
        byType: documentType,
        byVerificationStatus: documentVerification,
        trends: toTrendSeries(documents, 'created_at'),
      },
      verification: {
        total: verificationTasks.length,
        byStatus: verificationByStatus,
        workloadByAssigned,
        trends: toTrendSeries(verificationTasks, 'created_at'),
      },
      duplicates: {
        total: duplicateCandidates.length,
        byStatus: duplicateStatus,
        similarityDistribution,
        trends: toTrendSeries(duplicateCandidates, 'created_at'),
      },
      risk: {
        total: riskAssessments.length,
        byRiskLevel: riskByLevel,
        byStatus: riskByStatus,
        bySignalType: signalType,
        trends: toTrendSeries(riskAssessments, 'calculated_at'),
      },
      monitoring: {
        total: alerts.length,
        byStatus: alertByStatus,
        byPriority: alertByPriority,
        trends: toTrendSeries(alerts, 'created_at'),
      },
      geography: {
        recordsByDistrict: recordsByDistrict,
        recordsByTaluk: recordsByTaluk,
        recordsByVillage: recordsByVillage,
        verificationByDistrict,
        riskByDistrict,
        alertsByDistrict,
      },
      trends: {
        recordsCreated: toTrendSeries(landRecords, 'created_at'),
        documentsUploaded: toTrendSeries(documents, 'created_at'),
        verificationActivity: toTrendSeries(verificationTasks, 'created_at'),
        alertsCreated: toTrendSeries(alerts, 'created_at'),
        riskAssessments: toTrendSeries(riskAssessments, 'calculated_at'),
      },
    };

    return dashboard;
  },
};

export const analyticsDefaults = {
  emptyDistribution: EMPTY_DISTRIBUTION,
  emptyTrend: EMPTY_TREND,
};
