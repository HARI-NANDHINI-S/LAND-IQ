import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, Edit2, FileText, MapPin, Users, 
  ShieldCheck, FileWarning, Clock 
} from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { landRecordService } from '@/services/land-records/landRecordService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function LandRecordDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const { data: record, isLoading, isError } = useQuery({
    queryKey: ['land-record', id],
    queryFn: () => landRecordService.getLandRecord(id!),
    enabled: !!id,
  });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'APPROVED': return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
      case 'PENDING': return <Badge className="bg-amber-100 text-amber-800">Pending</Badge>;
      case 'UNDER_REVIEW': return <Badge className="bg-blue-100 text-blue-800">In Review</Badge>;
      case 'REJECTED': return <Badge className="bg-rose-100 text-rose-800">Rejected</Badge>;
      case 'CORRECTION_REQUIRED': return <Badge className="bg-orange-100 text-orange-800">Needs Correction</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
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
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (isError || !record) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <FileWarning className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Record Not Found</h2>
        <p className="text-muted-foreground text-sm">The land record could not be found or you don't have permission to view it.</p>
        <Button onClick={() => navigate('/land-records')}>Return to Records</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/land-records')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Record {record.record_number}</h1>
              {getStatusBadge(record.verification_status)}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {record.villages?.name}, {record.taluks?.name}, {record.districts?.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasPermission('land_record:update') && (
            <Button onClick={() => navigate('/land-records/' + id + '/edit')}>
              <Edit2 className="mr-2 h-4 w-4" /> Edit Record
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <TabsList className="w-full sm:w-auto self-start justify-start overflow-x-auto">
          <TabsTrigger value="overview"><FileText className="h-4 w-4 mr-2" /> Overview</TabsTrigger>
          <TabsTrigger value="owners"><Users className="h-4 w-4 mr-2" /> Owners ({(record.land_record_owners as any[])?.length || 0})</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-2" /> Documents ({(record.documents as any[])?.length || 0})</TabsTrigger>
          <TabsTrigger value="verification"><ShieldCheck className="h-4 w-4 mr-2" /> Verification</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6 flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Identifiers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Survey Number</div>
                  <div className="font-medium text-lg">{record.survey_number}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Patta Number</div>
                  <div className="font-medium">{record.patta_number || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Record Number</div>
                  <div className="font-medium">{record.record_number}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Area</div>
                  <div className="font-medium">{record.land_area || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Land Type</div>
                  <div className="font-medium">{record.land_type || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Record Status</div>
                  <div className="font-medium">{record.record_status}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase">System</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/> Created At</div>
                  <div className="font-medium">{new Date(record.created_at).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/> Last Updated</div>
                  <div className="font-medium">{new Date(record.updated_at).toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="owners" className="mt-6 flex-1">
          <Card>
            <CardHeader>
              <CardTitle>Ownership Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!(record.land_record_owners as any[])?.length ? (
                <div className="text-sm text-muted-foreground py-4">No owners linked to this record.</div>
              ) : (
                <div className="divide-y border rounded-md">
                  {(record.land_record_owners as any[]).map((ro: any) => (
                    <div key={ro.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <div className="font-medium">{ro.land_owners?.full_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {ro.land_owners?.identifier_type}: {ro.land_owners?.identifier_hash ? '********' : 'Not provided'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{ro.ownership_percentage}% Share</div>
                        <Badge variant="outline" className="mt-1">{ro.ownership_type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents" className="mt-6 flex-1">
          <Card>
            <CardHeader>
              <CardTitle>Linked Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {!(record.documents as any[])?.length ? (
                <div className="text-sm text-muted-foreground py-4">No documents linked to this record.</div>
              ) : (
                <div className="divide-y border rounded-md">
                  {(record.documents as any[]).map((doc: any) => (
                    <div key={doc.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <div className="font-medium text-primary flex items-center gap-2">
                          <FileText className="h-4 w-4" /> {doc.original_filename}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Type: {doc.document_type} • Uploaded: {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{doc.processing_status}</Badge>
                        <Badge variant="outline">{doc.verification_status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verification" className="mt-6 flex-1">
           <Card>
            <CardHeader>
              <CardTitle>Verification Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {!(record.verification_tasks as any[])?.length ? (
                <div className="text-sm text-muted-foreground py-4">No verification tasks found.</div>
              ) : (
                <div className="divide-y border rounded-md">
                  {(record.verification_tasks as any[]).map((task: any) => (
                    <div key={task.id} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <div className="font-medium">Task ID: {task.id.slice(0,8)}...</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Created: {new Date(task.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Badge variant={task.priority === 'HIGH' ? 'destructive' : 'secondary'}>
                           {task.priority} Priority
                         </Badge>
                         <Badge variant="outline">{task.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
