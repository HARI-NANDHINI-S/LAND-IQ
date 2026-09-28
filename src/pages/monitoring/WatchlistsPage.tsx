import { useDeferredValue, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, ListPlus, Search } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { landRecordService } from '@/services/land-records/landRecordService';
import { monitoringService } from '@/services/monitoring/monitoringService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const PAGE_SIZE = 10;

export default function WatchlistsPage() {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  const [recordId, setRecordId] = useState('');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const deferredSearch = useDeferredValue(search);
  const deferredRecordSearch = useDeferredValue(recordSearch);
  const canRead = hasPermission('watchlist:read');
  const canManage = hasPermission('watchlist:manage');

  const watchlistQuery = useQuery({
    queryKey: ['watchlists', user?.id, { search: deferredSearch, status, page }],
    queryFn: () => monitoringService.getWatchlists(user!.id, { search: deferredSearch, status: status === 'ALL' ? undefined : status, page, pageSize: PAGE_SIZE }),
    enabled: canRead && !!user?.id,
  });
  const recordQuery = useQuery({
    queryKey: ['watchlist-record-options', deferredRecordSearch],
    queryFn: () => landRecordService.getLandRecords({ search: deferredRecordSearch, page: 1, pageSize: 50 }),
    enabled: canManage && createOpen,
  });
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!hasPermission('watchlist:manage')) throw new Error('You do not have permission to manage watchlists.');
      if (!user?.id) throw new Error('User session is missing.');
      if (!recordId) throw new Error('Select a land record to monitor.');
      return monitoringService.createWatchlist({ land_record_id: recordId, user_id: user.id, reason: reason.trim() || null }, user.role?.code ?? '');
    },
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: ['watchlists', user?.id] });
      setCreateOpen(false);
      setRecordId('');
      setReason('');
      setRecordSearch('');
      navigate(`/monitoring/watchlists/${entry.id}`);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'Could not create watchlist entry.'),
  });

  if (!canRead) return <div className="p-6"><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>You do not have permission to view watchlists.</AlertDescription></Alert></div>;
  const totalPages = Math.max(1, Math.ceil((watchlistQuery.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight">Watchlists</h1><Badge variant="outline">User-owned records</Badge></div><p className="text-sm text-muted-foreground">Land-record watchlist entries visible to your account under database access rules.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/monitoring">Monitoring alerts</Link></Button>
          {canManage && <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button onClick={() => { setActionError(''); setRecordId(''); setReason(''); }}><ListPlus className="mr-2 h-4 w-4" /> Add to watchlist</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Monitor a land record</DialogTitle><DialogDescription>Create a watchlist entry for a real land record visible to your account.</DialogDescription></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><label className="text-sm font-medium" htmlFor="watchlist-record-search">Find land record</label><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="watchlist-record-search" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Search record, survey, or patta" className="pl-9" /></div></div>
                {recordQuery.isError && <p className="text-sm text-destructive">{recordQuery.error instanceof Error ? recordQuery.error.message : 'Could not load records.'}</p>}
                <Select value={recordId} onValueChange={setRecordId}>
                  <SelectTrigger aria-label="Choose land record"><SelectValue placeholder={recordQuery.isLoading ? 'Loading records...' : 'Select a land record'} /></SelectTrigger>
                  <SelectContent>{recordQuery.data?.data.map((record) => <SelectItem key={record.id} value={record.id}>{record.record_number} · Survey {record.survey_number}{record.patta_number ? ` · Patta ${record.patta_number}` : ''}</SelectItem>)}</SelectContent>
                </Select>
                {!recordQuery.isLoading && recordQuery.data?.data.length === 0 && <p className="text-sm text-muted-foreground">No visible records match that search.</p>}
                <div className="space-y-2"><label className="text-sm font-medium" htmlFor="watchlist-reason">Reason</label><Textarea id="watchlist-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional monitoring reason" rows={3} /></div>
                {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => { setActionError(''); createMutation.mutate(); }} disabled={!recordId || createMutation.isPending}>Create entry</Button></DialogFooter>
            </DialogContent>
          </Dialog>}
        </div>
      </div>

      {actionError && !createOpen && <Alert variant="destructive"><AlertTitle>Watchlist action failed</AlertTitle><AlertDescription>{actionError}</AlertDescription></Alert>}
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Monitored records</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search watchlist reason" className="pl-9" aria-label="Search watchlist reasons" /></div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger aria-label="Filter watchlist status"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="RESOLVED">Resolved</SelectItem></SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent>
          {watchlistQuery.isError ? <Alert variant="destructive"><AlertTitle>Unable to load watchlists</AlertTitle><AlertDescription>{watchlistQuery.error instanceof Error ? watchlistQuery.error.message : 'Please try again.'}</AlertDescription></Alert> : watchlistQuery.isLoading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : !watchlistQuery.data?.data.length ? (
            <div className="py-12 text-center"><ListPlus className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" /><p className="font-medium">No watchlist entries</p><p className="mt-1 text-sm text-muted-foreground">No stored entries match the selected filters.</p></div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border"><Table>
                <TableHeader><TableRow><TableHead>Record</TableHead><TableHead>Survey / patta</TableHead><TableHead>Location</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead>Added</TableHead><TableHead className="text-right">Open</TableHead></TableRow></TableHeader>
                <TableBody>{watchlistQuery.data.data.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.land_records?.record_number || 'Record unavailable'}</TableCell>
                    <TableCell>{entry.land_records ? `${entry.land_records.survey_number} / ${entry.land_records.patta_number || '—'}` : '—'}</TableCell>
                    <TableCell>{[entry.land_records?.villages?.name, entry.land_records?.taluks?.name, entry.land_records?.districts?.name].filter(Boolean).join(' · ') || '—'}</TableCell>
                    <TableCell className="max-w-64 truncate">{entry.reason || '—'}</TableCell>
                    <TableCell><Badge className={entry.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{entry.status}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link to={`/monitoring/watchlists/${entry.id}`}><Eye className="mr-2 h-4 w-4" /> Details</Link></Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{watchlistQuery.data.total} entry{watchlistQuery.data.total === 1 ? '' : 'ies'} · Page {page} of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}