import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, Search, Eye, Edit2, 
  ChevronLeft, ChevronRight, MapPin 
} from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { landRecordService } from '@/services/land-records/landRecordService';
import { geoService } from '@/services/geographic/geoService';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, } from '@/components/ui/card';
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from '@/components/ui/select';

export default function LandRecordsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL State
  const page = parseInt(searchParams.get('page') || '1', 10);
  const search = searchParams.get('search') || '';
  const districtId = searchParams.get('district') || 'all';
  const status = searchParams.get('status') || 'all';

  const [searchTerm, setSearchTerm] = useState(search);

  // Queries
  const { data: recordsData, isLoading, isError } = useQuery({
    queryKey: ['land-records', page, search, districtId, status],
    queryFn: () => landRecordService.getLandRecords({
      page,
      pageSize: 10,
      search: search || undefined,
      district_id: districtId !== 'all' ? districtId : undefined,
      verification_status: status !== 'all' ? status : undefined,
    }),
  });

  const { data: districts } = useQuery({
    queryKey: ['districts'],
    queryFn: () => geoService.getDistricts(),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
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

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'APPROVED': return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">Approved</Badge>;
      case 'PENDING': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Pending</Badge>;
      case 'UNDER_REVIEW': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">In Review</Badge>;
      case 'REJECTED': return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-200">Rejected</Badge>;
      case 'CORRECTION_REQUIRED': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Needs Correction</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalPages = recordsData?.total ? Math.ceil(recordsData.total / 10) : 1;

  return (
    <div className="flex h-full flex-col p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Land Records</h1>
          <p className="text-sm text-muted-foreground">Manage, search and verify digitized land records.</p>
        </div>
        
        {hasPermission('land_record:create') && (
          <Button onClick={() => navigate('/land-records/new')}>
            <Plus className="mr-2 h-4 w-4" /> Add Record
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by Survey, Patta or Record No..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={districtId} onValueChange={(val) => handleFilterChange('district', val)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts?.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={status} onValueChange={(val) => handleFilterChange('status', val)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="UNDER_REVIEW">In Review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CORRECTION_REQUIRED">Needs Correction</SelectItem>
                </SelectContent>
              </Select>

              <Button type="submit" variant="secondary">Filter</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record Number</TableHead>
                <TableHead>Survey / Patta</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-destructive">
                    Failed to load records. Please try again.
                  </TableCell>
                </TableRow>
              ) : !recordsData?.data.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <MapPin className="h-8 w-8 mb-2 opacity-20" />
                      <p>No land records found matching your filters.</p>
                      <Button variant="link" onClick={() => navigate('/land-records')}>Clear filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                recordsData.data.map((record: any) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.record_number}</TableCell>
                    <TableCell>
                      <div className="font-medium">{record.survey_number}</div>
                      <div className="text-xs text-muted-foreground">Patta: {record.patta_number || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{record.villages?.name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{record.taluks?.name}, {record.districts?.name}</div>
                    </TableCell>
                    <TableCell>{record.land_area ? `${record.land_area} ${record.land_area_unit || 'acres'}` : '-'}</TableCell>
                    <TableCell>{getStatusBadge(record.verification_status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/land-records/' + record.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {hasPermission('land_record:update') && (
                          <Button variant="ghost" size="icon" onClick={() => navigate('/land-records/' + record.id + '/edit')}>
                            <Edit2 className="h-4 w-4" />
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
        
        {/* Pagination */}
        <div className="border-t p-4 flex items-center justify-between bg-muted/20">
          <div className="text-sm text-muted-foreground">
            Showing {recordsData?.data.length || 0} of {recordsData?.total || 0} records
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleFilterChange('page', String(Math.max(1, page - 1)))}
              disabled={page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <div className="text-sm font-medium px-2">
              Page {page} of {totalPages}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleFilterChange('page', String(Math.min(totalPages, page + 1)))}
              disabled={page >= totalPages || isLoading}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
