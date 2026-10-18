import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  GitCommit,
  GitCompare,
  User,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  versionService,
  type LandRecordVersionWithActor,
  type FieldDiff,
} from '@/services/versioning/versionService';

interface RecordVersionHistoryPanelProps {
  landRecordId: string;
}

export function RecordVersionHistoryPanel({ landRecordId }: RecordVersionHistoryPanelProps) {
  const [selectedVersions, setSelectedVersions] = useState<{
    older: LandRecordVersionWithActor | null;
    newer: LandRecordVersionWithActor | null;
  }>({ older: null, newer: null });
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  const { data: versions = [], isLoading } = useQuery<LandRecordVersionWithActor[]>({
    queryKey: ['land-record-versions', landRecordId],
    queryFn: () => versionService.getRecordVersions(landRecordId),
    enabled: !!landRecordId,
  });

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'INITIAL_INGESTION':
        return <Badge variant="outline" className="text-slate-600">Initial Ingestion</Badge>;
      case 'OCR_EXTRACTED':
        return <Badge className="bg-sky-600 text-white">OCR Extracted</Badge>;
      case 'PROPOSED_CORRECTION':
        return <Badge className="bg-amber-600 text-white">Proposed Correction</Badge>;
      case 'VERIFIED_APPROVAL':
        return <Badge className="bg-emerald-600 text-white">Verified & Approved</Badge>;
      case 'REJECTION':
        return <Badge className="bg-rose-600 text-white">Rejected</Badge>;
      case 'GIS_DISCREPANCY_RESOLVED':
        return <Badge className="bg-purple-600 text-white">GIS Resolved</Badge>;
      default:
        return <Badge variant="secondary">{eventType.replace(/_/g, ' ')}</Badge>;
    }
  };

  const handleOpenDiff = (currentVersion: LandRecordVersionWithActor, index: number) => {
    // Compare with the immediately prior version (which is at index + 1 in descending order)
    const priorVersion = versions[index + 1] || null;
    if (priorVersion) {
      setSelectedVersions({ older: priorVersion, newer: currentVersion });
    } else {
      // If it's the very first version, compare against empty snapshot
      setSelectedVersions({ older: currentVersion, newer: currentVersion });
    }
    setIsDiffOpen(true);
  };

  let diffResults: FieldDiff[] = [];
  if (selectedVersions.older && selectedVersions.newer) {
    if (selectedVersions.older.id === selectedVersions.newer.id) {
      // First version snapshot listing
      const snap = (selectedVersions.newer.snapshot as Record<string, any>) || {};
      diffResults = Object.keys(snap).map((k) => ({
        fieldName: k,
        label: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        oldValue: null,
        newValue: snap[k],
        isModified: true,
      }));
    } else {
      diffResults = versionService.compareVersions(selectedVersions.older, selectedVersions.newer);
    }
  }

  return (
    <>
      <Card className="border border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Immutable Record Version History & Change Audit
            </CardTitle>
            <CardDescription>
              Tamper-proof audit trail of OCR extractions, proposed corrections, approvals, and verified state changes.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {versions.length} Version{versions.length === 1 ? '' : 's'} Logged
          </Badge>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">
              Loading record version lineage...
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <GitCommit className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">No historical versions recorded yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Version snapshots are captured automatically when OCR extractions are verified or edited.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {versions.map((ver, idx) => (
                <div key={ver.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />

                  <div className="rounded-lg border bg-card p-3.5 hover:border-primary/50 transition-colors shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded">
                          v{ver.version_number}
                        </span>
                        {getEventBadge(ver.event_type)}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenDiff(ver, idx)}
                        >
                          <GitCompare className="mr-1.5 h-3.5 w-3.5" />
                          {idx === versions.length - 1 ? 'View Snapshot' : 'Compare Diff'}
                        </Button>
                      </div>
                    </div>

                    {/* Metadata & Actor Info */}
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>
                          {ver.actor?.full_name || 'System Pipeline'}{' '}
                          {ver.actor_role && (
                            <span className="text-[11px] font-mono opacity-80">({ver.actor_role})</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(ver.created_at).toLocaleString()}</span>
                      </div>
                      {ver.reason && (
                        <div className="sm:col-span-3 text-foreground font-medium bg-muted/30 p-1.5 rounded mt-1">
                          Reason: <span className="font-normal text-muted-foreground">{ver.reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version Diff Modal */}
      <Dialog open={isDiffOpen} onOpenChange={setIsDiffOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitCompare className="h-5 w-5 text-primary" />
              Version Comparison: v{selectedVersions.older?.version_number} → v{selectedVersions.newer?.version_number}
            </DialogTitle>
            <DialogDescription>
              Detailed field-level changes between record version snapshots. Original OCR values are preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted font-medium text-muted-foreground">
                  <tr>
                    <th className="p-2.5 text-left w-1/3">Field Name</th>
                    <th className="p-2.5 text-left w-1/3">
                      v{selectedVersions.older?.version_number} (Previous)
                    </th>
                    <th className="p-2.5 text-left w-1/3">
                      v{selectedVersions.newer?.version_number} (Selected)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {diffResults.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-muted-foreground">
                        No field changes detected between these versions.
                      </td>
                    </tr>
                  ) : (
                    diffResults.map((diff) => (
                      <tr
                        key={diff.fieldName}
                        className={diff.isModified ? 'bg-amber-500/10 dark:bg-amber-500/5' : ''}
                      >
                        <td className="p-2.5 font-medium text-foreground">
                          {diff.label}
                          {diff.isModified && (
                            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-muted-foreground break-all">
                          {diff.oldValue !== null && diff.oldValue !== undefined
                            ? String(diff.oldValue)
                            : '—'}
                        </td>
                        <td className="p-2.5 font-mono font-medium text-foreground break-all">
                          {diff.newValue !== null && diff.newValue !== undefined
                            ? String(diff.newValue)
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between">
              <div>
                Recorded by: <span className="font-semibold text-foreground">{selectedVersions.newer?.actor?.full_name || 'System'}</span>
              </div>
              <div>
                Timestamp: <span className="font-semibold text-foreground">{selectedVersions.newer?.created_at ? new Date(selectedVersions.newer.created_at).toLocaleString() : ''}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
