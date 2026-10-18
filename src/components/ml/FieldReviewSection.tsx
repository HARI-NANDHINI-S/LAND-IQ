import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Check,
  Info,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { FieldValidationResult } from '@/services/ml/mlService';

interface FieldReviewSectionProps {
  fields: Array<{
    id: string;
    field_name: string;
    field_value: string | null;
    confidence_score: number | null;
    validation_status?: string | null;
    verified_value?: string | null;
  }>;
  validationResults: Record<string, FieldValidationResult>;
  isLoading?: boolean;
  canVerify?: boolean;
  onVerifyField?: (fieldId: string, value: string) => Promise<any>;
}

export function FieldReviewSection({
  fields,
  validationResults,
  isLoading = false,
  canVerify = false,
  onVerifyField,
}: FieldReviewSectionProps) {
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  if (!fields.length && !isLoading) {
    return null;
  }

  // Count stats
  const evaluatedCount = fields.length;
  const needsReviewCount = fields.filter((f) => {
    const res = validationResults[f.id] || validationResults[f.field_name];
    return res?.review_classification === 'NEEDS_REVIEW';
  }).length;
  const likelyCorrectCount = evaluatedCount - needsReviewCount;

  const handleApplySuggestion = (fieldId: string, suggested: string) => {
    setEditedValues((prev) => ({ ...prev, [fieldId]: suggested }));
  };

  const handleConfirmVerification = async (fieldId: string, currentValue: string) => {
    if (!onVerifyField) return;
    const valueToVerify = editedValues[fieldId] !== undefined ? editedValues[fieldId] : currentValue;
    setVerifyingId(fieldId);
    setActionFeedback(null);
    try {
      await onVerifyField(fieldId, valueToVerify);
      setActionFeedback(`Field successfully verified with value: "${valueToVerify}"`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback(`Verification error: ${err.message || 'Failed to update field'}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const isOfflineFallback = Object.values(validationResults).some(
    (res) => res?.model_version?.includes('client-heuristic') || res?.model_version?.includes('fallback')
  );

  return (
    <Card className="border border-border/80 shadow-sm bg-card/60 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">
                  ML-Based OCR Field Error Detection & Validation
                </CardTitle>
                {isOfflineFallback ? (
                  <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    Offline Domain Rules
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 border-primary/30 text-primary">
                    RandomForest v1.0 (Live ML Microservice)
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {isOfflineFallback
                  ? 'ML microservice currently unreachable; running client-side domain syntax and character confusion rules.'
                  : 'Empirical 16-feature random forest classification evaluating OCR confusions, syntax conformity, and candidate suggestions.'}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-medium">
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
              {likelyCorrectCount} Likely Correct
            </Badge>
            {needsReviewCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-medium">
                <AlertTriangle className="h-3 w-3 mr-1 text-amber-600 dark:text-amber-400" />
                {needsReviewCount} Needs Review
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {actionFeedback && (
          <Alert variant={actionFeedback.startsWith('Verification error') ? 'destructive' : 'default'} className="py-2 text-xs">
            <Info className="h-4 w-4" />
            <AlertDescription>{actionFeedback}</AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[720px] text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-xs text-muted-foreground uppercase font-semibold">
                <th className="py-2.5 px-3">Field Name</th>
                <th className="py-2.5 px-3">Original OCR Value</th>
                <th className="py-2.5 px-3">ML Review Status</th>
                <th className="py-2.5 px-3">Review Reasons & Suggestion</th>
                <th className="py-2.5 px-3">Verified Value</th>
                {canVerify && <th className="py-2.5 px-3 text-right">Officer Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {fields.map((field) => {
                const validation = validationResults[field.id] || validationResults[field.field_name];
                const rawConf = field.confidence_score;
                const confPercent = rawConf != null ? (rawConf > 1 ? Math.round(rawConf) : Math.round(rawConf * 100)) : null;
                const isNeedsReview = validation?.review_classification === 'NEEDS_REVIEW';
                const isVerified = field.validation_status === 'VERIFIED';
                const currentEditValue = editedValues[field.id] ?? field.verified_value ?? field.field_value ?? '';
                const suggested = validation?.suggested_correction;
                const rationale = validation?.correction_rationale;

                return (
                  <tr
                    key={field.id}
                    className={`transition-colors hover:bg-muted/30 ${
                      isNeedsReview && !isVerified ? 'bg-amber-500/[0.03]' : ''
                    }`}
                  >
                    {/* Field Name */}
                    <td className="py-3 px-3 font-medium text-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{field.field_name.replace(/_/g, ' ')}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">{field.field_name}</span>
                      </div>
                    </td>

                    {/* Original OCR Value & Confidence */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted/50 border border-border/40 inline-block max-w-[200px] truncate" title={field.field_value || '—'}>
                          {field.field_value || <span className="text-muted-foreground italic">empty</span>}
                        </span>
                        {confPercent != null && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            OCR Legibility: <span className={confPercent >= 80 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : confPercent >= 60 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>{confPercent}%</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* ML Review Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isNeedsReview ? (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-semibold">
                          <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" />
                          NEEDS REVIEW
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                          LIKELY CORRECT
                        </Badge>
                      )}
                      {isVerified && (
                        <div className="mt-1">
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            Officer Signed
                          </Badge>
                        </div>
                      )}
                    </td>

                    {/* Review Reasons & Suggested Correction */}
                    <td className="py-3 px-3 max-w-xs">
                      {validation?.review_reasons?.length ? (
                        <ul className="text-xs text-muted-foreground space-y-0.5 mb-1.5">
                          {validation.review_reasons.map((r, i) => (
                            <li key={i} className="flex items-start gap-1 text-[11px] text-foreground/80">
                              <span className="text-amber-500 font-bold">•</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-muted-foreground">Syntactically nominal</span>
                      )}

                      {/* Evidence-backed suggestion */}
                      {suggested && (
                        <div className="mt-1 p-1.5 rounded-md bg-primary/5 border border-primary/20 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1 text-xs">
                            <span className="font-semibold text-primary flex items-center gap-1 text-[11px]">
                              <Sparkles className="h-3 w-3 text-amber-500" />
                              Suggested: <span className="font-mono">{suggested}</span>
                            </span>
                            {canVerify && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-5 px-1.5 text-[10px] text-primary hover:bg-primary/10"
                                onClick={() => handleApplySuggestion(field.id, suggested)}
                              >
                                Use this
                              </Button>
                            )}
                          </div>
                          {rationale && (
                            <span className="text-[10px] text-muted-foreground leading-tight">
                              {rationale}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Verified Value Input */}
                    <td className="py-3 px-3 min-w-[160px]">
                      {canVerify ? (
                        <Input
                          aria-label={`Verified value for ${field.field_name}`}
                          className="h-8 text-xs font-mono"
                          value={currentEditValue}
                          onChange={(e) => setEditedValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder="Confirm or edit value..."
                        />
                      ) : (
                        <span className="font-mono text-xs text-foreground">
                          {field.verified_value || field.field_value || '—'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    {canVerify && (
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant={isNeedsReview && !isVerified ? 'default' : 'outline'}
                          className="h-8 px-2.5 text-xs"
                          disabled={verifyingId === field.id}
                          onClick={() => handleConfirmVerification(field.id, field.verified_value || field.field_value || '')}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          {verifyingId === field.id ? 'Saving…' : isVerified ? 'Re-verify' : 'Verify'}
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Cadastral Governance & Safeguards Notice */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-[11px] text-muted-foreground">
          <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Statutory Verification Safeguard: </span>
            ML field error detection indicators highlight potential OCR artifacts to prioritize review scrutiny.
            All legal modifications to revenue identifiers or ownership records strictly require manual verification
            by an authorized verification officer.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
