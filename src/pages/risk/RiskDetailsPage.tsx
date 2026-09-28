import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Download,
  FileText,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { riskService } from '@/services/risk/riskService';
import { documentService } from '@/services/documents/documentService';
import { useAuth } from '@/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

export default function RiskDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useAuth();
  const [note, setNote] = useState('');

  const { data: assessment, isLoading, isError, error } = useQuery({
    queryKey: ['risk-assessment', id],
    queryFn: () => riskService.getRiskAssessment(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      if (!user?.id) throw new Error('User session is missing.');
      return riskService.updateRiskStatus(id!, status, user.id, user.role?.code ?? 'VIEWER', notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-assessment', id] });
      queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
      queryClient.invalidateQueries({ queryKey: ['risk-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['gis-record-context'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-alert-context'] });
    },
  });

  const record = assessment?.land_records ?? null;
  const riskSignals = (assessment?.risk_signals ?? []) as any[];
  const relatedDocuments = (record?.documents ?? []) as any[];
  const duplicateCandidates = (assessment?.duplicate_candidates ?? []) as any[];

  const statusBadge = (value?: string | null) => {
    const label = value || 'ACTIVE';
    switch (label) {
      case 'UNDER_REVIEW':
        return <Badge className="bg-blue-100 text-blue-800">Under Review</Badge>;
      case 'RESOLVED':
        return <Badge className="bg-emerald-100 text-emerald-800">Resolved</Badge>;
      case 'REOPENED':
        return <Badge className="bg-orange-100 text-orange-800">Reopened</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700">Active</Badge>;
    }
  };

  const riskBadge = (value?: string | null) => {
    const label = value || 'LOW';
    switch (label) {
      case 'HIGH':
      case 'CRITICAL':
        return <Badge className="bg-rose-100 text-rose-800">{label}</Badge>;
      case 'MODERATE':
        return <Badge className="bg-amber-100 text-amber-800">{label}</Badge>;
      default:
        return <Badge className="bg-emerald-100 text-emerald-800">{label}</Badge>;
    }
  };

  const severityBadge = (value?: string | null) => {
    const label = value || 'LOW';
    switch (label.toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return <Badge className="bg-rose-100 text-rose-800">{label}</Badge>;
      case 'MEDIUM':
      case 'MODERATE':
        return <Badge className="bg-amber-100 text-amber-800">{label}</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700">{label}</Badge>;
    }
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

  if (isError || !assessment) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Risk assessment not found</h2>
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'The selected risk assessment could not be loaded.'}</p>
        <Button onClick={() => navigate('/risk')}>Back to risk intelligence</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/risk')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Risk Assessment</h1>
              {riskBadge(assessment.risk_level)}
            </div>
            <p className="text-sm text-muted-foreground">Assessment ID: {assessment.id.slice(0, 8)}...</p>
          </div>
        </div>

        {hasPermission('risk:manage') && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <BadgeCheck className="mr-2 h-4 w-4" /> Start investigation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start investigation?</DialogTitle>
                <DialogDescription>This updates the risk assessment status to Under Review and logs the action.</DialogDescription>
              </DialogHeader>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Investigation note" className="min-h-[120px]" />
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button onClick={() => { updateStatusMutation.mutate({ status: 'UNDER_REVIEW', notes: note || undefined }); setNote(''); }}>Start investigation</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Land record context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><span className="text-sm text-muted-foreground">Record number:</span> <span className="font-medium">{record?.record_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Survey number:</span> <span className="font-medium">{record?.survey_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Patta number:</span> <span className="font-medium">{record?.patta_number || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Area:</span> <span className="font-medium">{record?.land_area ? `${record.land_area} ${record.land_area_unit || 'acres'}` : '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Land type:</span> <span className="font-medium">{record?.land_type || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Verification status:</span> <span className="font-medium">{record?.verification_status || '—'}</span></div>
            <div><span className="text-sm text-muted-foreground">Record status:</span> <span className="font-medium">{record?.record_status || '—'}</span></div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {record?.villages?.name || 'Unknown'} · {record?.taluks?.name || 'Unknown'} · {record?.districts?.name || 'Unknown'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Risk level</span>
              {riskBadge(assessment.risk_level)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Assessment status</span>
              {statusBadge(assessment.status)}
            </div>
            <div><span className="text-sm text-muted-foreground">Score:</span> <span className="font-medium">{assessment.risk_score != null ? `${assessment.risk_score}` : 'Not stored'}</span></div>
            <div><span className="text-sm text-muted-foreground">Calculated at:</span> <span className="font-medium">{new Date(assessment.calculated_at).toLocaleString()}</span></div>
            <div><span className="text-sm text-muted-foreground">Method/version:</span> <span className="font-medium">{assessment.calculation_version || '—'}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Owner context</CardTitle>
        </CardHeader>
        <CardContent>
          {!record?.land_record_owners?.length ? (
            <p className="text-sm text-muted-foreground">No owner data available for this land record.</p>
          ) : (
            <div className="space-y-3">
              {record.land_record_owners.map((owner: any) => (
                <div key={owner.id} className="rounded-md border p-3">
                  <div className="font-medium">{owner.land_owners?.full_name || 'Unknown owner'}</div>
                  <div className="text-sm text-muted-foreground">Ownership percentage: {owner.ownership_percentage ?? '—'}</div>
                  <div className="text-sm text-muted-foreground">Type: {owner.ownership_type || 'Not specified'}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Document context</CardTitle>
        </CardHeader>
        <CardContent>
          {!relatedDocuments.length ? (
            <p className="text-sm text-muted-foreground">No linked documents were found for this land record.</p>
          ) : (
            <div className="space-y-3">
              {relatedDocuments.map((document: any) => (
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Risk signals</CardTitle>
        </CardHeader>
        <CardContent>
          {!riskSignals.length ? (
            <p className="text-sm text-muted-foreground">No active risk signals for this assessment.</p>
          ) : (
            <div className="space-y-4">
              {riskSignals.map((signal: any) => (
                <div key={signal.id} className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{signal.signal_type || 'Risk signal'}</div>
                    {severityBadge(signal.severity)}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{signal.description || 'No description available.'}</div>
                  {signal.evidence && (
                    <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                      <div className="font-medium mb-1">Evidence</div>
                      <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(signal.evidence, null, 2)}</pre>
                    </div>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground">Contribution: {signal.contribution ?? '—'} · Created: {new Date(signal.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duplicate context</CardTitle>
        </CardHeader>
        <CardContent>
          {!duplicateCandidates.length ? (
            <p className="text-sm text-muted-foreground">No duplicate candidate records are linked to this assessment.</p>
          ) : (
            <div className="space-y-3">
              {duplicateCandidates.map((candidate: any) => (
                <div key={candidate.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">Candidate #{candidate.id.slice(0, 8)}</div>
                    <Badge className="bg-slate-100 text-slate-700">{candidate.status}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">Similarity: {candidate.similarity_score ?? '—'}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
