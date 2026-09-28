import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { documentService } from '@/services/documents/documentService';
import { useAuth } from '@/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DocumentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const { data: document, isLoading, isError, error } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentService.getDocument(id!),
    enabled: !!id,
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
    const signedUrl = await documentService.getSignedUrl(document.storage_path);
    window.open(signedUrl, '_blank', 'noopener,noreferrer');
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
          {hasPermission('document:download') && (
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          )}
        </div>
      </div>

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
    </div>
  );
}
