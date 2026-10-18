import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  FileText,
  FileWarning,
  MapPin,
  XCircle,
} from 'lucide-react';
import { verificationService } from '@/services/verification/verificationService';
import { documentService } from '@/services/documents/documentService';
import { useAuth } from '@/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { mlService, type FieldValidationResult } from '@/services/ml/mlService';
import { AnomalyPriorityCard } from '@/components/ml/AnomalyPriorityCard';
import { FieldReviewSection } from '@/components/ml/FieldReviewSection';

export default function VerificationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [rejectReason, setRejectReason] = useState('');
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  const { data: task, isLoading, isError, error } = useQuery({
    queryKey: ['verification-task', id],
    queryFn: () => verificationService.getVerificationTask(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, comment }: { status: string; comment?: string }) => {
      return verificationService.updateTaskStatus(id!, status, comment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-task', id] });
      queryClient.invalidateQueries({ queryKey: ['verification-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['verification-stats'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['gis-record-context'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-alert-context'] });
    },
  });

  const docs = useMemo(() => (task?.documents ? (Array.isArray(task.documents) ? task.documents : [task.documents]) : []), [task]);
  const extractedFields = useMemo(() => (task?.documents?.extracted_fields ? (Array.isArray(task.documents.extracted_fields) ? task.documents.extracted_fields : [task.documents.extracted_fields]) : []), [task]);
  const actions = useMemo(() => (task?.verification_actions ? (Array.isArray(task.verification_actions) ? task.verification_actions : [task.verification_actions]) : []), [task]);

  const { data: mlPrediction, isLoading: isMlLoading } = useQuery({
    queryKey: ['ml-prediction', task?.id, extractedFields.length],
    queryFn: async () => {
      if (!task) return null;
      const confs = extractedFields.map((f: any) => Number(f.confidence) || 80);
      const avgConf = confs.length ? confs.reduce((a: number, b: number) => a + b, 0) / confs.length : 85.0;
      const minConf = confs.length ? Math.min(...confs) : 75.0;
      return mlService.predictAnomaly({
        ocr_avg_confidence: avgConf,
        ocr_min_confidence: minConf,
        missing_fields_count: Math.max(0, 5 - extractedFields.length),
        document_type: task?.documents?.document_type || 'PATTA',
        page_count: task?.documents?.page_count || 1,
      });
    },
    enabled: !!task,
  });

  const { data: fieldValidationResults = {}, isLoading: isFieldValidating } = useQuery({
    queryKey: ['ml-field-validations-task', task?.id, extractedFields.length],
    queryFn: async () => {
      if (!extractedFields.length) return {};
      const batchReq = extractedFields.map((f: any) => ({
        field_id: f.id,
        field_name: f.field_name,
        field_value: f.field_value || '',
        confidence: f.confidence_score,
      }));
      const results = await mlService.validateFieldsBatch(batchReq);
      const map: Record<string, FieldValidationResult> = {};
      results.forEach((r) => {
        if (r.field_id) map[r.field_id] = r;
        map[r.field_name] = r;
      });
      return map;
    },
    enabled: !!extractedFields.length,
  });

  const canVerifyFields = hasPermission('verification:review') || hasPermission('verification:approve');

  const getStatusBadge = (status: string | null | undefined) => {
    const label = status || 'QUEUED';
    switch (label) {
      case 'APPROVED':
        return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-100 text-rose-800">Rejected</Badge>;
      case 'UNDER_REVIEW':
        return <Badge className="bg-blue-100 text-blue-800">In Review</Badge>;
      case 'CORRECTION_REQUIRED':
        return <Badge className="bg-orange-100 text-orange-800">Needs Correction</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-800">Queued</Badge>;
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
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <FileWarning className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Verification Task Not Found</h2>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'This verification task could not be loaded.'}
        </p>
        <Button onClick={() => navigate('/verification')}>Back to verification</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/verification')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Verification Task</h1>
              {getStatusBadge(task.status)}
            </div>
            <p className="text-sm text-muted-foreground">Task ID: {task.id.slice(0, 8)}...</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('verification:review') && (
            <Button variant="secondary" onClick={() => updateStatusMutation.mutate({ status: 'UNDER_REVIEW' })} disabled={updateStatusMutation.isPending}>
              Start review
            </Button>
          )}
          {hasPermission('verification:approve') && (
            <Button onClick={() => updateStatusMutation.mutate({ status: 'APPROVED' })} disabled={updateStatusMutation.isPending}>
              <BadgeCheck className="mr-2 h-4 w-4" /> Approve
            </Button>
          )}
          {hasPermission('verification:reject') && (
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" disabled={updateStatusMutation.isPending}>
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Reject this verification task?</DialogTitle>
                  <DialogDescription>Provide a reason for rejection before submitting.</DialogDescription>
                </DialogHeader>
                <Textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Reason for rejection"
                  className="min-h-[120px]"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRejectOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      updateStatusMutation.mutate({ status: 'REJECTED', comment: rejectReason || undefined });
                      setIsRejectOpen(false);
                      setRejectReason('');
                    }}
                    disabled={updateStatusMutation.isPending}
                  >
                    Reject
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Machine Learning Land Record Anomaly & Review Priority */}
      <AnomalyPriorityCard prediction={mlPrediction ?? null} isLoading={isMlLoading} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">Land record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Record number</div>
              <div className="font-medium">{task.land_records?.record_number || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Survey number</div>
              <div className="font-medium">{task.land_records?.survey_number || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Patta number</div>
              <div className="font-medium">{task.land_records?.patta_number || '—'}</div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {task.land_records?.villages?.name || 'Unknown'} · {task.land_records?.taluks?.name || 'Unknown'} · {task.land_records?.districts?.name || 'Unknown'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">Owner information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.land_records?.land_record_owners?.length ? (
              task.land_records.land_record_owners.map((owner: any) => (
                <div key={owner.id} className="rounded-md border p-3">
                  <div className="font-medium">{owner.land_owners?.full_name || 'Unknown owner'}</div>
                  <div className="text-sm text-muted-foreground">{owner.ownership_percentage ?? 0}% share</div>
                  <div className="text-sm text-muted-foreground">{owner.ownership_type || 'Not specified'}</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No ownership data linked to this land record.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-muted-foreground">Verification details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Priority</div>
              <div className="mt-1 font-medium">{task.priority || 'MEDIUM'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Assigned reviewer</div>
              <div className="font-medium">{task.profiles?.full_name || 'Unassigned'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="font-medium">{new Date(task.created_at).toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!docs.length ? (
            <p className="text-sm text-muted-foreground">No documents linked to this verification task.</p>
          ) : (
            docs.map((document: any) => (
              <div key={document.id} className="rounded-md border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{document.original_filename}</div>
                  <div className="text-sm text-muted-foreground">{document.document_type}</div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(document.processing_status)}
                  {getStatusBadge(document.verification_status)}
                  {hasPermission('document:download') && (
                    <Button variant="outline" size="sm" onClick={() => downloadDocument(document)}>
                      <Download className="mr-2 h-4 w-4" /> View
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ML-Based OCR Field Error Detection & Candidate Correction Review Section */}
      <FieldReviewSection
        fields={extractedFields as any}
        validationResults={fieldValidationResults}
        isLoading={isFieldValidating}
        canVerify={canVerifyFields}
        onVerifyField={async (fieldId, value) => {
          await documentService.verifyExtractedField(fieldId, value);
          void queryClient.invalidateQueries({ queryKey: ['verification-task', id] });
          void queryClient.invalidateQueries({ queryKey: ['verification-tasks'] });
          void queryClient.invalidateQueries({ queryKey: ['document-extracted-fields'] });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Verification history</CardTitle>
        </CardHeader>
        <CardContent>
          {!actions.length ? (
            <p className="text-sm text-muted-foreground">No verification activity has been recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {actions.map((action: any) => (
                <div key={action.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{action.action}</div>
                    <div className="text-xs text-muted-foreground">{new Date(action.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-muted-foreground">Reviewer: {action.profiles?.full_name || 'Unknown'}</div>
                  {action.comment && <div className="mt-2 text-sm">{action.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
