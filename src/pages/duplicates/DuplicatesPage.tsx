import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { duplicateService } from '@/services/duplicateService';
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

export default function DuplicatesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const page = Number(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'all';
  const minSimilarity = searchParams.get('similarity') || 'all';
  const [searchTerm, setSearchTerm] = useState(search);

  const { data: candidatesData, isLoading, isError } = useQuery({
    queryKey: ['duplicate-candidates', page, search, status, minSimilarity],
    queryFn: () =>
      duplicateService.getDuplicateCandidates({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
        minSimilarity: minSimilarity !== 'all' ? Number(minSimilarity) : undefined,
      }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['duplicate-stats'],
    queryFn: () => duplicateService.getDuplicateStats(),
  });

  const scanMutation = useMutation({
    mutationFn: () => duplicateService.scanDuplicateCandidates(),
    onSuccess: (count) => {
      setScanFeedback({ type: 'success', message: `Scan completed. ${count} candidate pairs were created or refreshed.` });
      void queryClient.invalidateQueries({ queryKey: ['duplicate-candidates'] });
      void queryClient.invalidateQueries({ queryKey: ['duplicate-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['risk-assessments'] });
      void queryClient.invalidateQueries({ queryKey: ['risk-stats'] });
    },
    onError: (error: Error) => setScanFeedback({ type: 'error', message: error.message }),
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

  const totalPages = candidatesData ? Math.max(1, Math.ceil(candidatesData.total / PAGE_SIZE)) : 1;

  const statusCards = useMemo(
    () => [
      { label: 'Pending', value: stats?.pending ?? 0, icon: AlertTriangle },
      { label: 'Under Review', value: stats?.underReview ?? 0, icon: Search },
      { label: 'Confirmed', value: stats?.confirmed ?? 0, icon: ShieldCheck },
      { label: 'Not Duplicate', value: stats?.notDuplicate ?? 0, icon: Users },
    ],
    [stats]
  );

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

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Duplicate Records</h1>
          <p className="text-sm text-muted-foreground">Review persisted duplicate candidates and resolve matches using the live database records.</p>
        </div>
        {hasPermission('duplicate:scan') && (
          <Button
            type="button"
            onClick={() => {
              setScanFeedback(null);
              scanMutation.mutate();
            }}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? 'Scanning…' : 'Scan records'}
          </Button>
        )}
      </div>

      {scanFeedback && (
        <Alert variant={scanFeedback.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{scanFeedback.type === 'error' ? 'Duplicate scan failed' : 'Duplicate scan complete'}</AlertTitle>
          <AlertDescription>{scanFeedback.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statusCards.map(({ label, value, icon: Icon }) => (
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
                placeholder="Search by record or survey number"
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under review</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="FALSE_POSITIVE">Not duplicate</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                  <SelectItem value="LEGITIMATE_SUBDIVISION">Legitimate subdivision</SelectItem>
                </SelectContent>
              </Select>

              <Select value={minSimilarity} onValueChange={(value) => handleFilterChange('similarity', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Similarity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any similarity</SelectItem>
                  <SelectItem value="75">75%+</SelectItem>
                  <SelectItem value="85">85%+</SelectItem>
                  <SelectItem value="90">90%+</SelectItem>
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
                <TableHead>Candidate</TableHead>
                <TableHead>Record A</TableHead>
                <TableHead>Record B</TableHead>
                <TableHead>Similarity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-destructive">
                    Failed to load duplicate candidates.
                  </TableCell>
                </TableRow>
              ) : !candidatesData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No duplicate candidates require review.
                  </TableCell>
                </TableRow>
              ) : (
                candidatesData.data.map((candidate: any) => (
                  <TableRow key={candidate.id}>
                    <TableCell>
                      <div className="font-medium">#{candidate.id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(candidate.created_at).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{candidate.record_a?.record_number || '—'}</div>
                      <div className="text-xs text-muted-foreground">{candidate.record_a?.survey_number || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{candidate.record_b?.record_number || '—'}</div>
                      <div className="text-xs text-muted-foreground">{candidate.record_b?.survey_number || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{candidate.similarity_score != null ? `${candidate.similarity_score}%` : '—'}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(candidate.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/duplicates/${candidate.id}`)}>
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
            Showing {candidatesData?.data.length ?? 0} of {candidatesData?.total ?? 0} candidates
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
