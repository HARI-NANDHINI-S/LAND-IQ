import { useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Bell, ChevronLeft, ChevronRight, Eye, ListPlus, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { monitoringService } from '@/services/monitoring/monitoringService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 10;

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    NEW: 'bg-rose-100 text-rose-800',
    ACKNOWLEDGED: 'bg-blue-100 text-blue-800',
    UNDER_REVIEW: 'bg-amber-100 text-amber-800',
    RESOLVED: 'bg-emerald-100 text-emerald-800',
    ESCALATED: 'bg-orange-100 text-orange-800',
  };
  return <Badge className={colors[status] ?? 'bg-slate-100 text-slate-700'}>{status.replace(/_/g, ' ')}</Badge>;
}

function priorityBadge(priority: string) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-rose-100 text-rose-800',
    HIGH: 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-amber-100 text-amber-800',
    LOW: 'bg-slate-100 text-slate-700',
  };
  return <Badge className={colors[priority] ?? 'bg-slate-100 text-slate-700'}>{priority}</Badge>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function MonitoringPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canRead = hasPermission('monitoring:read');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [alertType, setAlertType] = useState('ALL');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);

  const alertQuery = useQuery({
    queryKey: ['monitoring-alerts', { search: deferredSearch, priority, status, alertType, page }],
    queryFn: () => monitoringService.getAlerts({
      search: deferredSearch,
      priority: priority === 'ALL' ? undefined : priority,
      status: status === 'ALL' ? undefined : status,
      alert_type: alertType === 'ALL' ? undefined : alertType,
      page,
      pageSize: PAGE_SIZE,
    }),
    enabled: hasPermission('monitoring:read'),
  });
  const statsQuery = useQuery({
    queryKey: ['monitoring-alert-stats'],
    queryFn: () => monitoringService.getAlertStats(),
    enabled: hasPermission('monitoring:read'),
  });

  useEffect(() => {
    if (!canRead) return;
    const channel = supabase
      .channel('monitoring-alert-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['monitoring-alerts'] });
        void queryClient.invalidateQueries({ queryKey: ['monitoring-alert-stats'] });
        void queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canRead, queryClient]);

  if (!hasPermission('monitoring:read')) {
    return <div className="p-6"><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>You do not have permission to view monitoring alerts.</AlertDescription></Alert></div>;
  }

  const totalPages = Math.max(1, Math.ceil((alertQuery.data?.total ?? 0) / PAGE_SIZE));
  const resetPage = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BhoomiWatch Monitoring</h1>
          <p className="text-sm text-muted-foreground">Review alerts and activity visible in your authorized scope.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission('watchlist:read') && <Button asChild variant="outline"><Link to="/monitoring/watchlists"><ListPlus className="mr-2 h-4 w-4" /> Watchlists</Link></Button>}
          <Button asChild variant="outline"><Link to="/notifications"><Bell className="mr-2 h-4 w-4" /> Notifications</Link></Button>
        </div>
      </div>

      {statsQuery.isError && <Alert variant="destructive"><AlertTitle>Unable to load alert summary</AlertTitle><AlertDescription>{statsQuery.error instanceof Error ? statsQuery.error.message : 'Please try again.'}</AlertDescription></Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active alerts', value: statsQuery.data?.active, icon: Activity },
          { label: 'Critical unresolved', value: statsQuery.data?.critical, icon: ShieldAlert },
          { label: 'Unacknowledged', value: statsQuery.data?.unacknowledged, icon: Eye },
          { label: 'Resolved', value: statsQuery.data?.resolved, icon: Bell },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>{statsQuery.isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-semibold">{value ?? 0}</div>}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div><CardTitle>Alerts</CardTitle><p className="mt-1 text-sm text-muted-foreground">Stored alert records only. This view does not generate alerts.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative sm:col-span-2 xl:col-span-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search title or description" className="pl-9" aria-label="Search alerts" />
            </div>
            <Select value={priority} onValueChange={resetPage(setPriority)}>
              <SelectTrigger aria-label="Filter by severity"><SelectValue placeholder="All severities" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All severities</SelectItem><SelectItem value="CRITICAL">Critical</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="LOW">Low</SelectItem></SelectContent>
            </Select>
            <Select value={status} onValueChange={resetPage(setStatus)}>
              <SelectTrigger aria-label="Filter by status"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="NEW">New</SelectItem><SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem><SelectItem value="UNDER_REVIEW">Under review</SelectItem><SelectItem value="ESCALATED">Escalated</SelectItem><SelectItem value="RESOLVED">Resolved</SelectItem></SelectContent>
            </Select>
            <Select value={alertType} onValueChange={resetPage(setAlertType)}>
              <SelectTrigger aria-label="Filter by alert type"><SelectValue placeholder="All alert types" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All alert types</SelectItem><SelectItem value="RISK_ALERT">Risk alert</SelectItem><SelectItem value="CRITICAL_CHANGE">Critical change</SelectItem><SelectItem value="DUPLICATE_ALERT">Duplicate alert</SelectItem><SelectItem value="VERIFICATION_ALERT">Verification alert</SelectItem><SelectItem value="WATCHLIST_UPDATE">Watchlist update</SelectItem><SelectItem value="SYSTEM_ALERT">System alert</SelectItem></SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {alertQuery.isError ? (
            <Alert variant="destructive"><AlertTitle>Unable to load alerts</AlertTitle><AlertDescription>{alertQuery.error instanceof Error ? alertQuery.error.message : 'Please try again.'}</AlertDescription></Alert>
          ) : alertQuery.isLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : !alertQuery.data?.data.length ? (
            <div className="py-12 text-center"><Activity className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" /><p className="font-medium">No alerts found</p><p className="mt-1 text-sm text-muted-foreground">No stored alerts match the selected filters.</p></div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow><TableHead>Severity</TableHead><TableHead>Alert</TableHead><TableHead>Type</TableHead><TableHead>Related record</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Open</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {alertQuery.data.data.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>{priorityBadge(alert.priority)}</TableCell>
                        <TableCell className="min-w-56"><div className="font-medium">{alert.title}</div><div className="max-w-sm truncate text-xs text-muted-foreground">{alert.description || 'No description'}</div></TableCell>
                        <TableCell className="whitespace-nowrap">{alert.alert_type.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{alert.land_records ? <Link className="font-medium text-primary hover:underline" to={`/land-records/${alert.land_records.id}`}>{alert.land_records.record_number}</Link> : <span className="text-muted-foreground">Not linked</span>}</TableCell>
                        <TableCell>{statusBadge(alert.status)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(alert.created_at)}</TableCell>
                        <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link to={`/monitoring/alerts/${alert.id}`}>Details</Link></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">{alertQuery.data.total} alert{alertQuery.data.total === 1 ? '' : 's'} · Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}