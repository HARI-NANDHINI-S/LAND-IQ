import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, AlertTriangle, FileWarning, 
  ShieldAlert, Clock, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { landRecordService } from '@/services/land-records/landRecordService';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Dashboard statistics query
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats', user?.id, user?.profile?.state_id, user?.profile?.district_id],
    queryFn: async () => {
      const [totalRecords, pendingVerif, highRisk, activeAlerts] = await Promise.all([
        supabase.from('land_records').select('id', { count: 'exact', head: true }),
        supabase.from('verification_tasks').select('id', { count: 'exact', head: true }).in('status', ['QUEUED', 'ASSIGNED']),
        supabase.from('risk_assessments').select('id', { count: 'exact', head: true }).in('risk_level', ['HIGH', 'CRITICAL']),
        supabase.from('alerts').select('id', { count: 'exact', head: true }).neq('status', 'RESOLVED'),
      ]);

      const queryError = [totalRecords.error, pendingVerif.error, highRisk.error, activeAlerts.error].find(Boolean);
      if (queryError) throw queryError;

      return {
        totalRecords: totalRecords.count ?? 0,
        pendingVerification: pendingVerif.count ?? 0,
        highRiskRecords: highRisk.count ?? 0,
        activeAlerts: activeAlerts.count ?? 0,
      };
    }
  });

  // Recent records query
  const { data: recentRecordsData, isLoading: recordsLoading, error: recordsError } = useQuery({
    queryKey: ['recent-records', user?.id],
    queryFn: () => landRecordService.getLandRecords({ pageSize: 5 }),
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'PENDING': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'UNDER_REVIEW': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'REJECTED': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
      case 'CORRECTION_REQUIRED': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  };

  const isError = statsError || recordsError;
  const isLoading = statsLoading || recordsLoading;

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Land Records Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Monitor land records, verification, documents, and risk activity.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchStats()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isError ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="font-medium text-destructive">Unable to load dashboard data.</p>
            <p className="text-sm text-destructive/80">Please check your connection and try again.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Total Land Records" 
              value={stats?.totalRecords} 
              icon={<FileText />} 
              loading={statsLoading}
              description="Records in your scope"
            />
            <StatCard 
              title="Pending Verification" 
              value={stats?.pendingVerification} 
              icon={<Clock className="text-amber-500" />} 
              loading={statsLoading}
              description="Awaiting review"
            />
            <StatCard 
              title="High/Critical Risk Assessments"
              value={stats?.highRiskRecords} 
              icon={<ShieldAlert className="text-rose-500" />} 
              loading={statsLoading}
              description="Stored assessment records"
            />
            <StatCard 
              title="Active Alerts" 
              value={stats?.activeAlerts} 
              icon={<FileWarning className="text-orange-500" />} 
              loading={statsLoading}
              description="Unresolved system alerts"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Recent Land Records</CardTitle>
                <CardDescription>Recently created or updated records in your jurisdiction.</CardDescription>
              </CardHeader>
              <CardContent>
                {recordsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : !recentRecordsData?.data.length ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-base font-medium text-muted-foreground">No land records found</p>
                    <p className="text-sm text-muted-foreground/80 mt-1">There are no records available in your authorized scope.</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Record Number</TableHead>
                          <TableHead>Survey / Patta</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentRecordsData.data.map((record: any) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{record.record_number}</TableCell>
                            <TableCell>
                              <div className="text-sm">{record.survey_number}</div>
                              <div className="text-xs text-muted-foreground">{record.patta_number || '-'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm truncate max-w-[150px]" title={record.villages?.name}>
                                {record.villages?.name || 'Unknown'}
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {record.taluks?.name || ''}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("border-0 font-medium", getStatusColor(record.verification_status))}>
                                {formatStatus(record.verification_status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {new Date(record.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
