import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SpatialBounds, SpatialLandRecord } from '@/services/gisService';

interface LandRecordSpatialMapProps {
  records: SpatialLandRecord[];
  initialBounds: SpatialBounds | null;
  onBoundsChange: (bounds: SpatialBounds) => void;
  onSelectRecord: (recordId: string) => void;
  onMapClick: (latitude: number, longitude: number) => void;
}

export default function LandRecordSpatialMap({
  records,
  initialBounds,
  onBoundsChange,
  onSelectRecord,
  onMapClick,
}: LandRecordSpatialMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const lastFitBoundsRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onBoundsChange, onSelectRecord, onMapClick });

  useEffect(() => {
    callbacksRef.current = { onBoundsChange, onSelectRecord, onMapClick };
  }, [onBoundsChange, onSelectRecord, onMapClick]);

  useEffect(() => {
    if (!hostRef.current) return;

    const map = L.map(hostRef.current, { preferCanvas: true, worldCopyJump: true }).setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const layer = L.geoJSON(undefined, {
      style: (feature) => {
        const properties = feature?.properties ?? {};
        const color = properties.riskLevel === 'CRITICAL' || properties.riskLevel === 'HIGH'
          ? '#b91c1c'
          : properties.hasDuplicate
            ? '#c2410c'
            : properties.verificationStatus === 'PENDING'
              ? '#a16207'
              : '#171717';
        return {
          color,
          fillColor: color,
          weight: properties.isWatched ? 3 : 2,
          dashArray: properties.isWatched ? '5 4' : undefined,
          fillOpacity: 0.2,
        };
      },
      pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
        radius: 7,
        color: '#171717',
        fillColor: '#ea580c',
        fillOpacity: 0.9,
        weight: 2,
      }),
      onEachFeature: (feature, featureLayer) => {
        const recordId = feature.properties?.recordId;
        const label = document.createElement('span');
        const indicators = [
          feature.properties?.riskLevel ? `Risk ${String(feature.properties.riskLevel)}` : null,
          feature.properties?.hasDuplicate ? 'Duplicate candidate' : null,
          feature.properties?.isWatched ? 'Watched' : null,
          feature.properties?.verificationStatus ? String(feature.properties.verificationStatus) : null,
        ].filter(Boolean);
        label.textContent = [String(feature.properties?.recordNumber ?? 'Land record'), ...indicators].join(' · ');
        featureLayer.bindTooltip(label);
        featureLayer.on('click', () => {
          if (typeof recordId === 'string') callbacksRef.current.onSelectRecord(recordId);
        });
      },
    }).addTo(map);

    const emitBounds = () => {
      const bounds = map.getBounds();
      callbacksRef.current.onBoundsChange({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      });
    };
    const emitMapClick = (event: L.LeafletMouseEvent) => {
      callbacksRef.current.onMapClick(event.latlng.lat, event.latlng.lng);
    };

    map.on('moveend', emitBounds);
    map.on('click', emitMapClick);
    map.whenReady(() => {
      map.invalidateSize();
      emitBounds();
    });

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(hostRef.current);
    mapRef.current = map;
    layerRef.current = layer;

    return () => {
      resizeObserver.disconnect();
      map.off('moveend', emitBounds);
      map.off('click', emitMapClick);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!initialBounds) return;
    const boundsKey = `${initialBounds.west},${initialBounds.south},${initialBounds.east},${initialBounds.north}`;
    if (lastFitBoundsRef.current === boundsKey) return;
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(
      [[initialBounds.south, initialBounds.west], [initialBounds.north, initialBounds.east]],
      { padding: [28, 28], maxZoom: 13 }
    );
    lastFitBoundsRef.current = boundsKey;
  }, [initialBounds]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const features: GeoJSON.Feature[] = records.flatMap((record) => {
      if (!record.geometry_geojson || typeof record.geometry_geojson !== 'object') return [];
      return [{
        type: 'Feature' as const,
        properties: {
          recordId: record.id,
          recordNumber: record.record_number,
          verificationStatus: record.verification_status,
          riskLevel: record.risk_level,
          hasDuplicate: record.has_duplicate,
          isWatched: record.is_watched,
        },
        geometry: record.geometry_geojson as unknown as GeoJSON.Geometry,
      }];
    });

    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    layer.addData(collection);
    if (!initialBounds && layer.getLayers().length) {
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        mapRef.current?.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      }
    }
  }, [initialBounds, records]);

  return (
    <div
      ref={hostRef}
      role="application"
      aria-label="Land record spatial map. Use the map controls to zoom and pan."
      className="h-[420px] w-full overflow-hidden rounded-md border bg-muted sm:h-[520px]"
    />
  );
}