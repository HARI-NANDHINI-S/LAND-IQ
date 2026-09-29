import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Search,
  Upload,
  Eye,
  Trash2,
  Download,
} from 'lucide-react';
import { documentService } from '@/services/documents/documentService';
import { landRecordService } from '@/services/land-records/landRecordService';
import { useAuth } from '@/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGE_SIZE = 10;

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const page = Number(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const districtId = searchParams.get('district') || 'all';
  const processingStatus = searchParams.get('processing_status') || 'all';
  const verificationStatus = searchParams.get('verification_status') || 'all';
  const [searchTerm, setSearchTerm] = useState(search);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentForm, setDocumentForm] = useState({
    land_record_id: '',
    document_type: 'PATTA',
    district_id: '',
  });

  const { data: documentsData, isLoading, isError } = useQuery({
    queryKey: ['documents', page, search, districtId, processingStatus, verificationStatus],
    queryFn: () =>
      documentService.getDocuments({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        district_id: districtId !== 'all' ? districtId : undefined,
        processing_status: processingStatus !== 'all' ? processingStatus : undefined,
        verification_status: verificationStatus !== 'all' ? verificationStatus : undefined,
      }),
  });

  const { data: districts } = useQuery({
    queryKey: ['districts'],
    queryFn: () => landRecordService.getLandRecords({ page: 1, pageSize: 1000 }).then((result) => result.data)
      .then((records) => {
        const ids = new Map<string, string>();
        records.forEach((record: any) => {
          if (record.districts?.name && !ids.has(record.district_id ?? '')) {
            ids.set(record.district_id ?? '', record.districts.name);
          }
        });
        return Array.from(ids.entries()).map(([id, name]) => ({ id, name }));
      }),
  });

  const { data: landRecords } = useQuery({
    queryKey: ['land-records-for-documents'],
    queryFn: () => landRecordService.getLandRecords({ page: 1, pageSize: 500 }).then((result) => result.data),
  });

  const documentTypes = useMemo(
    () => [
      'PATTA',
      'SALE_DEED',
      'MORTGAGE',
      'PARTITION',
      'SURVEY',
      'IDENTITY_PROOF',
      'OTHER',
    ],
    []
  );

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchTerm) newParams.set('search', searchTerm);
    else newParams.delete('search');
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== 'all') newParams.set(key, value);
    else newParams.delete(key);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Please choose a file to upload.');
      if (!user?.id) throw new Error('You must be signed in to upload documents.');
      if (!documentForm.land_record_id && !documentForm.district_id) {
        throw new Error('Select a land record or district before uploading.');
      }

      const landRecord = landRecords?.find((record: any) => record.id === documentForm.land_record_id);
      const districtIdForUpload = documentForm.district_id || landRecord?.district_id || null;
      const stateIdForUpload = landRecord?.state_id || null;
      const villageIdForUpload = landRecord?.village_id || null;

      return documentService.uploadDocument(selectedFile, {
        district_id: districtIdForUpload,
        state_id: stateIdForUpload,
        village_id: villageIdForUpload,
        land_record_id: documentForm.land_record_id || null,
        document_type: documentForm.document_type,
        uploaded_by: user.id,
      });
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      if (document.land_record_id) queryClient.invalidateQueries({ queryKey: ['land-record', document.land_record_id] });
      queryClient.invalidateQueries({ queryKey: ['gis-record-context'] });
      setUploadOpen(false);
      setSelectedFile(null);
      setUploadError(null);
      setDocumentForm({ land_record_id: '', document_type: 'PATTA', district_id: '' });
    },
    onError: (error: Error) => {
      setUploadError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => documentService.deleteDocument(documentId),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
      if (document.land_record_id) queryClient.invalidateQueries({ queryKey: ['land-record', document.land_record_id] });
      queryClient.invalidateQueries({ queryKey: ['gis-record-context'] });
    },
  });

  const totalPages = documentsData ? Math.max(1, Math.ceil(documentsData.total / PAGE_SIZE)) : 1;

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
      case 'CANCELLED':
        return <Badge className="bg-rose-100 text-rose-800">Failed</Badge>;
      case 'PENDING':
        return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
      case 'APPROVED':
        return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-100 text-rose-800">Rejected</Badge>;
      default:
        return <Badge variant="outline">{label}</Badge>;
    }
  };

  const downloadDocument = async (document: any) => {
    try {
      const signedUrl = await documentService.getSignedUrl(document.storage_path);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unable to download document.');
    }
  };

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Manage, search, and review land record documents.</p>
        </div>

        {hasPermission('document:create') && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" /> Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Upload document</DialogTitle>
                <DialogDescription>Add a scanned PDF, JPG, JPEG, or PNG to an existing land record.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Land record</label>
                  <Select
                    value={documentForm.land_record_id}
                    onValueChange={(value) => setDocumentForm((prev) => ({ ...prev, land_record_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a land record" />
                    </SelectTrigger>
                    <SelectContent>
                      {landRecords?.map((record: any) => (
                        <SelectItem key={record.id} value={record.id}>
                          {record.record_number} • {record.survey_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Document type</label>
                  <Select
                    value={documentForm.document_type}
                    onValueChange={(value) => setDocumentForm((prev) => ({ ...prev, document_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">File</label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,image/png,image/jpeg,application/pdf"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  {selectedFile && (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{selectedFile.name}</div>
                      <div>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Upload failed</AlertTitle>
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending || !selectedFile}
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by filename or type"
                className="pl-9"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={districtId} onValueChange={(value) => handleFilterChange('district', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All districts</SelectItem>
                  {districts?.map((district: any) => (
                    <SelectItem key={district.id} value={district.id}>{district.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={processingStatus} onValueChange={(value) => handleFilterChange('processing_status', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All processing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All processing</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PROCESSING">Processing</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={verificationStatus} onValueChange={(value) => handleFilterChange('verification_status', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All verification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All verification</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="UNDER_REVIEW">In review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Button type="submit" variant="secondary">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Land Record</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Processing</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-destructive">
                    Failed to load documents.
                  </TableCell>
                </TableRow>
              ) : !documentsData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FolderOpen className="mb-2 h-8 w-8 opacity-20" />
                      <p>No documents found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                documentsData.data.map((document: any) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-muted p-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{document.original_filename}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(document.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {document.land_records ? (
                        <div>
                          <div className="font-medium">{document.land_records.record_number}</div>
                          <div className="text-xs text-muted-foreground">{document.land_records.survey_number}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unlinked</span>
                      )}
                    </TableCell>
                    <TableCell>{document.document_type}</TableCell>
                    <TableCell>{getStatusBadge(document.processing_status)}</TableCell>
                    <TableCell>{getStatusBadge(document.verification_status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/documents/${document.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {hasPermission('document:download') && (
                          <Button variant="ghost" size="icon" onClick={() => downloadDocument(document)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission('document:delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (window.confirm('Delete this document permanently?')) {
                                deleteMutation.mutate(document.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Showing {documentsData?.data.length || 0} of {documentsData?.total || 0} documents
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                const newParams = new URLSearchParams(searchParams);
                newParams.set('page', String(nextPage));
                setSearchParams(newParams);
              }}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Prev
            </Button>
            <div className="text-sm font-medium">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextPage = Math.min(totalPages, page + 1);
                const newParams = new URLSearchParams(searchParams);
                newParams.set('page', String(nextPage));
                setSearchParams(newParams);
              }}
              disabled={page >= totalPages || isLoading}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
