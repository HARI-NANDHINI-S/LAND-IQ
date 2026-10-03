import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  MapPin,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { duplicateService } from '@/services/duplicateService';
import { documentService } from '@/services/documents/documentService';
import { useAuth } from '@/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

export default function DuplicateDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [confirmReason, setConfirmReason] = useState('');
  const [notDuplicateReason, setNotDuplicateReason] = useState('');

  const { data: candidate, isLoading, isError, error } = useQuery({
    queryKey: ['duplicate-candidate', id],
    queryFn: () => duplicateService.getDuplicateCandidate(id!),
    enabled: !!id,
  });

  const { data: historyData } = useQuery({
    queryKey: ['duplicate-candidate-history', id],
    queryFn: () => duplicateService.getDuplicateCandidateHistory(id!),
    enabled: !!id,
  });

  const recordIds = useMemo(() => [candidate?.record_a_id, candidate?.record_b_id].filter(Boolean) as string[], [candidate]);

  const documentQueries = useQuery({
    queryKey: ['duplicate-record-documents', recordIds],
    queryFn: async () => {
      const results = await Promise.all(recordIds.map(async (recordId) => ({
        recordId,
        documents: await duplicateService.getCandidateDocuments(recordId),
      })));
      return results;
    },
    enabled: recordIds.length > 0,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      return duplicateService.updateCandidateStatus(id!, status, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicate-candidate', id] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-stats'] });
      queryClient.invalidateQueries({ queryKey: ['duplicate-candidate-history', id] });
      queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['gis-record-context'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-alert-context'] });
    },
  });

  const recordA = candidate?.record_a ?? null;
  const recordB = candidate?.record_b ?? null;

  const getStatusBadge = (value: string | null | undefined) => {
    const label = value || 'PENDING';
    switch (label) {
      case 'CONFIRMED':
        return <Badge className="bg-emerald-100 text-emerald-800">Confirmed</Badge>;
      case 'FALSE_POSITIVE':
        return <Badge className="bg-slate-100 text-slate-700">Not Duplicate</Badge>;
      case 'UNDER_REVIEW':
        return <Badge className="bg-blue-100 text-blue-800">Under Review</Badge>;
      case 'DISPUTED':
        return <Badge className="bg-orange-100 text-orange-800">Disputed</Badge>;
      case 'LEGITIMATE_SUBDIVISION':
        return <Badge className="bg-violet-100 text-violet-800">Subdivision</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
    }
  };

  const getComparisonSignals = () => {
    if (!candidate?.match_signals || typeof candidate.match_signals !== 'object') {
      return [] as Array<{ label: string; value: string }>; 
    }

    return Object.entries(candidate.match_signals as Record<string, unknown>).map(([key, value]) => ({
      label: key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      value: typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
    }));
  };

  const getOwnerSummary = (record: any) => {
    const owners = record?.land_record_owners ?? [];
    if (!owners.length) return 'Missing owner data';
    return owners.map((owner: any) => owner.land_owners?.full_name ?? 'Unknown owner').join(', ');
  };

  const downloadDocument = async (document: any) => {
    if (!document?.storage_path) return;
    const signedUrl = await documentService.getSignedUrl(document.storage_path);
    window.open(signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[220px] w-full" />
        <Skeleton className="h-[220px] w-full" />
      </div>
    );
  }

  if (isError || !candidate) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Duplicate candidate not found</h2>
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'The selected duplicate candidate could not be loaded.'}</p>
        <Button onClick={() => navigate('/duplicates')}>Back to duplicates</Button>
      </div>
    );
  }

  const comparisonSignals = getComparisonSignals();

  return (
    <div className="flex h-full flex-col p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/duplicates')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Duplicate Review</h1>
              {getStatusBadge(candidate.status)}
            </div>
            <p className="text-sm text-muted-foreground">Candidate ID: {candidate.id.slice(0, 8)}...</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('duplicate:review') && (
            <Button variant="secondary" onClick={() => updateStatusMutation.mutate({ status: 'UNDER_REVIEW' })} disabled={updateStatusMutation.isPending}>
              Start review
            </Button>
          )}
          {hasPermission('duplicate:resolve') && (
            <Dialog>
              <DialogTrigger asChild>
                <Button onClick={() => setConfirmReason('')}>
                  <BadgeCheck className="mr-2 h-4 w-4" /> Confirm duplicate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm this pair as a duplicate?</DialogTitle>
                  <DialogDescription>Record the review note for this resolution and save it to the live duplicate candidate.</DialogDescription>
                </DialogHeader>
                <Textarea value={confirmReason} onChange={(event) => setConfirmReason(event.target.value)} placeholder="Review note or reason" className="min-h-[120px]" />
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button onClick={() => { updateStatusMutation.mutate({ status: 'CONFIRMED', notes: confirmReason || undefined }); }} disabled={updateStatusMutation.isPending}>Confirm duplicate</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {hasPermission('duplicate:resolve') && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" onClick={() => setNotDuplicateReason('')}>
                  <XCircle className="mr-2 h-4 w-4" /> Mark as not duplicate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark as not duplicate?</DialogTitle>
                  <DialogDescription>Provide a reason to record why this candidate was resolved as not a duplicate.</DialogDescription>
                </DialogHeader>
                <Textarea value={notDuplicateReason} onChange={(event) => setNotDuplicateReason(event.target.value)} placeholder="Reason" className="min-h-[120px]" />
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button variant="destructive" onClick={() => { updateStatusMutation.mutate({ status: 'FALSE_POSITIVE', notes: notDuplicateReason.trim() }); }} disabled={updateStatusMutation.isPending || !notDuplicateReason.trim()}>Mark as not duplicate</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record A</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Record number:</span> <span className="font-medium">{recordA?.record_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Survey number:</span> <span className="font-medium">{recordA?.survey_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Patta number:</span> <span className="font-medium">{recordA?.patta_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Land area:</span> <span className="font-medium">{recordA?.land_area ? `${recordA.land_area} ${recordA.land_area_unit || 'acres'}` : '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Land type:</span> <span className="font-medium">{recordA?.land_type || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Verification status:</span> <span className="font-medium">{recordA?.verification_status || '—'}</span></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {recordA?.villages?.name || 'Unknown'} · {recordA?.taluks?.name || 'Unknown'} · {recordA?.districts?.name || 'Unknown'}
            </div>
            <div><span className="text-sm text-muted-foreground">Owners:</span> <span className="font-medium">{getOwnerSummary(recordA)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record B</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Record number:</span> <span className="font-medium">{recordB?.record_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Survey number:</span> <span className="font-medium">{recordB?.survey_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Patta number:</span> <span className="font-medium">{recordB?.patta_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Land area:</span> <span className="font-medium">{recordB?.land_area ? `${recordB.land_area} ${recordB.land_area_unit || 'acres'}` : '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Land type:</span> <span className="font-medium">{recordB?.land_type || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Verification status:</span> <span className="font-medium">{recordB?.verification_status || '—'}</span></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {recordB?.villages?.name || 'Unknown'} · {recordB?.taluks?.name || 'Unknown'} · {recordB?.districts?.name || 'Unknown'}
            </div>
            <div><span className="text-sm text-muted-foreground">Owners:</span> <span className="font-medium">{getOwnerSummary(recordB)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Comparison Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {comparisonSignals.length ? (
              comparisonSignals.map((signal) => (
                <div key={signal.label} className="rounded-md border p-3">
                  <div className="text-sm text-muted-foreground">{signal.label}</div>
                  <div className="mt-1 font-medium">{signal.value}</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No comparison signals were recorded for this candidate.</p>
            )}
          </div>
          <div className="mt-4 rounded-md border p-3">
            <div className="text-sm text-muted-foreground">Candidate similarity</div>
            <div className="mt-1 text-lg font-semibold">{candidate.similarity_score != null ? `${candidate.similarity_score}%` : 'Not available'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Document comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {documentQueries.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {documentQueries.data?.map(({ recordId, documents }) => (
                <div key={recordId} className="space-y-3 rounded-md border p-3">
                  <div className="font-medium">Record {recordId === candidate.record_a_id ? 'A' : 'B'}</div>
                  {!documents.length ? (
                    <p className="text-sm text-muted-foreground">No documents linked to this record.</p>
                  ) : (
                    documents.map((document: any) => (
                      <div key={document.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{document.original_filename}</div>
                            <div className="text-xs text-muted-foreground">{document.document_type}</div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => downloadDocument(document)}>
                            <Download className="mr-2 h-4 w-4" /> View
                          </Button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Processing: {document.processing_status}</span>
                          <span>Verification: {document.verification_status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Review history</CardTitle>
        </CardHeader>
        <CardContent>
          {!historyData?.length ? (
            <p className="text-sm text-muted-foreground">No audit history is available for this candidate yet.</p>
          ) : (
            <div className="space-y-3">
              {historyData.map((entry: any) => (
                <div key={entry.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{entry.action}</div>
                    <div className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">Actor: {entry.profiles?.full_name || 'Unknown'}</div>
                  {entry.metadata?.resolution_notes && <div className="mt-2 text-sm">{entry.metadata.resolution_notes}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
