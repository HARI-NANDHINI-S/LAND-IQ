import { useDeferredValue, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ChevronLeft, ChevronRight, FileText, Layers3, MapPinned, MapPin, Search, ShieldAlert, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { gisService, type GeographyHierarchy, type SpatialBounds } from '@/services/gisService';
import LandRecordSpatialMap from '@/components/gis/LandRecordSpatialMap';
import { landRecordService } from '@/services/land-records/landRecordService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE_SIZE = 10;

function statusColor(status: string) {
  switch (status) {
    case 'APPROVED':
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-800';
    case 'PENDING':
      return 'bg-amber-100 text-amber-800';
    case 'UNDER_REVIEW':
      return 'bg-blue-100 text-blue-800';
    case 'REJECTED':
    case 'ARCHIVED':
      return 'bg-slate-100 text-slate-700';
    case 'CORRECTION_REQUIRED':
    case 'INACTIVE':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatArea(value: number, unit: string) {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value)} ${unit}`;
}

function SummaryBreakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort(([left], [right]) => left.localeCompare(right));
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>
      {entries.length ? <div className="flex flex-wrap gap-2">{entries.map(([label, value]) => <Badge key={label} variant="secondary">{label.replace(/_/g, ' ')} · {value}</Badge>)}</div> : <p className="text-sm text-muted-foreground">No records</p>}
    </div>
  );
}

export default function GISMappingPage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const geoJsonInputRef = useRef<HTMLInputElement | null>(null);
  const [stateId, setStateId] = useState('ALL');
  const [districtId, setDistrictId] = useState('ALL');
  const [talukId, setTalukId] = useState('ALL');
  const [villageId, setVillageId] = useState('ALL');
  const [verificationStatus, setVerificationStatus] = useState('ALL');
  const [recordStatus, setRecordStatus] = useState('ALL');
  const [landType, setLandType] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<SpatialBounds | null>(null);
  const [nearbySearchEnabled, setNearbySearchEnabled] = useState(false);
  const [nearbyPoint, setNearbyPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapFeedback, setMapFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const search = useDeferredValue(searchInput.trim());

  const canRead = hasPermission('land_record:read');
  const profile = user?.profile;
  const roleCode = user?.role?.code;
  const profileStateId = profile?.state_id ?? undefined;
  const profileDistrictId = profile?.district_id ?? undefined;
  const isStateScoped = roleCode === 'STATE_ADMIN' && !!profileStateId;
  const isDistrictScoped = ['DISTRICT_OFFICER', 'DATA_ENTRY_OFFICER', 'VERIFICATION_OFFICER', 'VIEWER'].includes(roleCode ?? '') && !!profileDistrictId;
  const lockedStateId = isStateScoped || isDistrictScoped ? profileStateId : undefined;

  const effectiveDistrict = isDistrictScoped ? profileDistrictId! : districtId !== 'ALL' ? districtId : undefined;
  const geographyQuery = useQuery({
    queryKey: ['gis-geography', stateId, effectiveDistrict, talukId],
    queryFn: () => gisService.getGeographyHierarchy({
      state_id: lockedStateId ?? (stateId !== 'ALL' ? stateId : undefined),
      district_id: effectiveDistrict,
      taluk_id: villageId !== 'ALL' ? talukId : talukId !== 'ALL' ? talukId : undefined,
    }),
    enabled: canRead,
  });
  const geography = geographyQuery.data as GeographyHierarchy | undefined;

  const filters = {
    state_id: lockedStateId ?? (stateId !== 'ALL' ? stateId : undefined),
    district_id: effectiveDistrict,
    taluk_id: talukId !== 'ALL' ? talukId : undefined,
    village_id: villageId !== 'ALL' ? villageId : undefined,
    verification_status: verificationStatus !== 'ALL' ? verificationStatus : undefined,
    record_status: recordStatus !== 'ALL' ? recordStatus : undefined,
    land_type: landType !== 'ALL' ? landType : undefined,
    search: search || undefined,
  };

  const summaryQuery = useQuery({
    queryKey: ['gis-summary', filters],
    queryFn: () => gisService.getSummary(filters),
    enabled: canRead,
  });
  const spatialExtentQuery = useQuery({
    queryKey: ['gis-spatial-extent'],
    queryFn: () => gisService.getSpatialExtent(),
    enabled: canRead,
    staleTime: 60_000,
  });
  const recordsQuery = useQuery({
    queryKey: ['gis-records', filters, page],
    queryFn: () => landRecordService.getLandRecords({ ...filters, page, pageSize: PAGE_SIZE }),
    enabled: canRead,
  });
  const landTypesQuery = useQuery({
    queryKey: ['gis-land-types'],
    queryFn: () => gisService.getLandTypeOptions(),
    enabled: canRead,
  });
  const selectedRecordQuery = useQuery({
    queryKey: ['land-record', selectedRecordId],
    queryFn: () => landRecordService.getLandRecord(selectedRecordId!),
    enabled: !!selectedRecordId,
  });
  const spatialQuery = useQuery({
    queryKey: ['gis-spatial-records', filters, mapBounds],
    queryFn: () => gisService.getSpatialLandRecords(mapBounds!, filters),
    enabled: canRead && !!mapBounds && mapBounds.west < mapBounds.east,
    staleTime: 30_000,
  });
  const nearbyQuery = useQuery({
    queryKey: ['gis-nearby-records', nearbyPoint],
    queryFn: () => gisService.getNearbyLandRecords(nearbyPoint!.latitude, nearbyPoint!.longitude),
    enabled: canRead && !!nearbyPoint,
    staleTime: 30_000,
  });
  const recordContextQuery = useQuery({
    queryKey: ['gis-record-context', selectedRecordId],
    queryFn: () => gisService.getRecordContext(selectedRecordId!),
    enabled: !!selectedRecordId,
  });
  const importGeoJsonMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 5 * 1024 * 1024) throw new Error('GeoJSON imports must be 5 MB or smaller.');
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error('The selected file is not valid JSON.');
      }
      return gisService.importParcelGeoJSON(parsed);
    },
    onSuccess: (count) => {
      setMapFeedback({ type: 'success', message: `${count} parcel geometries imported from the selected GeoJSON.` });
      void queryClient.invalidateQueries({ queryKey: ['gis-spatial-records'] });
      void queryClient.invalidateQueries({ queryKey: ['gis-record-context'] });
    },
    onError: (error: Error) => setMapFeedback({ type: 'error', message: error.message }),
  });

  const resetPage = () => setPage(1);
  const setState = (value: string) => {
    setStateId(value);
    setDistrictId('ALL');
    setTalukId('ALL');
    setVillageId('ALL');
    resetPage();
  };
  const setDistrict = (value: string) => {
    setDistrictId(value);
    setTalukId('ALL');
    setVillageId('ALL');
    resetPage();
  };
  const setTaluk = (value: string) => {
    setTalukId(value);
    setVillageId('ALL');
    resetPage();
  };

  if (!canRead) {
    return <div className="p-6"><Alert variant="destructive"><AlertTitle>Access denied</AlertTitle><AlertDescription>You do not have permission to view land-record geography.</AlertDescription></Alert></div>;
  }

  const totalPages = Math.max(1, Math.ceil((recordsQuery.data?.total ?? 0) / PAGE_SIZE));
  const selectedState = geography?.states.find((item) => item.id === (stateId === 'ALL' ? lockedStateId : stateId));
  const selectedDistrict = geography?.districts.find((item) => item.id === effectiveDistrict);
  const selectedTaluk = geography?.taluks.find((item) => item.id === talukId);
  const selectedVillage = geography?.villages.find((item) => item.id === villageId);

  return (
    <div className="flex h-full flex-col space-y-6 overflow-y-auto p-6">
      <header>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary"><MapPinned className="h-5 w-5" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">GIS Mapping</h1><p className="text-sm text-muted-foreground">Explore land records by administrative geography.</p></div>
        </div>
      </header>

      <Alert>
        <MapPin className="h-4 w-4" />
        <AlertTitle>Spatial data is evidence-based</AlertTitle>
        <AlertDescription>Administrative areas are available for filtering. Parcel geometry and coordinates appear only when persisted from an authorized source; the map never estimates missing locations.</AlertDescription>
      </Alert>

      {mapFeedback && (
        <Alert variant={mapFeedback.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{mapFeedback.type === 'error' ? 'GIS operation failed' : 'GIS operation complete'}</AlertTitle>
          <AlertDescription>{mapFeedback.message}</AlertDescription>
        </Alert>
      )}

      {geographyQuery.isError && <Alert variant="destructive"><AlertTitle>Unable to load geography</AlertTitle><AlertDescription>{geographyQuery.error instanceof Error ? geographyQuery.error.message : 'Please retry.'}</AlertDescription></Alert>}
      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">Geography and record filters</CardTitle><CardDescription>Options and matching records are read from Supabase within your access scope.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={lockedStateId ?? stateId} onValueChange={setState} disabled={!!lockedStateId || geographyQuery.isLoading}>
              <SelectTrigger aria-label="Filter by state"><SelectValue placeholder="All states" /></SelectTrigger>
              <SelectContent>{!lockedStateId && <SelectItem value="ALL">All states</SelectItem>}{geography?.states.filter((item) => !lockedStateId || item.id === lockedStateId).map((state) => <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={isDistrictScoped ? profileDistrictId : districtId} onValueChange={setDistrict} disabled={isDistrictScoped || geographyQuery.isLoading}>
              <SelectTrigger aria-label="Filter by district"><SelectValue placeholder="All districts" /></SelectTrigger>
              <SelectContent>{!isDistrictScoped && <SelectItem value="ALL">All districts</SelectItem>}{geography?.districts.filter((district) => !isDistrictScoped || district.id === profileDistrictId).map((district) => <SelectItem key={district.id} value={district.id}>{district.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={talukId} onValueChange={setTaluk} disabled={geographyQuery.isLoading || !effectiveDistrict}>
              <SelectTrigger aria-label="Filter by taluk"><SelectValue placeholder="All taluks" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All taluks</SelectItem>{geography?.taluks.map((taluk) => <SelectItem key={taluk.id} value={taluk.id}>{taluk.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={villageId} onValueChange={(value) => { setVillageId(value); resetPage(); }} disabled={geographyQuery.isLoading || talukId === 'ALL'}>
              <SelectTrigger aria-label="Filter by village"><SelectValue placeholder="All villages" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All villages</SelectItem>{geography?.villages.map((village) => <SelectItem key={village.id} value={village.id}>{village.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative sm:col-span-2 xl:col-span-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); resetPage(); }} placeholder="Survey, patta, or record number" className="pl-9" aria-label="Search land records" /></div>
            <Select value={verificationStatus} onValueChange={(value) => { setVerificationStatus(value); resetPage(); }}><SelectTrigger aria-label="Filter verification status"><SelectValue placeholder="All verification statuses" /></SelectTrigger><SelectContent><SelectItem value="ALL">All verification statuses</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="UNDER_REVIEW">Under review</SelectItem><SelectItem value="APPROVED">Approved</SelectItem><SelectItem value="REJECTED">Rejected</SelectItem><SelectItem value="CORRECTION_REQUIRED">Correction required</SelectItem></SelectContent></Select>
            <Select value={recordStatus} onValueChange={(value) => { setRecordStatus(value); resetPage(); }}><SelectTrigger aria-label="Filter record status"><SelectValue placeholder="All record statuses" /></SelectTrigger><SelectContent><SelectItem value="ALL">All record statuses</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem><SelectItem value="ARCHIVED">Archived</SelectItem></SelectContent></Select>
            <Select value={landType} onValueChange={(value) => { setLandType(value); resetPage(); }}><SelectTrigger aria-label="Filter land type"><SelectValue placeholder="All land types" /></SelectTrigger><SelectContent><SelectItem value="ALL">All land types</SelectItem>{landTypesQuery.data?.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><MapPinned className="h-4 w-4" /> Parcel map</CardTitle>
            <CardDescription>Only imported parcel boundaries and recorded coordinates are shown.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={nearbySearchEnabled ? 'default' : 'outline'}
              onClick={() => {
                setNearbySearchEnabled((enabled) => !enabled);
                setNearbyPoint(null);
              }}
              aria-pressed={nearbySearchEnabled}
            >
              <Search className="mr-2 h-4 w-4" /> {nearbySearchEnabled ? 'Cancel nearby search' : 'Search nearby'}
            </Button>
            {hasPermission('gis:import') && (
              <>
                <input
                  ref={geoJsonInputRef}
                  type="file"
                  accept=".geojson,.json,application/geo+json,application/json"
                  className="sr-only"
                  aria-label="Select a GeoJSON parcel file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importGeoJsonMutation.mutate(file);
                    event.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => geoJsonInputRef.current?.click()}
                  disabled={importGeoJsonMutation.isPending}
                >
                  <Upload className="mr-2 h-4 w-4" /> {importGeoJsonMutation.isPending ? 'Importing…' : 'Import GeoJSON'}
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {nearbySearchEnabled && <p className="text-sm text-muted-foreground">Select a point on the map to find records within 1 km.</p>}
          <LandRecordSpatialMap
            records={spatialQuery.data ?? []}
            initialBounds={spatialExtentQuery.data ?? null}
            onBoundsChange={setMapBounds}
            onSelectRecord={setSelectedRecordId}
            onMapClick={(latitude, longitude) => {
              if (nearbySearchEnabled) setNearbyPoint({ latitude, longitude });
            }}
          />
          {spatialQuery.isError && <Alert variant="destructive"><AlertTitle>Spatial records unavailable</AlertTitle><AlertDescription>{spatialQuery.error instanceof Error ? spatialQuery.error.message : 'Unable to load records for this map area.'}</AlertDescription></Alert>}
          {spatialExtentQuery.isError && <Alert variant="destructive"><AlertTitle>Map extent unavailable</AlertTitle><AlertDescription>{spatialExtentQuery.error instanceof Error ? spatialExtentQuery.error.message : 'Unable to locate recorded spatial data.'}</AlertDescription></Alert>}
          {!spatialQuery.isLoading && !spatialQuery.isError && !spatialQuery.data?.length && (
            <p className="text-sm text-muted-foreground">Location unavailable for records in this map area. No persisted parcel geometry or coordinates were found for the current view.</p>
          )}
          {nearbyPoint && (
            <div className="space-y-2 rounded-md border p-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">Nearby records within 1 km</h3>
                <Button type="button" variant="ghost" size="sm" onClick={() => setNearbyPoint(null)}>Clear</Button>
              </div>
              {nearbyQuery.isLoading ? <Skeleton className="h-10 w-full" /> : nearbyQuery.isError ? (
                <Alert variant="destructive"><AlertDescription>{nearbyQuery.error instanceof Error ? nearbyQuery.error.message : 'Nearby search failed.'}</AlertDescription></Alert>
              ) : nearbyQuery.data?.length ? nearbyQuery.data.map((record) => (
                <button key={record.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setSelectedRecordId(record.id)}>
                  <span><span className="font-medium">{record.record_number}</span><span className="ml-2 text-muted-foreground">{record.survey_number}</span></span>
                  <span className="text-muted-foreground">{Math.round(record.distance_meters)} m</span>
                </button>
              )) : <p className="text-sm text-muted-foreground">No records with spatial data were found within 1 km.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="h-4 w-4" /> Administrative hierarchy</CardTitle><CardDescription>Selected path from real geography relationships</CardDescription></CardHeader>
          <CardContent>
            {geographyQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-5/6" /><Skeleton className="h-16 w-4/6" /></div> : (
              <ol className="space-y-3">
                {[
                  { level: 'State', value: selectedState?.name || (stateId === 'ALL' ? 'All states' : 'Selected state') },
                  { level: 'District', value: selectedDistrict?.name || (districtId === 'ALL' ? 'All districts' : 'Selected district') },
                  { level: 'Taluk', value: selectedTaluk?.name || (talukId === 'ALL' ? 'All taluks' : 'Selected taluk') },
                  { level: 'Village', value: selectedVillage?.name || (villageId === 'ALL' ? 'All villages' : 'Selected village') },
                ].map((node, index) => (
                  <li key={node.level} className="flex items-center gap-3" style={{ paddingLeft: `${index * 1.25}rem` }}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-background text-xs font-semibold text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0 border-l-2 border-muted py-1 pl-3"><div className="text-xs uppercase text-muted-foreground">{node.level}</div><div className="truncate font-medium">{node.value}</div></div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Selected area summary</CardTitle><CardDescription>Counts and land area from records matching the filters</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {summaryQuery.isError ? <Alert variant="destructive"><AlertTitle>Summary unavailable</AlertTitle><AlertDescription>{summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Could not calculate the summary.'}</AlertDescription></Alert> : summaryQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-10 w-24" /><Skeleton className="h-16 w-full" /><Skeleton className="h-12 w-full" /></div> : <>
              <div><div className="text-3xl font-semibold">{summaryQuery.data?.totalRecords ?? 0}</div><div className="text-sm text-muted-foreground">matching land records</div></div>
              <div><h3 className="mb-2 text-sm font-medium text-muted-foreground">Recorded area by unit</h3>{Object.keys(summaryQuery.data?.totalAreaByUnit ?? {}).length ? <div className="flex flex-wrap gap-2">{Object.entries(summaryQuery.data?.totalAreaByUnit ?? {}).map(([unit, area]) => <Badge key={unit} variant="outline">{formatArea(area, unit)}</Badge>)}</div> : <p className="text-sm text-muted-foreground">No area values recorded.</p>}</div>
              <SummaryBreakdown title="Verification status" values={summaryQuery.data?.verificationStatuses ?? {}} />
              <SummaryBreakdown title="Record status" values={summaryQuery.data?.recordStatuses ?? {}} />
              <SummaryBreakdown title="Land type" values={summaryQuery.data?.landTypes ?? {}} />
            </>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Land records</CardTitle><CardDescription>{recordsQuery.data?.total ?? '—'} matching records in your RLS-authorized scope</CardDescription></CardHeader>
        <CardContent>
          {recordsQuery.isError ? <Alert variant="destructive"><AlertTitle>Unable to load land records</AlertTitle><AlertDescription>{recordsQuery.error instanceof Error ? recordsQuery.error.message : 'Please retry.'}</AlertDescription></Alert> : recordsQuery.isLoading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : !recordsQuery.data?.data.length ? <div className="py-12 text-center"><MapPin className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" /><p className="font-medium">No records in this area</p><p className="mt-1 text-sm text-muted-foreground">No visible land records match the selected geography and filters.</p></div> : <>
            <div className="overflow-x-auto rounded-md border"><Table>
              <TableHeader><TableRow><TableHead>Record</TableHead><TableHead>Survey / patta</TableHead><TableHead>Village / taluk</TableHead><TableHead>Area</TableHead><TableHead>Verification</TableHead><TableHead>Record status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{recordsQuery.data.data.map((record) => <TableRow key={record.id} data-state={selectedRecordId === record.id ? 'selected' : undefined}>
                <TableCell><button className="font-medium text-primary hover:underline" onClick={() => setSelectedRecordId(record.id)}>{record.record_number}</button></TableCell>
                <TableCell>{record.survey_number} / {record.patta_number || '—'}</TableCell>
                <TableCell>{(record as any).villages?.name || '—'}<div className="text-xs text-muted-foreground">{(record as any).taluks?.name || '—'}</div></TableCell>
                <TableCell>{record.land_area == null ? '—' : `${record.land_area} ${record.land_area_unit || 'acres'}`}</TableCell>
                <TableCell><Badge className={statusColor(record.verification_status)}>{record.verification_status.replace(/_/g, ' ')}</Badge></TableCell>
                <TableCell><Badge className={statusColor(record.record_status)}>{record.record_status}</Badge></TableCell>
                <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link to={`/land-records/${record.id}`}>View record <ArrowUpRight className="ml-2 h-3.5 w-3.5" /></Link></Button></TableCell>
              </TableRow>)}</TableBody>
            </Table></div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
          </>}
        </CardContent>
      </Card>

      {selectedRecordId && <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Selected record context</CardTitle><CardDescription>Existing linked module records only</CardDescription></div><Button variant="outline" size="sm" asChild><Link to={`/land-records/${selectedRecordId}`}>View Land Record <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button></CardHeader>
        <CardContent>
          {selectedRecordQuery.isError ? <Alert variant="destructive"><AlertTitle>Record context unavailable</AlertTitle><AlertDescription>{selectedRecordQuery.error instanceof Error ? selectedRecordQuery.error.message : 'This record may be outside your scope.'}</AlertDescription></Alert> : selectedRecordQuery.isLoading ? <Skeleton className="h-24 w-full" /> : selectedRecordQuery.data && <>
            <div className="mb-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><span className="text-muted-foreground">Record number</span><p className="font-medium">{selectedRecordQuery.data.record_number}</p></div>
              <div><span className="text-muted-foreground">Survey / patta</span><p className="font-medium">{selectedRecordQuery.data.survey_number} / {selectedRecordQuery.data.patta_number || '—'}</p></div>
              <div><span className="text-muted-foreground">Village · taluk · district</span><p className="font-medium">{(selectedRecordQuery.data as any).villages?.name || '—'} · {(selectedRecordQuery.data as any).taluks?.name || '—'} · {(selectedRecordQuery.data as any).districts?.name || '—'}</p></div>
              <div><span className="text-muted-foreground">Area · land type</span><p className="font-medium">{selectedRecordQuery.data.land_area == null ? '—' : `${selectedRecordQuery.data.land_area} ${selectedRecordQuery.data.land_area_unit || 'acres'}`} · {selectedRecordQuery.data.land_type || '—'}</p></div>
            </div>
            {recordContextQuery.isError && <Alert variant="destructive"><AlertTitle>Related module data unavailable</AlertTitle><AlertDescription>{recordContextQuery.error instanceof Error ? recordContextQuery.error.message : 'The land record itself is still available.'}</AlertDescription></Alert>}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ContextLinks title="Risk assessments" icon={<ShieldAlert className="h-4 w-4" />} empty="No linked assessment" rows={recordContextQuery.data?.riskAssessments ?? []} render={(item: any) => <Link className="text-primary hover:underline" to={`/risk/${item.id}`}>{item.risk_level || 'Unrated'} · {item.status || 'No status'}</Link>} />
              <ContextLinks title="Duplicate candidates" icon={<Layers3 className="h-4 w-4" />} empty="No linked candidate" rows={recordContextQuery.data?.duplicateCandidates ?? []} render={(item: any) => <Link className="text-primary hover:underline" to={`/duplicates/${item.id}`}>{item.status} · {item.similarity_score ?? '—'}</Link>} />
              <ContextLinks title="Verification tasks" icon={<FileText className="h-4 w-4" />} empty="No linked task" rows={recordContextQuery.data?.verificationTasks ?? []} render={(item: any) => <Link className="text-primary hover:underline" to={`/verification/${item.id}`}>{item.status} · {item.priority || '—'}</Link>} />
              <ContextLinks title="Documents" icon={<FileText className="h-4 w-4" />} empty="No linked document" rows={recordContextQuery.data?.documents ?? []} render={(item: any) => <Link className="text-primary hover:underline" to={`/documents/${item.id}`}>{item.original_filename}</Link>} />
            </div>
          </>}
        </CardContent>
      </Card>}
    </div>
  );
}

function ContextLinks({ title, icon, empty, rows, render }: { title: string; icon: React.ReactNode; empty: string; rows: unknown[]; render: (row: unknown) => React.ReactNode }) {
  return <div className="rounded-md border p-3"><h3 className="mb-2 flex items-center gap-2 text-sm font-medium">{icon}{title}</h3>{rows.length ? <ul className="space-y-2">{rows.map((row, index) => <li key={(row as { id?: string }).id ?? index} className="truncate text-sm">{render(row)}</li>)}</ul> : <p className="text-xs text-muted-foreground">{empty}</p>}</div>;
}