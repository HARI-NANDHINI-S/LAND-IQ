import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileText,
  FileWarning,
  MapPin,
  ShieldCheck,
  Calendar,
  User,
  ScanText,
} from 'lucide-react';
import { documentService } from '@/services/documents/documentService';
import { useAuth } from '@/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DocumentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  const { data: document, isLoading, isError, error } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentService.getDocument(id!),
    enabled: !!id,
  });

  const pagesQuery = useQuery({
    queryKey: ['document-pages', id],
    queryFn: () => documentService.getDocumentPages(id!),
    enabled: !!id,
  });
  const extractedFieldsQuery = useQuery({
    queryKey: ['document-extracted-fields', id],
    queryFn: () => documentService.getExtractedFields(id!),
    enabled: !!id,
  });
  const processMutation = useMutation({
    mutationFn: () => documentService.processDocument(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['document-pages', id] });
      queryClient.invalidateQueries({ queryKey: ['document-extracted-fields', id] });
      queryClient.invalidateQueries({ queryKey: ['verification-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      setProcessFeedback(`Processed ${result.processed_pages} pages with ${result.provider}.`);
    },
    onError: (processError: Error) => setProcessFeedback(processError.message),
  });
  const [processFeedback, setProcessFeedback] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);
  const canVerifyFields = hasPermission('verification:review') || hasPermission('verification:approve');
  const verifyFieldMutation = useMutation({
    mutationFn: ({ fieldId, value }: { fieldId: string; value: string }) => documentService.verifyExtractedField(fieldId, value),
    onSuccess: () => {
      setVerificationFeedback('Verified field saved.');
      void queryClient.invalidateQueries({ queryKey: ['document-extracted-fields', id] });
      void queryClient.invalidateQueries({ queryKey: ['verification-task'] });
    },
    onError: (verifyError: Error) => setVerificationFeedback(verifyError.message),
  });

  const getStatusBadge = (status: string | null | undefined) => {
    const label = status || 'PENDING';
    switch (label) {
      case 'COMPLETED':
        return <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>;
      case 'PROCESSING':
      case 'OCR_PROCESSING':
      case 'EXTRACTION':
      case 'VALIDATION':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case 'FAILED':
        return <Badge className="bg-rose-100 text-rose-800">Failed</Badge>;
      case 'APPROVED':
        return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-100 text-rose-800">Rejected</Badge>;
      case 'PENDING':
        return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
      default:
        return <Badge variant="outline">{label}</Badge>;
    }
  };

  const handleDownload = async () => {
    if (!document?.storage_path) return;
    setDownloadFeedback(null);
    try {
      const signedUrl = await documentService.getSignedUrl(document.storage_path);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (downloadError) {
      setDownloadFeedback(downloadError instanceof Error ? downloadError.message : 'Unable to download document.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <FileWarning className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Document Not Found</h2>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'The document could not be found or you do not have access.'}
        </p>
        <Button onClick={() => navigate('/documents')}>Back to documents</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6 space-y-6 overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/documents')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{document.original_filename}</h1>
              {getStatusBadge(document.processing_status)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{document.document_type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission('document:process') && ['PENDING', 'FAILED'].includes(document.processing_status) && (
            <Button
              variant="outline"
              onClick={() => {
                setProcessFeedback(null);
                processMutation.mutate();
              }}
              disabled={processMutation.isPending}
            >
              <ScanText className="mr-2 h-4 w-4" />
              {processMutation.isPending ? 'Processing…' : document.processing_status === 'FAILED' ? 'Retry OCR' : 'Process OCR'}
            </Button>
          )}
          {hasPermission('document:download') && (
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          )}
        </div>
      </div>

      {processFeedback && (
        <Alert variant={processMutation.isError ? 'destructive' : 'default'}>
          <AlertTitle>{processMutation.isError ? 'Document processing failed' : 'Document processing'}</AlertTitle>
          <AlertDescription>{processFeedback}</AlertDescription>
        </Alert>
      )}

      {document.processing_error && (
        <Alert variant="destructive">
          <AlertTitle>Processing needs attention</AlertTitle>
          <AlertDescription>{document.processing_error}</AlertDescription>
        </Alert>
      )}

      {downloadFeedback && (
        <Alert variant="destructive">
          <AlertTitle>Download failed</AlertTitle>
          <AlertDescription>{downloadFeedback}</AlertDescription>
        </Alert>
      )}

      {document.verification_status === 'REJECTED' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Verification rejected</AlertTitle>
          <AlertDescription>This document was rejected during verification.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Filename</div>
              <div className="font-medium">{document.original_filename}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Type</div>
              <div className="font-medium">{document.document_type}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Storage path</div>
              <div className="font-medium break-all text-xs">{document.storage_path}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Land record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Record number</div>
              <div className="font-medium">{document.land_records?.record_number || 'Unlinked'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Survey number</div>
              <div className="font-medium">{document.land_records?.survey_number || '—'}</div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {document.land_records?.villages?.name || 'Unlinked'} · {document.land_records?.taluks?.name || ''} · {document.land_records?.districts?.name || ''}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Processing</div>
              <div>{getStatusBadge(document.processing_status)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Verification</div>
              <div>{getStatusBadge(document.verification_status)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Uploaded
              </div>
              <div className="font-medium">{new Date(document.created_at).toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm text-muted-foreground">File size</div>
            <div className="font-medium">{document.file_size ? `${(document.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">MIME type</div>
            <div className="font-medium">{document.mime_type || 'Unknown'}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Uploaded by
            </div>
            <div className="font-medium">{document.profiles?.full_name || 'Unknown user'}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Document year
            </div>
            <div className="font-medium">{document.document_year || 'Not set'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanText className="h-4 w-4" /> OCR pages and extracted fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pagesQuery.isLoading || extractedFieldsQuery.isLoading ? <Skeleton className="h-24 w-full" /> : null}
          {(pagesQuery.isError || extractedFieldsQuery.isError) && (
            <Alert variant="destructive"><AlertTitle>OCR data unavailable</AlertTitle><AlertDescription>{pagesQuery.error instanceof Error ? pagesQuery.error.message : extractedFieldsQuery.error instanceof Error ? extractedFieldsQuery.error.message : 'Unable to load OCR output.'}</AlertDescription></Alert>
          )}

          {verificationFeedback && (
            <Alert variant={verifyFieldMutation.isError ? 'destructive' : 'default'}>
              <AlertTitle>{verifyFieldMutation.isError ? 'Field verification failed' : 'Field verification'}</AlertTitle>
              <AlertDescription>{verificationFeedback}</AlertDescription>
            </Alert>
          )}
          {!pagesQuery.isLoading && !pagesQuery.isError && !pagesQuery.data?.length && (
            <p className="text-sm text-muted-foreground">No OCR pages have been produced. Processing requires a configured provider; no sample extraction is shown.</p>
          )}
          {pagesQuery.data?.map((page) => (
            <details key={page.id} className="rounded-md border p-3" open={pagesQuery.data?.length === 1}>
              <summary className="cursor-pointer text-sm font-medium">Page {page.page_number} · {page.ocr_status || 'PENDING'} · {page.extraction_provider || 'Provider unavailable'}</summary>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{page.extracted_text || page.processing_error || 'No page text is stored.'}</pre>
            </details>
          ))}
          {extractedFieldsQuery.data?.length ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b text-left"><th className="p-2">Field</th><th className="p-2">Extracted / verified value</th><th className="p-2">Confidence</th><th className="p-2">Verification</th>{canVerifyFields && <th className="p-2">Action</th>}</tr></thead>
                <tbody>{extractedFieldsQuery.data.map((field) => <tr key={field.id} className="border-b last:border-0">
                  <td className="p-2 font-medium">{field.field_name}</td>
                  <td className="p-2">{canVerifyFields ? <Input aria-label={`Verified value for ${field.field_name}`} value={fieldValues[field.id] ?? field.verified_value ?? field.field_value ?? ''} onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))} /> : field.verified_value ?? field.field_value ?? '—'}</td>
                  <td className="p-2">{field.confidence_score == null ? '—' : `${field.confidence_score}%`}</td>
                  <td className="p-2">{field.validation_status || 'PENDING'}</td>
                  {canVerifyFields && <td className="p-2"><Button type="button" size="sm" variant="outline" disabled={verifyFieldMutation.isPending} onClick={() => { setVerificationFeedback(null); verifyFieldMutation.mutate({ fieldId: field.id, value: fieldValues[field.id] ?? field.verified_value ?? field.field_value ?? '' }); }}>Verify</Button></td>}
                </tr>)}</tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
