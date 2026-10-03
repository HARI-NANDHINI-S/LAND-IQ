import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Check, Clock3, FileText, MapPin, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { monitoringService } from '@/services/monitoring/monitoringService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function priorityBadge(priority: string) {
  const colors: Record<string, string> = {
    CRITICAL: 'bg-rose-100 text-rose-800',
    HIGH: 'bg-orange-100 text-orange-800',
    MEDIUM: 'bg-amber-100 text-amber-800',
    LOW: 'bg-slate-100 text-slate-700',
  };
  return <Badge className={colors[priority] ?? 'bg-slate-100 text-slate-700'}>{priority}</Badge>;
}

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

function dateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

export default function AlertDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [actionMessage, setActionMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const alertQuery = useQuery({
    queryKey: ['monitoring-alert', id],
    queryFn: () => monitoringService.getAlertById(id!),
    enabled: !!id && hasPermission('monitoring:read'),
  });
  const contextQuery = useQuery({
    queryKey: ['monitoring-alert-context', id, alertQuery.data?.land_record_id, hasPermission('audit:read')],
    queryFn: () => monitoringService.getAlertContext(alertQuery.data!, hasPermission('audit:read')),
    enabled: !!alertQuery.data,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: 'acknowledge' | 'resolve') => {
      if (!hasPermission('monitoring:manage')) throw new Error('You do not have permission to manage alerts.');
      return action === 'acknowledge'
        ? monitoringService.acknowledgeAlert(id!)
        : monitoringService.resolveAlert(id!);
    },
    onSuccess: (_data, action) => {
      setActionMessage({ kind: 'success', text: action === 'acknowledge' ? 'Alert acknowledged.' : 'Alert resolved.' });
      void queryClient.invalidateQueries({ queryKey: ['monitoring-alert', id] });
      void queryClient.invalidateQueries({ queryKey: ['monitoring-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['monitoring-alert-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
    onError: (error) => setActionMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Alert update failed.' }),
  });

  if (!hasPermission('monitoring:read')) {
    return <div className="p-6"><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>You do not have permission to view monitoring alerts.</AlertDescription></Alert></div>;
  }
  if (alertQuery.isLoading) {
    return <div className="space-y-5 p-6"><Skeleton className="h-10 w-56" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>;
  }
  if (alertQuery.isError || !alertQuery.data) {
    return <div className="flex h-full flex-col items-center justify-center gap-4 p-6"><ShieldAlert className="h-12 w-12 text-destructive" /><h1 className="text-xl font-semibold">Alert unavailable</h1><p className="text-sm text-muted-foreground">{alertQuery.error instanceof Error ? alertQuery.error.message : 'This alert could not be loaded in your authorized scope.'}</p><Button onClick={() => navigate('/monitoring')}>Back to monitoring</Button></div>;
  }

  const alert = alertQuery.data;
  const record = alert.land_records;
  const context = contextQuery.data;
  const canManage = hasPermission('monitoring:manage');
  const hasRecordLink = Boolean(alert.land_record_id);

  return (
    <div className="flex h-full flex-col space-y-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/monitoring')} aria-label="Back to monitoring"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">{alert.title}</h1>{priorityBadge(alert.priority)}{statusBadge(alert.status)}</div>
            <p className="mt-1 text-sm text-muted-foreground">{alert.alert_type.replace(/_/g, ' ')} · Alert {alert.id.slice(0, 8)}</p>
          </div>
        </div>
        {canManage && alert.status !== 'RESOLVED' && (
          <div className="flex flex-wrap gap-2">
            {alert.status !== 'ACKNOWLEDGED' && <Button variant="outline" onClick={() => { setActionMessage(null); actionMutation.mutate('acknowledge'); }} disabled={actionMutation.isPending}><Check className="mr-2 h-4 w-4" /> Acknowledge</Button>}
            <Button onClick={() => { setActionMessage(null); actionMutation.mutate('resolve'); }} disabled={actionMutation.isPending}>Resolve alert</Button>
          </div>
        )}
      </div>

      {actionMessage && <Alert variant={actionMessage.kind === 'error' ? 'destructive' : 'default'}><AlertTitle>{actionMessage.kind === 'error' ? 'Action failed' : 'Updated'}</AlertTitle><AlertDescription>{actionMessage.text}</AlertDescription></Alert>}
      {contextQuery.isError && <Alert variant="destructive"><AlertTitle>Some related context could not be loaded</AlertTitle><AlertDescription>{contextQuery.error instanceof Error ? contextQuery.error.message : 'The alert itself is still available.'}</AlertDescription></Alert>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Alert summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap text-sm">{alert.description || 'No description was stored for this alert.'}</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Created</span><p className="font-medium">{dateTime(alert.created_at)}</p></div>
              <div><span className="text-muted-foreground">Last updated</span><p className="font-medium">{dateTime(alert.updated_at)}</p></div>
              <div><span className="text-muted-foreground">Acknowledged</span><p className="font-medium">{dateTime(alert.acknowledged_at)}</p></div>
              <div><span className="text-muted-foreground">Resolved</span><p className="font-medium">{dateTime(alert.resolved_at)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Related land record</CardTitle></CardHeader>
          <CardContent>
            {!hasRecordLink || !record ? <p className="text-sm text-muted-foreground">This alert has no linked land record.</p> : (
              <div className="space-y-3">
                <div><span className="text-sm text-muted-foreground">Record number</span><p className="font-medium">{record.record_number}</p></div>
                <div><span className="text-sm text-muted-foreground">Survey / patta</span><p className="font-medium">{record.survey_number} / {record.patta_number || '—'}</p></div>
                <div><span className="text-sm text-muted-foreground">Location</span><p className="font-medium">{record.villages?.name || '—'} · {record.taluks?.name || '—'} · {record.districts?.name || '—'}</p></div>
                <Button asChild variant="outline" size="sm"><Link to={`/land-records/${record.id}`}>Open land record <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {hasRecordLink && <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Related risk assessments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!context?.riskAssessments.length ? <p className="text-sm text-muted-foreground">No risk assessments are linked to this land record.</p> : context.riskAssessments.map((risk: any) => (
              <div key={risk.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><div className="font-medium">{risk.risk_level || 'Unrated'} · {risk.status || 'No status'}</div><div className="text-xs text-muted-foreground">Calculated {dateTime(risk.calculated_at)}</div></div><Button asChild size="sm" variant="outline"><Link to={`/risk/${risk.id}`}>Open assessment</Link></Button></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Related documents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!context?.documents.length ? <p className="text-sm text-muted-foreground">No documents are linked to this land record.</p> : context.documents.map((document: any) => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><div className="font-medium">{document.original_filename}</div><div className="text-xs text-muted-foreground">{document.document_type} · {document.verification_status}</div></div><Button asChild size="sm" variant="outline"><Link to={`/documents/${document.id}`}>Open document</Link></Button></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Related verification tasks</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!context?.verificationTasks.length ? <p className="text-sm text-muted-foreground">No verification tasks are linked to this land record.</p> : context.verificationTasks.map((task: any) => (
              <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><div className="font-medium">{task.status}</div><div className="text-xs text-muted-foreground">Priority {task.priority || '—'} · {dateTime(task.created_at)}</div></div><Button asChild size="sm" variant="outline"><Link to={`/verification/${task.id}`}>Open task</Link></Button></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Related duplicate candidates</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!context?.duplicateCandidates.length ? <p className="text-sm text-muted-foreground">No duplicate candidates are linked to this land record.</p> : context.duplicateCandidates.map((candidate: any) => (
              <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><div className="font-medium">Candidate · {candidate.status}</div><div className="text-xs text-muted-foreground">Similarity {candidate.similarity_score ?? 'not stored'}</div></div><Button asChild size="sm" variant="outline"><Link to={`/duplicates/${candidate.id}`}>Open candidate</Link></Button></div>
            ))}
          </CardContent>
        </Card>
      </div>}

      {hasRecordLink && <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Recent record changes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!context?.changes.length ? <p className="text-sm text-muted-foreground">No recorded changes are available for this land record.</p> : context.changes.map((change: any) => (
            <div key={change.id} className="grid gap-1 rounded-md border p-3 sm:grid-cols-[1fr_auto]"><div><div className="font-medium">{change.entity_type} · {change.field_name}</div><div className="text-sm text-muted-foreground">{change.old_value ?? '—'} → {change.new_value ?? '—'}</div>{change.reason && <p className="mt-1 text-sm">{change.reason}</p>}</div><div className="text-xs text-muted-foreground">{change.change_priority || 'LOW'} · {dateTime(change.changed_at)}</div></div>
          ))}
        </CardContent>
      </Card>}

      <Card>
        <CardHeader><CardTitle>Alert history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {contextQuery.isLoading ? <Skeleton className="h-16 w-full" /> : !context?.history.length ? <p className="text-sm text-muted-foreground">No alert-specific audit entries are visible in your scope.</p> : context.history.map((entry: any) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"><div><div className="font-medium">{entry.action}</div><div className="text-xs text-muted-foreground">{entry.actor_role || 'Actor not recorded'}</div></div><span className="text-sm text-muted-foreground">{dateTime(entry.created_at)}</span></div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}