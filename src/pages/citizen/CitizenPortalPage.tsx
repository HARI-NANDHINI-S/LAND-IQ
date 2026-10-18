import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  MapPin,
  RefreshCw,
  Search,
  FileCheck,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  citizenApplicationService,
  type CitizenApplicationDetails,
  type ApplicationStatus,
  type ApplicationRequestType,
} from '@/services/citizen/citizenApplicationService';
import { geoService } from '@/services/geographic/geoService';
import { documentService } from '@/services/documents/documentService';
import { useAuth } from '@/hooks/auth/useAuth';

export default function CitizenPortalPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [isNewAppOpen, setIsNewAppOpen] = useState(false);
  const [clarificationResponseText, setClarificationResponseText] = useState('');
  const [clarificationFile, setClarificationFile] = useState<File | null>(null);

  // New Application Form State
  const [requestType, setRequestType] = useState<ApplicationRequestType>('DIGITIZATION');
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('');
  const [applicantName, setApplicantName] = useState(user?.profile?.full_name || '');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [description, setDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch geographic data
  const { data: states = [] } = useQuery({
    queryKey: ['geo-states'],
    queryFn: () => geoService.getStates(),
  });

  const { data: districts = [] } = useQuery({
    queryKey: ['geo-districts', stateId],
    queryFn: () => geoService.getDistricts(stateId),
    enabled: !!stateId,
  });

  const { data: villages = [] } = useQuery({
    queryKey: ['geo-villages', districtId],
    queryFn: () => geoService.getVillagesByDistrict(districtId),
    enabled: !!districtId,
  });

  // Fetch citizen's applications
  const {
    data: applications = [],
    isLoading,
    refetch,
  } = useQuery<CitizenApplicationDetails[]>({
    queryKey: ['citizen-applications'],
    queryFn: () => citizenApplicationService.getMyApplications(),
  });

  // Fetch selected application details
  const { data: selectedApp, isLoading: isLoadingDetails } = useQuery<CitizenApplicationDetails | null>({
    queryKey: ['citizen-application-details', selectedAppId],
    queryFn: () => (selectedAppId ? citizenApplicationService.getApplicationDetails(selectedAppId) : null),
    enabled: !!selectedAppId,
  });

  // Submit Application Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      if (!stateId || !districtId || !villageId || !surveyNumber.trim() || !applicantName.trim()) {
        throw new Error('Please fill in all mandatory application fields.');
      }

      let documentIds: string[] = [];
      if (uploadFile) {
        // Upload supporting land record document
        const uploadedDoc = await documentService.uploadDocument(uploadFile, {
          document_type: 'PATTA',
          state_id: stateId || null,
          district_id: districtId || null,
          village_id: villageId || null,
        });
        if (uploadedDoc?.id) {
          documentIds.push(uploadedDoc.id);
        }
      }

      return citizenApplicationService.submitApplication({
        requestType,
        stateId,
        districtId,
        villageId,
        surveyNumber,
        applicantName,
        applicantPhone,
        description,
        documentIds,
      });
    },
    onSuccess: () => {
      setIsNewAppOpen(false);
      resetNewAppForm();
      void queryClient.invalidateQueries({ queryKey: ['citizen-applications'] });
      void refetch();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to submit application. Please verify details.');
    },
  });

  // Respond Clarification Mutation
  const respondClarificationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppId || !clarificationResponseText.trim()) {
        throw new Error('Please enter your response to the clarification request.');
      }

      let newDocId: string | null = null;
      if (clarificationFile) {
        const uploadedDoc = await documentService.uploadDocument(clarificationFile, {
          document_type: 'SUPPORTING_EVIDENCE',
          state_id: selectedApp?.state_id || null,
          district_id: selectedApp?.district_id || null,
          village_id: selectedApp?.village_id || null,
        });
        newDocId = uploadedDoc?.id || null;
      }

      return citizenApplicationService.respondClarification(
        selectedAppId,
        clarificationResponseText,
        newDocId
      );
    },
    onSuccess: () => {
      setClarificationResponseText('');
      setClarificationFile(null);
      void queryClient.invalidateQueries({ queryKey: ['citizen-application-details', selectedAppId] });
      void queryClient.invalidateQueries({ queryKey: ['citizen-applications'] });
    },
  });

  const resetNewAppForm = () => {
    setRequestType('DIGITIZATION');
    setSurveyNumber('');
    setApplicantPhone('');
    setDescription('');
    setUploadFile(null);
    setFormError(null);
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'SUBMITTED':
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600">Submitted</Badge>;
      case 'OCR_PROCESSING':
        return <Badge className="bg-sky-500 text-white hover:bg-sky-600">OCR Processing</Badge>;
      case 'UNDER_REVIEW':
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">Under Review</Badge>;
      case 'ACTION_REQUIRED':
        return <Badge className="bg-rose-600 text-white hover:bg-rose-700 animate-pulse">Action Required</Badge>;
      case 'RESUBMITTED':
        return <Badge className="bg-purple-600 text-white hover:bg-purple-700">Resubmitted</Badge>;
      case 'APPROVED':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-800 text-white hover:bg-rose-900">Rejected</Badge>;
      case 'PROCESSING_FAILED':
        return <Badge variant="destructive">Processing Failed</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.application_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.survey_number && app.survey_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (app.villages?.name && app.villages.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalCount = applications.length;
  const underReviewCount = applications.filter((a) => ['SUBMITTED', 'OCR_PROCESSING', 'UNDER_REVIEW', 'RESUBMITTED'].includes(a.status)).length;
  const actionRequiredCount = applications.filter((a) => a.status === 'ACTION_REQUIRED').length;
  const approvedCount = applications.filter((a) => a.status === 'APPROVED').length;

  return (
    <div className="flex h-full flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Citizen Land Records Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submit, track, and manage your land record digitization, correction, and title verification applications.
          </p>
        </div>
        <Button onClick={() => setIsNewAppOpen(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Submit New Application
        </Button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Total Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Submitted from your account</p>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-blue-600 uppercase">
              In Review / Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{underReviewCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Under official examination</p>
          </CardContent>
        </Card>

        <Card className="border border-rose-200 bg-rose-50/40 dark:bg-rose-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-rose-700 dark:text-rose-400 uppercase flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">{actionRequiredCount}</div>
            <p className="text-xs text-rose-600/80 dark:text-rose-300 mt-1">Clarification requested by officer</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{approvedCount}</div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-300 mt-1">Verified official land records</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by app #, survey, village..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
              <SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
              <SelectItem value="RESUBMITTED">Resubmitted</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => refetch()} className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Applications List */}
      <Card className="border border-border/70">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
              Loading your submitted applications...
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <h3 className="text-base font-semibold">No applications found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'ALL'
                  ? 'No applications match your filter criteria.'
                  : 'You have not submitted any land record applications yet. Click "Submit New Application" to get started.'}
              </p>
              {!searchTerm && statusFilter === 'ALL' && (
                <Button size="sm" onClick={() => setIsNewAppOpen(true)}>
                  Submit First Application
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {app.application_number}
                      </span>
                      {getStatusBadge(app.status)}
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {app.request_type}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {app.villages?.name || 'Village'}, {app.districts?.name || 'District'}
                      </span>
                      <span>•</span>
                      <span>Survey No: <strong>{app.survey_number || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Submitted: {new Date(app.created_at).toLocaleDateString()}</span>
                    </div>

                    {app.status === 'ACTION_REQUIRED' && app.clarification_request && (
                      <div className="mt-2 text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded p-2 text-rose-900 dark:text-rose-200">
                        <span className="font-semibold">Officer Clarification Needed:</span> {app.clarification_request}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant={app.status === 'ACTION_REQUIRED' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-8 gap-1.5"
                      onClick={() => setSelectedAppId(app.id)}
                    >
                      {app.status === 'ACTION_REQUIRED' ? (
                        <>Respond Now <AlertTriangle className="h-3.5 w-3.5" /></>
                      ) : (
                        <>Track Progress <ChevronRight className="h-3.5 w-3.5" /></>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Application Dialog */}
      <Dialog open={isNewAppOpen} onOpenChange={setIsNewAppOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Submit Land Record Application
            </DialogTitle>
            <DialogDescription>
              Submit an official request for Patta digitization, field error correction, or title verification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {formError}
              </div>
            )}

            {/* Request Type */}
            <div>
              <Label className="text-xs">Application Request Type *</Label>
              <Select value={requestType} onValueChange={(val: any) => setRequestType(val)}>
                <SelectTrigger className="mt-1 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIGITIZATION">Patta / Title Deed Digitization</SelectItem>
                  <SelectItem value="CORRECTION">Land Record Attribute Correction</SelectItem>
                  <SelectItem value="MUTATION">Ownership Transfer / Mutation</SelectItem>
                  <SelectItem value="TITLE_VERIFICATION">Legal Title Cross-Verification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Geographic Scope Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">State *</Label>
                <Select value={stateId} onValueChange={(val) => { setStateId(val); setDistrictId(''); setVillageId(''); }}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select State" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">District *</Label>
                <Select value={districtId} onValueChange={(val) => { setDistrictId(val); setVillageId(''); }} disabled={!stateId}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select District" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Village *</Label>
                <Select value={villageId} onValueChange={setVillageId} disabled={!districtId}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Select Village" />
                  </SelectTrigger>
                  <SelectContent>
                    {villages.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Survey Number & Applicant Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Survey / Subdivision Number *</Label>
                <Input
                  placeholder="e.g. 102/1A or 204"
                  value={surveyNumber}
                  onChange={(e) => setSurveyNumber(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Applicant Full Name *</Label>
                <Input
                  placeholder="Enter full legal name"
                  value={applicantName}
                  onChange={(e) => setApplicantName(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Contact Mobile Number *</Label>
                <Input
                  placeholder="e.g. +91 98765 43210"
                  value={applicantPhone}
                  onChange={(e) => setApplicantPhone(e.target.value)}
                  className="mt-1 h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Upload Supporting Patta/Deed Document</Label>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="mt-1 h-9 text-xs cursor-pointer"
                />
              </div>
            </div>

            {/* Description / Particulars */}
            <div>
              <Label className="text-xs">Request Description & Details</Label>
              <Textarea
                placeholder="State any specific details or reason for correction/digitization..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setIsNewAppOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? 'Submitting Application...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application Details & Timeline Tracking Modal */}
      <Dialog open={!!selectedAppId} onOpenChange={(open) => !open && setSelectedAppId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {isLoadingDetails || !selectedApp ? (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
              Loading application tracking details...
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-semibold flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-primary" />
                    Application #{selectedApp.application_number}
                  </DialogTitle>
                  {getStatusBadge(selectedApp.status)}
                </div>
                <DialogDescription>
                  Tracking timeline and officer review history for your land record request.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Application Details Summary */}
                <div className="rounded-lg border bg-muted/20 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Request Type:</span>
                    <span className="font-semibold text-foreground">{selectedApp.request_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Survey Number:</span>
                    <span className="font-semibold text-foreground">{selectedApp.survey_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Village & District:</span>
                    <span className="font-medium text-foreground">
                      {selectedApp.villages?.name}, {selectedApp.districts?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Applicant Name:</span>
                    <span className="font-medium text-foreground">{selectedApp.applicant_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Phone:</span>
                    <span className="font-medium text-foreground">{selectedApp.applicant_phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Submission Date:</span>
                    <span className="font-medium text-foreground">
                      {new Date(selectedApp.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Clarification Request & Citizen Response Box */}
                {selectedApp.status === 'ACTION_REQUIRED' && (
                  <div className="rounded-lg border border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-semibold text-xs">
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                      Officer Requested Additional Information
                    </div>
                    <div className="text-xs text-rose-950 dark:text-rose-100 bg-white/70 dark:bg-black/30 p-2.5 rounded border border-rose-200">
                      {selectedApp.clarification_request}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-rose-200">
                      <Label className="text-xs font-semibold text-foreground">
                        Your Clarification Response & Evidence:
                      </Label>
                      <Textarea
                        placeholder="Provide details or explain the discrepancy requested by the officer..."
                        value={clarificationResponseText}
                        onChange={(e) => setClarificationResponseText(e.target.value)}
                        rows={3}
                        className="text-xs bg-white dark:bg-background"
                      />

                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                        <Input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => setClarificationFile(e.target.files?.[0] || null)}
                          className="text-xs h-8 max-w-xs"
                        />

                        <Button
                          size="sm"
                          className="text-xs h-8 gap-1.5"
                          disabled={respondClarificationMutation.isPending || !clarificationResponseText.trim()}
                          onClick={() => respondClarificationMutation.mutate()}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {respondClarificationMutation.isPending ? 'Submitting...' : 'Submit Response'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resubmitted Status Notice */}
                {selectedApp.status === 'RESUBMITTED' && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 p-3 text-xs text-purple-900 dark:text-purple-200">
                    <span className="font-semibold">Response Submitted:</span> Your clarification has been forwarded to the reviewing officer.
                  </div>
                )}

                {/* Approved / Decision Notice */}
                {selectedApp.status === 'APPROVED' && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                    <span className="font-semibold">Official Approval:</span> Your application has been verified and approved by the registration officer.
                    {selectedApp.officer_decision_reason && (
                      <p className="mt-1 text-emerald-800 dark:text-emerald-300">Decision Notes: {selectedApp.officer_decision_reason}</p>
                    )}
                  </div>
                )}

                {/* Rejected Notice */}
                {selectedApp.status === 'REJECTED' && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 p-3 text-xs text-rose-900 dark:text-rose-200">
                    <span className="font-semibold">Application Rejected:</span>{' '}
                    {selectedApp.officer_decision_reason || 'Does not meet statutory land record criteria.'}
                  </div>
                )}

                {/* Attached Documents */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground">
                    Attached Documents ({(selectedApp.documents || []).length})
                  </div>
                  {(selectedApp.documents || []).length === 0 ? (
                    <div className="text-xs text-muted-foreground">No documents uploaded.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedApp.documents?.map((docItem) => (
                        <div
                          key={docItem.id}
                          className="rounded border p-2 flex items-center justify-between text-xs bg-muted/20"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              {docItem.document?.file_name || 'Land Document'}
                            </span>
                            {docItem.is_clarification_evidence && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                Clarification Evidence
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(docItem.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chronological Timeline */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Chronological Event Timeline
                  </div>

                  <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {(selectedApp.timeline || []).map((event) => (
                      <div key={event.id} className="relative text-xs">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
                        <div className="font-semibold text-foreground">{event.event_title}</div>
                        {event.event_description && (
                          <div className="text-muted-foreground mt-0.5">{event.event_description}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground/70 mt-1">
                          {new Date(event.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
