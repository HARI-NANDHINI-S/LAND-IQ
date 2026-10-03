import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  CheckCheck,
  FileText,
  Files,
  Gauge,
  Map,
  Plus,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/utils/errorHandler';
import { CommandCenterHero } from '@/components/dashboard/CommandCenterHero';
import { StatCard } from '@/components/dashboard/StatCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const scopedStateId = user?.profile?.state_id ?? undefined;
  const scopedDistrictId = user?.profile?.district_id ?? undefined;

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-overview', user?.id, scopedStateId, scopedDistrictId],
    queryFn: async () => {
      const scopedLandRecordQuery = supabase
        .from('land_records')
        .select('id, record_number, survey_number, patta_number, verification_status, record_status, land_type, created_at, district_id, state_id, village_id, districts(name), taluks(name), villages(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(5);

      if (scopedStateId) scopedLandRecordQuery.eq('state_id', scopedStateId);
      if (scopedDistrictId) scopedLandRecordQuery.eq('district_id', scopedDistrictId);

      const [landRecords, documents, verification, duplicates, risk, alerts, watchlists, recentActivity] = await Promise.all([
        hasPermission('land_record:read')
          ? scopedLandRecordQuery
          : Promise.resolve({ data: [], error: null, count: 0 }),
        hasPermission('document:read')
          ? supabase
              .from('documents')
              .select('id, processing_status, verification_status, created_at', { count: 'exact', head: true })
          : Promise.resolve({ data: [], error: null, count: 0 }),
        hasPermission('verification:read')
          ? supabase
              .from('verification_tasks')
              .select('id, status, priority, created_at', { count: 'exact', head: true })
          : Promise.resolve({ data: [], error: null, count: 0 }),
        hasPermission('duplicate:read')
          ? supabase
              .from('duplicate_candidates')
              .select('id, status', { count: 'exact', head: true })
          : Promise.resolve({ data: [], error: null, count: 0 }),
        hasPermission('risk:read')
          ? supabase
              .from('risk_assessments')
              .select('id, risk_level, status', { count: 'exact', head: true })
          : Promise.resolve({ data: [], error: null, count: 0 }),
        hasPermission('monitoring:read')
          ? supabase
              .from('alerts')
              .select('id, status, priority', { count: 'exact', head: true })
          : Promise.resolve({ data: [], error: null, count: 0 }),
        hasPermission('watchlist:read')
          ? supabase
              .from('watchlists')
              .select('id', { count: 'exact', head: true })
          : Promise.resolve({ data: [], error: null, count: 0 }),
        hasPermission('audit:read')
          ? supabase
              .from('audit_logs')
              .select('id, action, entity_type, entity_id, created_at, profiles!actor_id(full_name)')
              .order('created_at', { ascending: false })
              .limit(6)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const errors = [
        landRecords.error,
        documents.error,
        verification.error,
        duplicates.error,
        risk.error,
        alerts.error,
        watchlists.error,
        recentActivity.error,
      ].filter(Boolean);
      if (errors.length > 0) {
        throw toAppError(errors[0]);
      }

      const scopedRecordIds = (landRecords.data ?? []).map((record) => record.id as string);

      const pendingVerification = hasPermission('verification:read')
        ? await supabase
            .from('verification_tasks')
            .select('id', { count: 'exact', head: true })
            .in('status', ['QUEUED', 'ASSIGNED'])
        : { count: 0, error: null }

      const highRisk = hasPermission('risk:read')
        ? await supabase
            .from('risk_assessments')
            .select('id', { count: 'exact', head: true })
            .in('risk_level', ['HIGH', 'CRITICAL'])
        : { count: 0, error: null }

      const pendingDuplicates = hasPermission('duplicate:read')
        ? await supabase
            .from('duplicate_candidates')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'PENDING')
        : { count: 0, error: null }

      const activeAlerts = hasPermission('monitoring:read')
        ? await supabase
            .from('alerts')
            .select('id', { count: 'exact', head: true })
            .neq('status', 'RESOLVED')
        : { count: 0, error: null }

      const countError = [pendingVerification.error, highRisk.error, pendingDuplicates.error, activeAlerts.error].find(Boolean);
      if (countError) throw toAppError(countError);

      const landRecordsCount = hasPermission('land_record:read') ? (landRecords.count ?? (landRecords.data?.length ?? 0)) : 0;
      const totalDocuments = hasPermission('document:read') ? (documents.count ?? 0) : 0;
      const totalVerification = hasPermission('verification:read') ? (verification.count ?? 0) : 0;
      const totalDuplicates = hasPermission('duplicate:read') ? (duplicates.count ?? 0) : 0;
      const totalRisk = hasPermission('risk:read') ? (risk.count ?? 0) : 0;
      const totalAlerts = hasPermission('monitoring:read') ? (alerts.count ?? 0) : 0;
      const totalWatchlists = hasPermission('watchlist:read') ? (watchlists.count ?? 0) : 0;

      const priorityWork = [] as Array<{ title: string; subtitle: string; href: string; meta: string[] }>

      if (hasPermission('verification:read')) {
        const pendingTasks = await supabase
          .from('verification_tasks')
          .select('id, status, priority, created_at, land_record_id, land_records(id, record_number, survey_number)')
          .in('status', ['QUEUED', 'ASSIGNED'])
          .order('created_at', { ascending: false })
          .limit(3);
        if (pendingTasks.error) throw pendingTasks.error;
        for (const task of pendingTasks.data ?? []) {
          const linkedRecord = Array.isArray(task.land_records) ? task.land_records[0] : task.land_records;
          priorityWork.push({
            title: linkedRecord?.record_number || task.land_record_id || 'Verification task',
            subtitle: 'Pending verification',
            href: '/verification',
            meta: [task.priority || 'Priority unset', task.status || 'Queued'],
          });
        }
      }

      if (hasPermission('risk:read')) {
        const highRiskRows = await supabase
          .from('risk_assessments')
          .select('id, risk_level, status, land_record_id, land_records(id, record_number, survey_number)')
          .in('risk_level', ['HIGH', 'CRITICAL'])
          .neq('status', 'RESOLVED')
          .order('calculated_at', { ascending: false })
          .limit(3);
        if (highRiskRows.error) throw highRiskRows.error;
        for (const row of highRiskRows.data ?? []) {
          const linkedRecord = Array.isArray(row.land_records) ? row.land_records[0] : row.land_records;
          priorityWork.push({
            title: linkedRecord?.record_number || row.land_record_id || 'Risk assessment',
            subtitle: 'High-risk record',
            href: '/risk',
            meta: [row.risk_level || 'Unknown', row.status || 'Open'],
          });
        }
      }

      if (hasPermission('duplicate:read')) {
        const duplicateRows = await supabase
          .from('duplicate_candidates')
          .select('id, status, similarity_score, record_a_id, record_b_id')
          .in('status', ['PENDING', 'UNDER_REVIEW'])
          .order('created_at', { ascending: false })
          .limit(3);
        if (duplicateRows.error) throw duplicateRows.error;
        for (const row of duplicateRows.data ?? []) {
          priorityWork.push({
            title: `Candidate ${row.id.slice(0, 8)}`,
            subtitle: 'Duplicate review pending',
            href: '/duplicates',
            meta: [row.status || 'Pending', `${row.similarity_score ?? 0}%`],
          });
        }
      }

      if (hasPermission('monitoring:read')) {
        const alertRows = await supabase
          .from('alerts')
          .select('id, priority, status, title, land_record_id')
          .in('priority', ['CRITICAL', 'HIGH'])
          .neq('status', 'RESOLVED')
          .order('created_at', { ascending: false })
          .limit(3);
        if (alertRows.error) throw alertRows.error;
        for (const row of alertRows.data ?? []) {
          priorityWork.push({
            title: row.title || 'Alert',
            subtitle: 'Active alert',
            href: '/monitoring',
            meta: [row.priority || 'Unknown', row.status || 'Open'],
          });
        }
      }

      const dedupedPriority = priorityWork.slice(0, 6);

      const recentRecords = (landRecords.data ?? []).slice(0, 5).map((record) => {
        const row = record as Record<string, any>;
        const villageName = Array.isArray(row.villages) ? row.villages[0]?.name : row.villages?.name;
        const talukName = Array.isArray(row.taluks) ? row.taluks[0]?.name : row.taluks?.name;

        return {
          id: row.id,
          record_number: row.record_number,
          survey_number: row.survey_number,
          patta_number: row.patta_number,
          verification_status: row.verification_status,
          record_status: row.record_status,
          location: [villageName, talukName].filter(Boolean).join(', '),
          created_at: row.created_at,
        };
      });

      return {
        totals: {
          landRecords: landRecordsCount,
          documents: totalDocuments,
          verification: totalVerification,
          duplicates: totalDuplicates,
          risk: totalRisk,
          alerts: totalAlerts,
          watchlists: totalWatchlists,
          pendingVerification: pendingVerification.count ?? 0,
          highRisk: highRisk.count ?? 0,
          activeAlerts: activeAlerts.count ?? 0,
          pendingDuplicates: pendingDuplicates.count ?? 0,
        },
        recentRecords,
        recentActivity: recentActivity.data ?? [],
        priorityWork: dedupedPriority,
        analyticsSummary: hasPermission('analytics:read') ? {
          summary: {
            totalLandRecords: landRecordsCount,
            totalDocuments,
            pendingVerificationTasks: pendingVerification.count ?? 0,
            totalDuplicateCandidates: totalDuplicates,
            activeAlerts: activeAlerts.count ?? 0,
          },
        } : null,
        scopedRecordIds,
      };
    },
  });

  const summaryCards = useMemo(() => {
    if (!dashboardQuery.data) return [];

    const cards = [] as Array<{ title: string; value: number; description: string; icon: typeof FileText; href: string; permission: boolean; tone?: 'amber' | 'rose' | 'orange' | 'blue' | 'emerald' }>; 

    if (hasPermission('land_record:read')) {
      cards.push({ title: 'Land Records', value: dashboardQuery.data.totals.landRecords, description: 'Total records in scope', icon: FileText, href: '/land-records', permission: true, tone: 'blue' });
    }
    if (hasPermission('document:read')) {
      cards.push({ title: 'Documents', value: dashboardQuery.data.totals.documents, description: 'Uploaded documents', icon: Files, href: '/documents', permission: true, tone: 'emerald' });
    }
    if (hasPermission('verification:read')) {
      cards.push({ title: 'Verification', value: dashboardQuery.data.totals.pendingVerification, description: 'Pending review', icon: CheckCheck, href: '/verification', permission: true, tone: 'amber' });
    }
    if (hasPermission('duplicate:read')) {
      cards.push({ title: 'Duplicates', value: dashboardQuery.data.totals.pendingDuplicates, description: 'Candidates awaiting review', icon: Users, href: '/duplicates', permission: true, tone: 'orange' });
    }
    if (hasPermission('risk:read')) {
      cards.push({ title: 'Risk', value: dashboardQuery.data.totals.highRisk, description: 'High-risk assessments', icon: ShieldAlert, href: '/risk', permission: true, tone: 'rose' });
    }
    if (hasPermission('monitoring:read')) {
      cards.push({ title: 'Alerts', value: dashboardQuery.data.totals.activeAlerts, description: 'Active alerts', icon: Bell, href: '/monitoring', permission: true, tone: 'orange' });
    }
    if (hasPermission('watchlist:read')) {
      cards.push({ title: 'Watchlists', value: dashboardQuery.data.totals.watchlists, description: 'Authorized watchlist items', icon: Activity, href: '/monitoring/watchlists', permission: true, tone: 'blue' });
    }

    return cards;
  }, [dashboardQuery.data, hasPermission]);

  const quickActions = [
    hasPermission('land_record:create') ? { label: 'Add Land Record', href: '/land-records/new', icon: Plus } : null,
    hasPermission('document:create') ? { label: 'Upload Document', href: '/documents', icon: Files } : null,
    hasPermission('verification:read') ? { label: 'Open Verification', href: '/verification', icon: CheckCheck } : null,
    hasPermission('duplicate:read') ? { label: 'Review Duplicates', href: '/duplicates', icon: Users } : null,
    hasPermission('risk:read') ? { label: 'Investigate Risk', href: '/risk', icon: ShieldAlert } : null,
    hasPermission('monitoring:read') ? { label: 'View Monitoring', href: '/monitoring', icon: Bell } : null,
    hasPermission('land_record:read') ? { label: 'Open GIS', href: '/gis', icon: Map } : null,
    hasPermission('analytics:read') ? { label: 'Open Analytics', href: '/analytics', icon: Gauge } : null,
    hasPermission('assistant:use') ? { label: 'Ask BhoomiVoice', href: '/bhoomi-voice', icon: Bot } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Plus }>;

  const isLoading = dashboardQuery.isLoading;
  const hasError = dashboardQuery.isError;

  return (
    <div className="landiq-page flex-1 space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Button variant="outline" size="sm" onClick={() => void dashboardQuery.refetch()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <CommandCenterHero />

      {hasError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load dashboard data</AlertTitle>
          <AlertDescription>{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'The dashboard could not load the latest operational data.'}</AlertDescription>
        </Alert>
      )}

      {summaryCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card, index) => {
            const CardIcon = card.icon;
            return (
              <Link key={card.title} to={card.href} className="block" style={{ animationDelay: `${index * 80}ms` }}>
                <StatCard
                  title={card.title}
                  value={isLoading ? undefined : card.value}
                  icon={<CardIcon className={card.tone === 'amber' ? 'text-amber-500' : card.tone === 'rose' ? 'text-rose-500' : card.tone === 'orange' ? 'text-orange-500' : card.tone === 'emerald' ? 'text-emerald-500' : 'text-blue-500'} />}
                  description={card.description}
                  loading={isLoading}
                  className="landiq-fade-up"
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You do not currently have permission to view any dashboard metrics in this scope.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="landiq-panel landiq-fade-up">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Priority Work</CardTitle>
              <CardDescription>Live operational items requiring attention.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/analytics">Open analytics</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !dashboardQuery.data?.priorityWork.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No priority work is currently visible in your authorized scope.</div>
            ) : (
              <div className="space-y-3">
                {dashboardQuery.data.priorityWork.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="landiq-activity-item flex items-start justify-between gap-3 rounded-xl border border-border/80 bg-background/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {item.meta.map((metaItem) => (
                        <Badge key={`${item.title}-${metaItem}`} variant="secondary" className="text-[10px] uppercase tracking-wide">
                          {metaItem}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="landiq-panel landiq-fade-up">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Authorized tasks and module entry points.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {quickActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quick actions are available for your current role.</p>
            ) : (
              quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button key={action.href} asChild variant="outline" className="landiq-quick-action justify-start">
                    <Link to={action.href}>
                      <Icon className="mr-2 h-4 w-4" /> {action.label}
                    </Link>
                  </Button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="landiq-panel landiq-fade-up">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Records</CardTitle>
              <CardDescription>Latest records in the current scope.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/land-records">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : !dashboardQuery.data?.recentRecords.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No recent records were found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardQuery.data.recentRecords.map((record) => (
                    <TableRow key={record.id} className="landiq-table-row">
                      <TableCell>
                        <Link to={`/land-records/${record.id}`} className="font-medium text-primary hover:underline">
                          {record.record_number || record.survey_number}
                        </Link>
                        <div className="text-xs text-muted-foreground">{record.patta_number || 'No patta number'}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{record.location || 'Unknown location'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatLabel(record.verification_status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {hasPermission('audit:read') && <Card className="landiq-panel landiq-fade-up">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system events and field actions recorded in the database.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : !dashboardQuery.data?.recentActivity.length ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No recent activity is available in this scope.</div>
            ) : (
              <div className="space-y-3">
                {dashboardQuery.data.recentActivity.map((entry) => {
                  const actor = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
                  return (
                    <div key={entry.id} className="landiq-activity-item rounded-xl border border-border/80 bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{formatLabel(entry.action)}</p>
                        <Badge variant="outline">{entry.entity_type}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {actor?.full_name ? `by ${actor.full_name}` : 'System event'} • {formatDate(entry.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>}
      </div>

      {hasPermission('analytics:read') && dashboardQuery.data?.analyticsSummary && (
        <Card className="landiq-panel landiq-fade-up">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Analytics Snapshot</CardTitle>
              <CardDescription>Short summary from the live analytics dashboard.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/analytics">Open full analytics</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="landiq-metric-box rounded-xl border border-border/80 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Land records</p>
                <p className="mt-2 text-2xl font-semibold">{dashboardQuery.data.analyticsSummary.summary.totalLandRecords}</p>
              </div>
              <div className="landiq-metric-box rounded-xl border border-border/80 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pending verification</p>
                <p className="mt-2 text-2xl font-semibold">{dashboardQuery.data.analyticsSummary.summary.pendingVerificationTasks}</p>
              </div>
              <div className="landiq-metric-box rounded-xl border border-border/80 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Duplicate candidates</p>
                <p className="mt-2 text-2xl font-semibold">{dashboardQuery.data.analyticsSummary.summary.totalDuplicateCandidates}</p>
              </div>
              <div className="landiq-metric-box rounded-xl border border-border/80 bg-background/60 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Active alerts</p>
                <p className="mt-2 text-2xl font-semibold">{dashboardQuery.data.analyticsSummary.summary.activeAlerts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
