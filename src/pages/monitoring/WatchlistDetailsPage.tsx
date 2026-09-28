import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, FileText, MapPin, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { monitoringService } from '@/services/monitoring/monitoringService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

export default function WatchlistDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const canRead = hasPermission('watchlist:read');
  const canManage = hasPermission('watchlist:manage');

  const entryQuery = useQuery({
    queryKey: ['watchlist-entry', id],
    queryFn: () => monitoringService.getWatchlistById(id!),
    enabled: canRead && !!id,
  });
  const recordId = entryQuery.data?.land_record_id as string | undefined;
  const contextQuery = useQuery({
    queryKey: ['watchlist-entry-context', recordId],
    queryFn: () => monitoringService.getWatchlistContext(recordId!),
    enabled: !!recordId,
  });

  const invalidateEntry = () => {
    void queryClient.invalidateQueries({ queryKey: ['watchlist-entry', id] });
    void queryClient.invalidateQueries({ queryKey: ['watchlists'] });
  };
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!hasPermission('watchlist:manage')) throw new Error('You do not have permission to manage watchlists.');
      const entry = entryQuery.data;
      if (!entry) throw new Error('Watchlist entry is unavailable.');
      return monitoringService.updateWatchlist(id!, {
        reason: (reason ?? entry.reason ?? '').trim() || null,
        status: status ?? entry.status,
      });
    },
    onSuccess: () => { setActionError('Saved changes to the watchlist entry.'); invalidateEntry(); },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'Could not update watchlist entry.'),
  });
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!hasPermission('watchlist:manage')) throw new Error('You do not have permission to manage watchlists.');
      return monitoringService.deleteWatchlist(id!);
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['watchlists'] }); navigate('/monitoring/watchlists'); },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'Could not delete watchlist entry.'),
  });

  if (!canRead) return <div className="p-6"><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>You do not have permission to view watchlists.</AlertDescription></Alert></div>;
  if (entryQuery.isLoading) return <div className="space-y-5 p-6"><Skeleton className="h-10 w-56" /><Skeleton className="h-48 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (entryQuery.isError || !entryQuery.data) return <div className="flex h-full flex-col items-center justify-center gap-4 p-6"><MapPin className="h-12 w-12 text-destructive" /><h1 className="text-xl font-semibold">Watchlist entry unavailable</h1><p className="text-sm text-muted-foreground">{entryQuery.error instanceof Error ? entryQuery.error.message : 'This entry may not exist or may be outside your access scope.'}</p><Button onClick={() => navigate('/monitoring/watchlists')}>Back to watchlists</Button></div>;

  const entry = entryQuery.data;
  const record = entry.land_records;
  const context = contextQuery.data;

  return (
    <div className="flex h-full flex-col space-y-6 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"><Button asChild variant="outline" size="icon"><Link to="/monitoring/watchlists" aria-label="Back to watchlists"><ArrowLeft className="h-4 w-4" /></Link></Button><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Monitored land record</h1><Badge className={entry.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{entry.status}</Badge></div><p className="text-sm text-muted-foreground">Watchlist entry {entry.id.slice(0, 8)}</p></div></div>
        {canManage && <div className="flex flex-wrap gap-2"><Button onClick={() => { setActionError(''); updateMutation.mutate(); }} disabled={updateMutation.isPending}>Save changes</Button><Dialog><DialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Remove</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Remove watchlist entry?</DialogTitle><DialogDescription>This deletes this user's watchlist entry. The land record itself is not changed.</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={() => { setActionError(''); deleteMutation.mutate(); }} disabled={deleteMutation.isPending}>Remove entry</Button></DialogFooter></DialogContent></Dialog></div>}
      </div>

      {actionError && <Alert variant={actionError.startsWith('Saved') ? 'default' : 'destructive'}><AlertTitle>{actionError.startsWith('Saved') ? 'Updated' : 'Action failed'}</AlertTitle><AlertDescription>{actionError}</AlertDescription></Alert>}
      {contextQuery.isError && <Alert variant="destructive"><AlertTitle>Related context unavailable</AlertTitle><AlertDescription>{contextQuery.error instanceof Error ? contextQuery.error.message : 'The watchlist entry is still available.'}</AlertDescription></Alert>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Land record</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Record number</span><p className="font-medium">{record?.record_number || 'Record unavailable'}</p></div>
            <div><span className="text-sm text-muted-foreground">Survey / subdivision</span><p className="font-medium">{record?.survey_number || '—'} / {record?.subdivision_number || '—'}</p></div>
            <div><span className="text-sm text-muted-foreground">Patta number</span><p className="font-medium">{record?.patta_number || '—'}</p></div>
            <div><span className="text-sm text-muted-foreground">Location</span><p className="font-medium">{record?.villages?.name || '—'} · {record?.taluks?.name || '—'} · {record?.districts?.name || '—'}</p></div>
            <div><span className="text-sm text-muted-foreground">Record status / verification</span><p className="font-medium">{record?.record_status || '—'} / {record?.verification_status || '—'}</p></div>
            {record && <Button asChild variant="outline" size="sm"><Link to={`/land-records/${record.id}`}>Open land record <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Watchlist settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">Added {new Date(entry.created_at).toLocaleString()} · Updated {new Date(entry.updated_at).toLocaleString()}</div>
            {canManage ? <>
              <div className="space-y-2"><label className="text-sm font-medium">Status</label><Select value={status ?? entry.status} onValueChange={setStatus}><SelectTrigger aria-label="Watchlist status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="RESOLVED">Resolved</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><label className="text-sm font-medium" htmlFor="watchlist-edit-reason">Reason</label><Textarea id="watchlist-edit-reason" value={reason ?? entry.reason ?? ''} onChange={(event) => setReason(event.target.value)} rows={4} /></div>
            </> : <p className="whitespace-pre-wrap text-sm">{entry.reason || 'No reason was recorded.'}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Risk assessments</CardTitle></CardHeader><CardContent className="space-y-3">{contextQuery.isLoading ? <Skeleton className="h-14 w-full" /> : !context?.riskAssessments.length ? <p className="text-sm text-muted-foreground">No risk assessments are linked to this record.</p> : context.riskAssessments.map((risk: any) => <div key={risk.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><span className="text-sm">{risk.risk_level || 'Unrated'} · {risk.status || 'No status'}</span><Button asChild size="sm" variant="outline"><Link to={`/risk/${risk.id}`}>Open</Link></Button></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle></CardHeader><CardContent className="space-y-3">{contextQuery.isLoading ? <Skeleton className="h-14 w-full" /> : !context?.documents.length ? <p className="text-sm text-muted-foreground">No documents are linked to this record.</p> : context.documents.map((document: any) => <div key={document.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><span className="min-w-0 truncate text-sm">{document.original_filename}</span><Button asChild size="sm" variant="outline"><Link to={`/documents/${document.id}`}>Open</Link></Button></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Verification tasks</CardTitle></CardHeader><CardContent className="space-y-3">{contextQuery.isLoading ? <Skeleton className="h-14 w-full" /> : !context?.verificationTasks.length ? <p className="text-sm text-muted-foreground">No verification tasks are linked to this record.</p> : context.verificationTasks.map((task: any) => <div key={task.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><span className="text-sm">{task.status} · {task.priority || '—'}</span><Button asChild size="sm" variant="outline"><Link to={`/verification/${task.id}`}>Open</Link></Button></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Duplicate candidates</CardTitle></CardHeader><CardContent className="space-y-3">{contextQuery.isLoading ? <Skeleton className="h-14 w-full" /> : !context?.duplicateCandidates.length ? <p className="text-sm text-muted-foreground">No duplicate candidates are linked to this record.</p> : context.duplicateCandidates.map((candidate: any) => <div key={candidate.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><span className="text-sm">{candidate.status} · Similarity {candidate.similarity_score ?? '—'}</span><Button asChild size="sm" variant="outline"><Link to={`/duplicates/${candidate.id}`}>Open</Link></Button></div>)}</CardContent></Card>
      </div>
    </div>
  );
}