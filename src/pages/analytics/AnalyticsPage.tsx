import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Download, FileText, Filter, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/auth/useAuth';
import { analyticsService, type AnalyticsDashboardData, type AnalyticsFilters, type DistributionItem, type TrendPoint } from '@/services/analyticsService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const formatValue = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return value.toLocaleString();
  if (value == null || value === '') return '0';
  return String(value);
};

const formatLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

function SummaryCard({ title, value, description, icon: Icon }: { title: string; value: number | string; description: string; icon: typeof BarChart3 }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{formatValue(value)}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function DistributionBlock({ title, items, emptyLabel = 'No data available for this view.' }: { title: string; items?: DistributionItem[]; emptyLabel?: string }) {
  const values = items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {values.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-3">
            {values.slice(0, 8).map((item) => (
              <div key={`${title}-${item.label}`}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{formatLabel(item.label)}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(12, (item.value / Math.max(...values.map((entry) => entry.value), 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendChart({ title, data, emptyLabel = 'No trend data available.' }: { title: string; data?: TrendPoint[]; emptyLabel?: string }) {
  const points = data ?? [];
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-3">
            {points.map((point) => (
              <div key={`${title}-${point.label}`}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{point.label}</span>
                  <span className="font-medium">{point.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(point.value / maxValue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getSelectValue(value: string | undefined) {
  return value ?? 'all';
}

export default function AnalyticsPage() {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState<AnalyticsFilters>({});

  const filterOptionsQuery = useQuery({
    queryKey: ['analytics-filter-options'],
    queryFn: () => analyticsService.getFilterOptions(),
    enabled: hasPermission('analytics:read'),
  });

  const dashboardQuery = useQuery({
    queryKey: ['analytics-dashboard', filters],
    queryFn: () => analyticsService.getDashboardData(filters),
    enabled: hasPermission('analytics:read'),
  });

  const availableStates = filterOptionsQuery.data?.states ?? [];
  const availableDistricts = filterOptionsQuery.data?.districts ?? [];
  const availableTaluks = filterOptionsQuery.data?.taluks ?? [];
  const availableVillages = filterOptionsQuery.data?.villages ?? [];
  const availableLandTypes = filterOptionsQuery.data?.landTypes ?? [];
  const availableRecordStatuses = filterOptionsQuery.data?.recordStatuses ?? [];
  const availableVerificationStatuses = filterOptionsQuery.data?.verificationStatuses ?? [];
  const availableRiskLevels = filterOptionsQuery.data?.riskLevels ?? [];
  const availableAlertStatuses = filterOptionsQuery.data?.alertStatuses ?? [];
  const availableAlertPriorities = filterOptionsQuery.data?.alertPriorities ?? [];

  const filteredDistricts = availableDistricts.filter(
    (district) => !filters.state_id || district.state_id === filters.state_id
  );
  const filteredTaluks = availableTaluks.filter(
    (taluk) => !filters.district_id || taluk.district_id === filters.district_id
  );
  const filteredVillages = availableVillages.filter(
    (village) => !filters.taluk_id || village.taluk_id === filters.taluk_id
  );

  const updateFilter = (key: keyof AnalyticsFilters, value: string | undefined) => {
    setFilters((current) => {
      const next = { ...current, [key]: value || undefined };
      if (key === 'state_id' && value !== current.state_id) {
        delete next.district_id;
        delete next.taluk_id;
        delete next.village_id;
      }
      if (key === 'district_id' && value !== current.district_id) {
        delete next.taluk_id;
        delete next.village_id;
      }
      if (key === 'taluk_id' && value !== current.taluk_id) {
        delete next.village_id;
      }
      return next;
    });
  };

  const resetFilters = () => setFilters({});

  const exportCsv = () => {
    const data = dashboardQuery.data;
    if (!data) return;

    const rows = [
      ['Section', 'Metric', 'Value'],
      ['Summary', 'Total land records', data.summary.totalLandRecords],
      ['Summary', 'Active records', data.summary.activeRecords],
      ['Summary', 'Pending records', data.summary.pendingRecords],
      ['Summary', 'Approved records', data.summary.approvedRecords],
      ['Summary', 'Rejected records', data.summary.rejectedRecords],
      ['Summary', 'Total documents', data.summary.totalDocuments],
      ['Summary', 'Pending verification tasks', data.summary.pendingVerificationTasks],
      ['Summary', 'Duplicate candidates', data.summary.totalDuplicateCandidates],
      ['Summary', 'Risk assessments', data.summary.totalRiskAssessments],
      ['Summary', 'Alerts', data.summary.totalAlerts],
      ['Land records', 'Status breakdown', data.landRecords.byStatus.map((item) => `${item.label}:${item.value}`).join('; ')],
      ['Documents', 'Type breakdown', data.documents.byType.map((item) => `${item.label}:${item.value}`).join('; ')],
      ['Verification', 'Status breakdown', data.verification.byStatus.map((item) => `${item.label}:${item.value}`).join('; ')],
      ['Risk', 'Risk level breakdown', data.risk.byRiskLevel.map((item) => `${item.label}:${item.value}`).join('; ')],
      ['Monitoring', 'Alert status breakdown', data.monitoring.byStatus.map((item) => `${item.label}:${item.value}`).join('; ')],
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'landiq-analytics-report.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!hasPermission('analytics:read')) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>You do not have permission to view analytics.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const analyticsData = dashboardQuery.data as AnalyticsDashboardData | undefined;

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics & Reporting</h1>
          <p className="text-sm text-muted-foreground">Operational metrics derived from the live LAND-IQ database.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <Filter className="mr-2 h-4 w-4" /> Reset filters
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!analyticsData}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4" /> Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {filterOptionsQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Activity from</span>
                <Input type="date" value={filters.created_from ?? ''} onChange={(event) => updateFilter('created_from', event.target.value || undefined)} aria-label="Analytics start date" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Activity to</span>
                <Input type="date" value={filters.created_to ?? ''} onChange={(event) => updateFilter('created_to', event.target.value || undefined)} aria-label="Analytics end date" />
              </label>
              <Select value={getSelectValue(filters.state_id)} onValueChange={(value) => updateFilter('state_id', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {availableStates.map((state) => (
                    <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.district_id)} onValueChange={(value) => updateFilter('district_id', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="District" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All districts</SelectItem>
                  {filteredDistricts.map((district) => (
                    <SelectItem key={district.id} value={district.id}>{district.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.taluk_id)} onValueChange={(value) => updateFilter('taluk_id', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Taluk" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All taluks</SelectItem>
                  {filteredTaluks.map((taluk) => (
                    <SelectItem key={taluk.id} value={taluk.id}>{taluk.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.village_id)} onValueChange={(value) => updateFilter('village_id', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Village" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All villages</SelectItem>
                  {filteredVillages.map((village) => (
                    <SelectItem key={village.id} value={village.id}>{village.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.land_type)} onValueChange={(value) => updateFilter('land_type', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Land type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All land types</SelectItem>
                  {availableLandTypes.map((landType) => (
                    <SelectItem key={landType} value={landType}>{landType}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.record_status)} onValueChange={(value) => updateFilter('record_status', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Record status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All record statuses</SelectItem>
                  {availableRecordStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.verification_status)} onValueChange={(value) => updateFilter('verification_status', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Verification status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All verification statuses</SelectItem>
                  {availableVerificationStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.risk_level)} onValueChange={(value) => updateFilter('risk_level', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Risk level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risk levels</SelectItem>
                  {availableRiskLevels.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.alert_status)} onValueChange={(value) => updateFilter('alert_status', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Alert status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All alert statuses</SelectItem>
                  {availableAlertStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={getSelectValue(filters.alert_priority)} onValueChange={(value) => updateFilter('alert_priority', value === 'all' ? undefined : value)}>
                <SelectTrigger><SelectValue placeholder="Alert priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All alert priorities</SelectItem>
                  {availableAlertPriorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {dashboardQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load analytics</AlertTitle>
          <AlertDescription>{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'Please try again.'}</AlertDescription>
        </Alert>
      ) : null}

      {dashboardQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : analyticsData ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Land records" value={analyticsData.summary.totalLandRecords} description="Records in the active scope" icon={FileText} />
            <SummaryCard title="Active records" value={analyticsData.summary.activeRecords} description="Current active inventory" icon={Users} />
            <SummaryCard title="Pending verification" value={analyticsData.summary.pendingRecords} description="Records awaiting review" icon={ShieldAlert} />
            <SummaryCard title="Approved records" value={analyticsData.summary.approvedRecords} description="Verification approved" icon={TrendingUp} />
            <SummaryCard title="Documents" value={analyticsData.summary.totalDocuments} description="Stored documents" icon={FileText} />
            <SummaryCard title="Verification tasks" value={analyticsData.summary.totalVerificationTasks} description="Tasks in the database" icon={Activity} />
            <SummaryCard title="Risk assessments" value={analyticsData.summary.totalRiskAssessments} description="Recorded risk evaluations" icon={ShieldAlert} />
            <SummaryCard title="Alerts" value={analyticsData.summary.totalAlerts} description="Operational alerts" icon={BarChart3} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DistributionBlock title="Land record status" items={analyticsData.landRecords.byStatus} />
            <DistributionBlock title="Land type" items={analyticsData.landRecords.byLandType} />
            <DistributionBlock title="Verification status" items={analyticsData.verification.byStatus} />
            <DistributionBlock title="Duplicate status" items={analyticsData.duplicates.byStatus} />
            <DistributionBlock title="Risk level" items={analyticsData.risk.byRiskLevel} />
            <DistributionBlock title="Alert priority" items={analyticsData.monitoring.byPriority} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <TrendChart title="Records created over time" data={analyticsData.trends.recordsCreated} />
            <TrendChart title="Documents uploaded over time" data={analyticsData.trends.documentsUploaded} />
            <TrendChart title="Verification activity" data={analyticsData.trends.verificationActivity} />
            <TrendChart title="Alerts created over time" data={analyticsData.trends.alertsCreated} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DistributionBlock title="District record distribution" items={analyticsData.geography.recordsByDistrict} />
            <DistributionBlock title="Taluk record distribution" items={analyticsData.geography.recordsByTaluk} />
            <DistributionBlock title="Village record distribution" items={analyticsData.geography.recordsByVillage} />
            <DistributionBlock title="Verification workload by district" items={analyticsData.geography.verificationByDistrict} />
            <DistributionBlock title="Risk distribution by district" items={analyticsData.geography.riskByDistrict} />
            <DistributionBlock title="Alert distribution by district" items={analyticsData.geography.alertsByDistrict} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operational modules</CardTitle>
              <CardDescription>Quick navigation to the underlying records and review workflows.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm"><Link to="/land-records">Land Records</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/documents">Documents</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/verification">Verification</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/duplicates">Duplicates</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/risk">Risk Intelligence</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/monitoring">Monitoring</Link></Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No analytics data is available for the selected filters.</CardContent>
        </Card>
      )}
    </div>
  );
}
