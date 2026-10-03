import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { riskService } from '@/services/risk/riskService';
import { useAuth } from '@/hooks/auth/useAuth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 10;

export default function RiskIntelligencePage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [recomputeFeedback, setRecomputeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const page = Number(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const riskLevel = searchParams.get('risk') || 'all';
  const status = searchParams.get('status') || 'all';
  const [searchTerm, setSearchTerm] = useState(search);

  const { data: assessmentsData, isLoading, isError } = useQuery({
    queryKey: ['risk-assessments', page, search, riskLevel, status],
    queryFn: () =>
      riskService.getRiskAssessments({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        risk_level: riskLevel !== 'all' ? riskLevel : undefined,
        status: status !== 'all' ? status : undefined,
      }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['risk-stats'],
    queryFn: () => riskService.getRiskStats(),
  });

  const recomputeMutation = useMutation({
    mutationFn: (landRecordId: string) => riskService.recomputeRiskAssessment(landRecordId),
    onSuccess: () => {
      setRecomputeFeedback({ type: 'success', message: 'Risk assessment recalculated from current database evidence.' });
      void queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
      void queryClient.invalidateQueries({ queryKey: ['risk-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'] });
    },
    onError: (error: Error) => setRecomputeFeedback({ type: 'error', message: error.message }),
  });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchTerm) next.set('search', searchTerm);
    else next.delete('search');
    next.set('page', '1');
    setSearchParams(next);
  };

  const handleFilterChange = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };

  const totalPages = assessmentsData ? Math.max(1, Math.ceil(assessmentsData.total / PAGE_SIZE)) : 1;

  const summaryCards = useMemo(
    () => [
      { label: 'Total', value: stats?.total ?? 0, icon: ShieldAlert },
      { label: 'High Risk', value: stats?.highRisk ?? 0, icon: AlertTriangle },
      { label: 'Moderate', value: stats?.moderateRisk ?? 0, icon: ShieldAlert },
      { label: 'Under Review', value: stats?.underInvestigation ?? 0, icon: Search },
    ],
    [stats]
  );

  const getRiskBadge = (level?: string | null) => {
    const label = level || 'LOW';
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

  const getStatusBadge = (value?: string | null) => {
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

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Risk Intelligence</h1>
        <p className="text-sm text-muted-foreground">Review persisted risk assessments and signals for authorized investigation.</p>
      </div>

      {recomputeFeedback && (
        <Alert variant={recomputeFeedback.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{recomputeFeedback.type === 'error' ? 'Risk recalculation failed' : 'Risk recalculation complete'}</AlertTitle>
          <AlertDescription>{recomputeFeedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-bold">{statsLoading ? '—' : value}</p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col gap-4 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by record, survey, patta, or location"
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={riskLevel} onValueChange={(value) => handleFilterChange('risk', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Risk level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risk levels</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MODERATE">Moderate</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under review</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="REOPENED">Reopened</SelectItem>
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
                <TableHead>Record</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signals</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-destructive">
                    Failed to load risk assessments.
                  </TableCell>
                </TableRow>
              ) : !assessmentsData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No risk assessments available.
                  </TableCell>
                </TableRow>
              ) : (
                assessmentsData.data.map((assessment: any) => (
                  <TableRow key={assessment.id}>
                    <TableCell>
                      <div className="font-medium">{assessment.land_records?.record_number || '—'}</div>
                      <div className="text-xs text-muted-foreground">{assessment.land_records?.survey_number || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{assessment.land_records?.villages?.name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{assessment.land_records?.taluks?.name || 'Unknown'}</div>
                    </TableCell>
                    <TableCell>{getRiskBadge(assessment.risk_level)}</TableCell>
                    <TableCell>{assessment.risk_score != null ? `${assessment.risk_score}` : '—'}</TableCell>
                    <TableCell>{getStatusBadge(assessment.status)}</TableCell>
                    <TableCell>{assessment.risk_signals?.length ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {(hasPermission('risk:manage') || hasPermission('risk:investigate')) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setRecomputeFeedback(null);
                            recomputeMutation.mutate(assessment.land_record_id);
                          }}
                          disabled={recomputeMutation.isPending}
                          aria-label="Recalculate risk from current evidence"
                          title="Recalculate risk"
                        >
                          <RefreshCw className={`h-4 w-4 ${recomputeMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/risk/${assessment.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t p-4 bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Showing {assessmentsData?.data.length ?? 0} of {assessmentsData?.total ?? 0} assessments
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                const next = new URLSearchParams(searchParams);
                next.set('page', String(nextPage));
                setSearchParams(next);
              }}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Prev
            </Button>
            <div className="text-sm font-medium px-2">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextPage = Math.min(totalPages, page + 1);
                const next = new URLSearchParams(searchParams);
                next.set('page', String(nextPage));
                setSearchParams(next);
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
