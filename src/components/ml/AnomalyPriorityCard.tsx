import { BrainCircuit, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import type { MLPredictionResult } from '@/services/ml/mlService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AnomalyPriorityCardProps {
  prediction: MLPredictionResult | null;
  isLoading?: boolean;
}

export function AnomalyPriorityCard({ prediction, isLoading }: AnomalyPriorityCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border/60 bg-card/60 animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 w-44 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-8 bg-muted rounded-xl" />
          <div className="h-16 bg-muted rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  const priorityColors = {
    HIGH: {
      badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      bar: 'bg-rose-500',
      bg: 'from-rose-500/5 to-transparent',
      border: 'border-rose-500/30',
      icon: ShieldAlert,
    },
    MEDIUM: {
      badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      bar: 'bg-amber-500',
      bg: 'from-amber-500/5 to-transparent',
      border: 'border-amber-500/30',
      icon: AlertTriangle,
    },
    LOW: {
      badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      bar: 'bg-emerald-500',
      bg: 'from-emerald-500/5 to-transparent',
      border: 'border-emerald-500/30',
      icon: CheckCircle2,
    },
  }[prediction.review_priority];

  const Icon = priorityColors.icon;
  const scorePercent = Math.round(prediction.anomaly_score * 100);

  return (
    <Card className={`border shadow-sm bg-gradient-to-br ${priorityColors.bg} ${priorityColors.border}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                ML Review Priority
                <Badge variant="outline" className="text-[10px] font-mono py-0 h-4 border-primary/20 text-primary">
                  {prediction.model_version}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Empirical scikit-learn anomaly & inconsistency classifier
              </CardDescription>
            </div>
          </div>

          <Badge className={`px-2.5 py-0.5 text-xs font-bold border ${priorityColors.badge}`}>
            <Icon className="h-3.5 w-3.5 mr-1" />
            {prediction.review_priority} PRIORITY
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Anomaly Score Bar */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-medium text-muted-foreground flex items-center gap-1">
              Anomaly Likelihood Index
            </span>
            <span className="font-bold text-foreground font-mono">{scorePercent}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${priorityColors.bar}`}
              style={{ width: `${Math.max(scorePercent, 4)}%` }}
            />
          </div>
        </div>

        {/* Contributing Factors */}
        {prediction.contributing_factors.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Contributing Risk Factors:</span>
            <ul className="space-y-1">
              {prediction.contributing_factors.map((factor, idx) => (
                <li key={idx} className="text-xs text-foreground flex items-start gap-1.5">
                  <span className="text-primary font-bold">•</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Action */}
        <div className="p-2.5 rounded-xl bg-background/80 border border-border/40 text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5 mb-0.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Recommended Review Action:
          </span>
          <p className="text-muted-foreground">{prediction.recommended_action}</p>
        </div>

        {/* Ethical Safeguard Notice */}
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80 pt-1 border-t border-border/30">
          <HelpCircle className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
          <span>
            {prediction.safeguards_notice}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
