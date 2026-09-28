import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { verificationService } from '@/services/verification/verificationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 10;

export default function VerificationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'all';
  const priority = searchParams.get('priority') || 'all';
  const [searchTerm, setSearchTerm] = useState(search);

  const { data: tasksData, isLoading, isError } = useQuery({
    queryKey: ['verification-tasks', page, search, status, priority],
    queryFn: () =>
      verificationService.getVerificationTasks({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
        priority: priority !== 'all' ? priority : undefined,
      }),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['verification-stats'],
    queryFn: () => verificationService.getVerificationStats(),
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

  const totalPages = tasksData ? Math.max(1, Math.ceil(tasksData.total / PAGE_SIZE)) : 1;

  const statusCards = useMemo(
    () => [
      { label: 'Pending', value: stats?.pending ?? 0, icon: AlertCircle },
      { label: 'In Review', value: stats?.inReview ?? 0, icon: ShieldCheck },
      { label: 'Approved', value: stats?.approved ?? 0, icon: CheckCircle2 },
      { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle },
    ],
    [stats]
  );

  const getStatusBadge = (status: string | null | undefined) => {
    const label = status || 'QUEUED';
    switch (label) {
      case 'APPROVED':
        return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
      case 'REJECTED':
        return <Badge className="bg-rose-100 text-rose-800">Rejected</Badge>;
      case 'UNDER_REVIEW':
        return <Badge className="bg-blue-100 text-blue-800">In Review</Badge>;
      case 'ASSIGNED':
      case 'QUEUED':
        return <Badge className="bg-amber-100 text-amber-800">Queued</Badge>;
      case 'CORRECTION_REQUIRED':
        return <Badge className="bg-orange-100 text-orange-800">Correction Required</Badge>;
      default:
        return <Badge variant="outline">{label}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string | null | undefined) => {
    const label = priority || 'MEDIUM';
    switch (label) {
      case 'HIGH':
        return <Badge className="bg-rose-100 text-rose-800">High</Badge>;
      case 'CRITICAL':
        return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      case 'LOW':
        return <Badge className="bg-slate-100 text-slate-700">Low</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-800">Medium</Badge>;
    }
  };

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verification</h1>
          <p className="text-sm text-muted-foreground">Review uploaded land record documents and verify record integrity.</p>
        </div>
      </div>

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
                placeholder="Search by record, survey, or document name"
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="QUEUED">Queued</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="UNDER_REVIEW">In review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CORRECTION_REQUIRED">Correction required</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priority} onValueChange={(value) => handleFilterChange('priority', value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
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
                <TableHead>Task</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-destructive">
                    Failed to load verification tasks.
                  </TableCell>
                </TableRow>
              ) : !tasksData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No verification tasks found.
                  </TableCell>
                </TableRow>
              ) : (
                tasksData.data.map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div className="font-medium">{task.id.slice(0, 8)}...</div>
                      <div className="text-xs text-muted-foreground">{new Date(task.created_at).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{task.land_records?.record_number || '—'}</div>
                      <div className="text-xs text-muted-foreground">{task.land_records?.survey_number || '—'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{task.documents?.original_filename || '—'}</div>
                      <div className="text-xs text-muted-foreground">{task.documents?.document_type || '—'}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/verification/${task.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Showing {tasksData?.data.length || 0} of {tasksData?.total || 0} tasks
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
            <div className="text-sm font-medium">Page {page} of {totalPages}</div>
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
