import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Info,
  ChevronDown,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  gisCrossValidationService,
  type GISCrossValidationDetails,
  type GISValidationStatus,
  type OfficerResolutionStatus,
} from '@/services/gis/gisCrossValidationService';
import { useAuth } from '@/hooks/auth/useAuth';

interface GISCrossValidationPanelProps {
  landRecordId: string;
  documentId?: string | null;
}

export function GISCrossValidationPanel({ landRecordId, documentId }: GISCrossValidationPanelProps) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  const [resolutionStatus, setResolutionStatus] = useState<OfficerResolutionStatus>('ACCEPTED_OVERRIDE');
  const [officerNotes, setOfficerNotes] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);

  // Fetch current GIS validation status for this land record
  const {
    data: validation,
    isLoading,
    refetch,
  } = useQuery<GISCrossValidationDetails | null>({
    queryKey: ['gis-cross-validation', landRecordId],
    queryFn: () => gisCrossValidationService.getValidationForRecord(landRecordId),
    enabled: !!landRecordId,
  });

  // Run or re-run automated GIS cross-validation
  const runValidationMutation = useMutation({
    mutationFn: () => gisCrossValidationService.performCrossValidation(landRecordId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gis-cross-validation', landRecordId] });
      void refetch();
    },
  });

  // Officer resolve discrepancy
  const resolveMutation = useMutation({
    mutationFn: () => {
      if (!validation?.id) throw new Error('No validation ID to resolve');
      return gisCrossValidationService.resolveDiscrepancy(validation.id, resolutionStatus, officerNotes);
    },
    onSuccess: () => {
      setShowResolveForm(false);
      setOfficerNotes('');
      void queryClient.invalidateQueries({ queryKey: ['gis-cross-validation', landRecordId] });
      void refetch();
    },
  });

  // Leaflet map initialization and polygon rendering
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        scrollWheelZoom: false,
        attributionControl: false,
      }).setView([11.0168, 76.9558], 14); // Default Coimbatore center

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Remove previous layer if any
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    if (validation?.geometry_geojson) {
      try {
        const geoLayer = L.geoJSON(validation.geometry_geojson as any, {
          style: {
            color: validation.has_geometry_overlap ? '#dc2626' : '#2563eb',
            fillColor: validation.has_geometry_overlap ? '#f87171' : '#3b82f6',
            fillOpacity: 0.35,
            weight: 2,
          },
          onEachFeature: (_feature, layer) => {
            layer.bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
                <strong>Survey No:</strong> ${validation.cadastral_survey_number || validation.extracted_survey_number || 'N/A'}<br/>
                <strong>Area:</strong> ${validation.cadastral_area || 'N/A'} ${validation.cadastral_area_unit || ''}<br/>
                <strong>Status:</strong> ${validation.validation_status}
              </div>
            `);
          },
        }).addTo(map);

        geoJsonLayerRef.current = geoLayer;
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20], maxZoom: 17 });
        }
      } catch (err) {
        console.warn('Could not parse geometry_geojson for map rendering:', err);
      }
    }
  }, [validation]);

  const canResolve = hasPermission('gis:resolve') || hasPermission('verification:approve');

  const getStatusBadge = (status?: GISValidationStatus) => {
    switch (status) {
      case 'MATCHED':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Matched</Badge>;
      case 'POSSIBLE_MISMATCH':
        return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Possible Mismatch</Badge>;
      case 'AMBIGUOUS_MATCH':
        return <Badge className="bg-purple-600 text-white hover:bg-purple-700">Ambiguous Match</Badge>;
      case 'NO_MATCH':
        return <Badge className="bg-rose-600 text-white hover:bg-rose-700">No Cadastral Match</Badge>;
      case 'SOURCE_DATA_UNAVAILABLE':
        return <Badge variant="outline" className="text-slate-600 border-slate-300">Source Unavailable</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-500">Not Yet Validated</Badge>;
    }
  };

  const getResolutionBadge = (status?: OfficerResolutionStatus | null) => {
    switch (status) {
      case 'ACCEPTED_OVERRIDE':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Override Accepted</Badge>;
      case 'CONFIRMED_MATCH':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Match Confirmed</Badge>;
      case 'REJECTED_DISCREPANCY':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300">Discrepancy Rejected</Badge>;
      default:
        return <Badge variant="secondary">Resolution Pending</Badge>;
    }
  };

  const discrepancies = Array.isArray(validation?.discrepancies) ? validation.discrepancies : [];

  return (
    <Card className="border border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Geospatial Land-Record Cross-Validation
          </CardTitle>
          <CardDescription>
            Cadastral parcel consistency, boundary verification, and area cross-check against authoritative GIS datasets.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {validation && getStatusBadge(validation.validation_status)}
          <Button
            variant="outline"
            size="sm"
            onClick={() => runValidationMutation.mutate()}
            disabled={runValidationMutation.isPending || isLoading}
            className="h-8"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${runValidationMutation.isPending ? 'animate-spin' : ''}`} />
            {validation ? 'Re-validate GIS' : 'Run GIS Validation'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">
            Loading cadastral GIS validation records...
          </div>
        ) : !validation ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <MapPin className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">No GIS validation recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Automated spatial cross-validation compares extracted survey numbers and recorded areas against cadastral benchmark parcels.
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => runValidationMutation.mutate()}
              disabled={runValidationMutation.isPending}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Run Automated GIS Cross-Validation
            </Button>
          </div>
        ) : (
          <>
            {/* Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Document Extracted Attributes */}
              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-blue-500" /> Extracted Document Attributes
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Survey Number:</span>
                    <span className="font-semibold text-foreground">
                      {validation.extracted_survey_number || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Subdivision:</span>
                    <span className="font-medium text-foreground">
                      {validation.extracted_subdivision || 'None'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Recorded Area:</span>
                    <span className="font-medium text-foreground">
                      {validation.extracted_area || 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cadastral Benchmark Attributes */}
              <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Authoritative Cadastral Parcel
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">Cadastral Survey No:</span>
                    <span className="font-semibold text-foreground">
                      {validation.cadastral_survey_number || 'No cadastral match'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Cadastral Area:</span>
                    <span className="font-medium text-foreground">
                      {validation.cadastral_area
                        ? `${validation.cadastral_area} ${validation.cadastral_area_unit || 'Acre'}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground">
                    <span>Source: {validation.cadastral_source || 'Tamil Nadu Cadastral Benchmark'}</span>
                    <span className="ml-2">| Verified: {new Date(validation.source_timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Discrepancies Alerts */}
            {discrepancies.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Flagged Discrepancies ({discrepancies.length})
                </div>
                <ul className="list-disc list-inside text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  {discrepancies.map((disc: any, idx: number) => (
                    <li key={idx}>
                      <span className="font-medium">{disc.field}:</span> {disc.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Spatial Warnings */}
            {validation.has_geometry_overlap && (
              <div className="rounded-lg border border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 p-3 flex items-start gap-2.5">
                <XCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                <div className="text-xs text-rose-900 dark:text-rose-200">
                  <span className="font-semibold">Spatial Geometry Overlap Detected:</span> This parcel geometry overlaps with existing active cadastral parcels. Officer scrutiny is mandated before approval.
                </div>
              </div>
            )}

            {/* Interactive Cadastral Map View */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Cadastral Boundary Map</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {validation.geometry_geojson ? 'Spatial polygon loaded' : 'Coordinates pending field survey'}
                </span>
              </div>
              <div
                ref={mapContainerRef}
                className="h-48 w-full rounded-md border bg-slate-100 dark:bg-slate-900 overflow-hidden relative z-0"
              />
            </div>

            {/* Officer Resolution Section */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Officer Resolution:</span>
                  {getResolutionBadge(validation.officer_resolution_status)}
                  {validation.resolver && (
                    <span className="text-xs text-muted-foreground">
                      by {validation.resolver.full_name} on {validation.resolved_at ? new Date(validation.resolved_at).toLocaleDateString() : ''}
                    </span>
                  )}
                </div>

                {canResolve && !showResolveForm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowResolveForm(true)}
                  >
                    Resolve Discrepancy <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>

              {validation.officer_notes && !showResolveForm && (
                <div className="mt-2 text-xs bg-muted/40 p-2.5 rounded border text-muted-foreground">
                  <span className="font-semibold text-foreground">Officer Decision Rationale:</span> {validation.officer_notes}
                </div>
              )}

              {/* Discrepancy Resolution Form for Officers */}
              {showResolveForm && (
                <div className="mt-3 p-3 rounded-lg border bg-muted/30 space-y-3">
                  <div className="text-xs font-semibold text-foreground">
                    Record Officer Discrepancy Resolution
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={resolutionStatus === 'CONFIRMED_MATCH' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setResolutionStatus('CONFIRMED_MATCH')}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Confirm Match
                    </Button>
                    <Button
                      type="button"
                      variant={resolutionStatus === 'ACCEPTED_OVERRIDE' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setResolutionStatus('ACCEPTED_OVERRIDE')}
                    >
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Accept Override
                    </Button>
                    <Button
                      type="button"
                      variant={resolutionStatus === 'REJECTED_DISCREPANCY' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setResolutionStatus('REJECTED_DISCREPANCY')}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject Record
                    </Button>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Resolution Notes & Justification (Required for Audit Trail):
                    </label>
                    <Textarea
                      placeholder="Explain why this cadastral cross-validation discrepancy is resolved or accepted..."
                      value={officerNotes}
                      onChange={(e) => setOfficerNotes(e.target.value)}
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setShowResolveForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7"
                      disabled={resolveMutation.isPending || !officerNotes.trim()}
                      onClick={() => resolveMutation.mutate()}
                    >
                      {resolveMutation.isPending ? 'Saving...' : 'Save Resolution'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
