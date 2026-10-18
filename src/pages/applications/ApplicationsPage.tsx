import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  MapPin,
  RefreshCw,
  Eye,
  User,
  Download,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
} from '@/services/citizen/citizenApplicationService';
import { documentService } from '@/services/documents/documentService';
import { useAuth } from '@/hooks/auth/useAuth';

export default function ApplicationsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Dialog states for staff actions
  const [isClarifyOpen, setIsClarifyOpen] = useState(false);
  const [clarifyAppId, setClarifyAppId] = useState<string | null>(null);
  const [clarifyMessage, setClarifyMessage] = useState('');

  const [isDecideOpen, setIsDecideOpen] = useState(false);
  const [decideAppId, setDecideAppId] = useState<string | null>(null);
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [decisionReason, setDecisionReason] = useState('');

  // Fetch applications within staff's geographic scope
  const {
    data: applications = [],
    isLoading,
    refetch,
  } = useQuery<CitizenApplicationDetails[]>({
    queryKey: ['staff-citizen-applications'],
    queryFn: () => citizenApplicationService.listApplicationsForStaff(),
  });

  // Selected application details
  const { data: selectedApp } = useQuery<CitizenApplicationDetails | null>({
    queryKey: ['citizen-application-details', selectedAppId],
    queryFn: () => (selectedAppId ? citizenApplicationService.getApplicationDetails(selectedAppId) : null),
    enabled: !!selectedAppId,
  });

  // Mutation: Request Clarification
  const clarifyMutation = useMutation({
    mutationFn: () => {
      if (!clarifyAppId || !clarifyMessage.trim()) throw new Error('Clarification message is required');
      return citizenApplicationService.requestClarification(clarifyAppId, clarifyMessage);
    },
    onSuccess: () => {
      setIsClarifyOpen(false);
      setClarifyMessage('');
      setClarifyAppId(null);
      void queryClient.invalidateQueries({ queryKey: ['staff-citizen-applications'] });
      void queryClient.invalidateQueries({ queryKey: ['citizen-application-details', selectedAppId] });
      void refetch();
    },
  });

  // Mutation: Decide Application (Approve / Reject)
  const decideMutation = useMutation({
    mutationFn: () => {
      if (!decideAppId || !decisionReason.trim()) throw new Error('Decision reason is required');
      return citizenApplicationService.decideApplication(decideAppId, decisionType, decisionReason);
    },
    onSuccess: () => {
      setIsDecideOpen(false);
      setDecisionReason('');
      setDecideAppId(null);
      void queryClient.invalidateQueries({ queryKey: ['staff-citizen-applications'] });
      void queryClient.invalidateQueries({ queryKey: ['citizen-application-details', selectedAppId] });
      void refetch();
    },
  });

  const canDecide = hasPermission('application:decide') || hasPermission('verification:approve');
  const canClarify = hasPermission('application:update') || hasPermission('verification:review');

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'SUBMITTED':
        return <Badge className="bg-amber-500 text-white">Submitted</Badge>;
      case 'OCR_PROCESSING':
        return <Badge className="bg-sky-500 text-white">OCR Processing</Badge>;
      case 'UNDER_REVIEW':
        return <Badge className="bg-blue-600 text-white">Under Review</Badge>;
      case 'ACTION_REQUIRED':
        return <Badge className="bg-rose-600 text-white">Action Required</Badge>;
      case 'RESUBMITTED':
        return <Badge className="bg-purple-600 text-white">Resubmitted</Badge>;
      case 'APPROVED':
        return <Badge className="bg-emerald-600 text-white">Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-800 text-white">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.application_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.survey_number && app.survey_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (app.villages?.name && app.villages.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const downloadDoc = async (docPath: string) => {
    const signedUrl = await documentService.getSignedUrl(docPath);
    window.open(signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex h-full flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Citizen Application Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review incoming citizen requests, request evidentiary clarifications, and make official registration determinations.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh Queue
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search applicant, app #, survey, village..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs w-[190px]">
              <SelectValue placeholder="Status filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Application Statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted (New)</SelectItem>
              <SelectItem value="RESUBMITTED">Resubmitted (Actioned)</SelectItem>
              <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
              <SelectItem value="ACTION_REQUIRED">Clarification Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Applications Table */}
      <Card className="border border-border/70">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
              Loading citizen applications queue...
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <h3 className="text-sm font-semibold">No applications in this view</h3>
              <p className="text-xs text-muted-foreground">
                There are no citizen applications matching the selected criteria.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {app.application_number}
                      </span>
                      {getStatusBadge(app.status)}
                      <Badge variant="outline" className="text-[11px]">
                        {app.request_type}
                      </Badge>
                      <span className="text-xs font-medium text-foreground flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground" /> {app.applicant_name}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {app.villages?.name || 'Village'}, {app.districts?.name || 'District'}
                      </span>
                      <span>•</span>
                      <span>Survey No: <strong>{app.survey_number || 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Submitted: {new Date(app.created_at).toLocaleString()}</span>
                    </div>

                    {app.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 italic">
                        "{app.description}"
                      </p>
                    )}

                    {app.status === 'RESUBMITTED' && app.clarification_response && (
                      <div className="mt-1 text-xs bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded p-2 text-purple-900 dark:text-purple-200">
                        <span className="font-semibold">Citizen Clarification Response:</span> {app.clarification_response}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setSelectedAppId(app.id)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> Details
                    </Button>

                    {canClarify && ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(app.status) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          setClarifyAppId(app.id);
                          setIsClarifyOpen(true);
                        }}
                      >
                        <HelpCircle className="mr-1.5 h-3.5 w-3.5" /> Request Clarification
                      </Button>
                    )}

                    {canDecide && ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(app.status) && (
                      <Button
                        size="sm"
                        className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          setDecideAppId(app.id);
                          setDecisionType('APPROVE');
                          setIsDecideOpen(true);
                        }}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Decide
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Clarification Request Dialog */}
      <Dialog open={isClarifyOpen} onOpenChange={setIsClarifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-5 w-5 text-amber-500" />
              Request Clarification from Applicant
            </DialogTitle>
            <DialogDescription>
              Specify the missing evidentiary documents or attribute discrepancies the citizen must address.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Clarification Instructions for Citizen *</Label>
              <Textarea
                placeholder="e.g. Please upload parent deed or clarify subdivision mismatch with cadastral survey 102/1A..."
                value={clarifyMessage}
                onChange={(e) => setClarifyMessage(e.target.value)}
                rows={4}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setIsClarifyOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={clarifyMutation.isPending || !clarifyMessage.trim()}
              onClick={() => clarifyMutation.mutate()}
            >
              {clarifyMutation.isPending ? 'Sending...' : 'Send Clarification Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Decision Dialog (Approve / Reject) */}
      <Dialog open={isDecideOpen} onOpenChange={setIsDecideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Official Registration Determination
            </DialogTitle>
            <DialogDescription>
              Record your official determination. This action will be immutably recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Determination Decision *</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button
                  type="button"
                  variant={decisionType === 'APPROVE' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setDecisionType('APPROVE')}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve Request
                </Button>
                <Button
                  type="button"
                  variant={decisionType === 'REJECT' ? 'destructive' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setDecisionType('REJECT')}
                >
                  <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject Request
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Determination Reason & Statutory Rationale *</Label>
              <Textarea
                placeholder="State the formal rationale for this decision..."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                rows={4}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setIsDecideOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={decisionType === 'REJECT' ? 'destructive' : 'default'}
              disabled={decideMutation.isPending || !decisionReason.trim()}
              onClick={() => decideMutation.mutate()}
            >
              {decideMutation.isPending ? 'Recording...' : `Confirm ${decisionType === 'APPROVE' ? 'Approval' : 'Rejection'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application Full Details Modal */}
      <Dialog open={!!selectedAppId} onOpenChange={(open) => !open && setSelectedAppId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-semibold">
                    Case File: #{selectedApp.application_number}
                  </DialogTitle>
                  {getStatusBadge(selectedApp.status)}
                </div>
                <DialogDescription>
                  Applicant particulars, submitted evidence documents, and full case timeline.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Particulars Card */}
                <div className="rounded-lg border bg-muted/20 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-muted-foreground block">Applicant:</span>
                    <span className="font-semibold text-foreground">{selectedApp.applicant_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Contact Phone:</span>
                    <span className="font-medium text-foreground">{selectedApp.applicant_phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Request Type:</span>
                    <span className="font-semibold text-foreground">{selectedApp.request_type}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Survey Number:</span>
                    <span className="font-semibold text-foreground">{selectedApp.survey_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Village / District:</span>
                    <span className="font-medium text-foreground">
                      {selectedApp.villages?.name}, {selectedApp.districts?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Submission Date:</span>
                    <span className="font-medium text-foreground">
                      {new Date(selectedApp.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {selectedApp.description && (
                  <div className="rounded-lg border p-3 bg-muted/10">
                    <span className="font-semibold block mb-1">Applicant Statement:</span>
                    <p className="text-muted-foreground">{selectedApp.description}</p>
                  </div>
                )}

                {/* Attached Documents */}
                <div className="space-y-2">
                  <span className="font-semibold block">Attached Evidence Documents:</span>
                  {(selectedApp.documents || []).length === 0 ? (
                    <div className="text-muted-foreground">No documents attached.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedApp.documents?.map((doc) => (
                        <div
                          key={doc.id}
                          className="rounded border p-2.5 flex items-center justify-between bg-card"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-medium">{doc.document?.file_name || 'Land Document'}</span>
                            {doc.is_clarification_evidence && (
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700">
                                Clarification Evidence
                              </Badge>
                            )}
                          </div>
                          {doc.document?.file_path && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => downloadDoc(doc.document!.file_path)}
                            >
                              <Download className="mr-1 h-3 w-3" /> View
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="space-y-2 pt-2 border-t">
                  <span className="font-semibold block flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Full Case Timeline
                  </span>

                  <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {(selectedApp.timeline || []).map((event) => (
                      <div key={event.id} className="relative">
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
