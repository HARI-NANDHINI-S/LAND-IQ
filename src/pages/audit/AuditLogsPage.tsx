import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Filter, FileText } from 'lucide-react';
import { auditService } from '@/services/audit/auditService';
import { useAuth } from '@/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formatDate = (dateString: string) => {
  const d = new Date(dateString);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
};

const formatCSVDate = (dateString: string) => {
  const d = new Date(dateString);
  return d.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '');
};
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ENTITY_TYPES = [
  'LAND_RECORD', 'DOCUMENT', 'USER', 'PROFILE', 'ROLE',
  'VERIFICATION_TASK', 'DUPLICATE_CANDIDATE', 'RISK_ASSESSMENT',
  'ALERT', 'WATCHLIST', 'SETTING', 'SYSTEM'
];

export default function AuditLogsPage() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', search, entityType, status],
    queryFn: () => auditService.getAuditLogs({
      search,
      entity_type: entityType === 'ALL' ? undefined : entityType,
      status: status === 'ALL' ? undefined : status,
      pageSize: 50,
    }),
    enabled: hasPermission('audit:read'),
  });

  if (!hasPermission('audit:read')) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          You do not have permission to view audit logs.
        </div>
      </div>
    );
  }

  const handleExport = async () => {
    try {
      const data = await auditService.exportAuditLogs({
        search,
        entity_type: entityType === 'ALL' ? undefined : entityType,
        status: status === 'ALL' ? undefined : status,
      });

      if (!data.length) return;

      const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Status', 'Remarks', 'IP Address'];
      const csvContent = [
        headers.join(','),
        ...data.map(log => [
          log.created_at,
          `"${log.profiles?.full_name || 'System'}"`,
          log.actor_role,
          log.action,
          log.entity_type,
          log.entity_id,
          log.status,
          `"${log.remarks || ''}"`,
          log.ip_address || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `audit_logs_${formatCSVDate(new Date().toISOString())}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV', err);
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Immutable audit trail of system activity and modifications.</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search events, actors, or metadata..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Entity Type" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Entities</SelectItem>
            {ENTITY_TYPES.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="SUCCESS">Success</SelectItem>
            <SelectItem value="FAILURE">Failure</SelectItem>
            <SelectItem value="DENIED">Denied</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading audit trail...
                </TableCell>
              </TableRow>
            ) : !logs?.data?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No audit logs found matching criteria.
                </TableCell>
              </TableRow>
            ) : (
              logs.data.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.profiles?.full_name || 'System'}</span>
                      <span className="text-xs text-muted-foreground">{log.actor_role}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs font-normal">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{log.entity_type}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={log.entity_id}>
                        {log.entity_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={log.status === 'SUCCESS' ? 'default' : 'destructive'}
                      className={log.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Event Details</DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Timestamp</div>
                  <div className="font-medium">{formatDate(selectedLog.created_at)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Action</div>
                  <Badge variant="outline" className="font-mono">{selectedLog.action}</Badge>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Actor</div>
                  <div className="font-medium">{selectedLog.profiles?.full_name || 'System'} ({selectedLog.actor_role})</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Status</div>
                  <Badge variant={selectedLog.status === 'SUCCESS' ? 'default' : 'destructive'}>
                    {selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Entity Type</div>
                  <div className="font-medium">{selectedLog.entity_type}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Entity ID</div>
                  <div className="font-mono text-xs">{selectedLog.entity_id}</div>
                </div>
              </div>

              {selectedLog.remarks && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Remarks</div>
                  <div className="bg-muted p-3 rounded-md text-sm">{selectedLog.remarks}</div>
                </div>
              )}

              {(selectedLog.before_state || selectedLog.after_state) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                      <CardTitle className="text-sm font-medium">Before State</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <pre className="p-4 text-xs font-mono overflow-auto max-h-[300px] text-muted-foreground">
                        {selectedLog.before_state ? JSON.stringify(selectedLog.before_state, null, 2) : 'null'}
                      </pre>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                      <CardTitle className="text-sm font-medium">After State</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <pre className="p-4 text-xs font-mono overflow-auto max-h-[300px] text-foreground">
                        {selectedLog.after_state ? JSON.stringify(selectedLog.after_state, null, 2) : 'null'}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
