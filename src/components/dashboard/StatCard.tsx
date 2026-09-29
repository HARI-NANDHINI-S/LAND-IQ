import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value?: number | string;
  icon: React.ReactNode;
  description?: string;
  loading?: boolean;
  trend?: { value: number; label: string; positive: boolean };
  className?: string;
}

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

export function StatCard({ title, value, icon, description, loading, trend, className }: StatCardProps) {
  const numericValue = typeof value === 'number' ? value : Number.parseInt(String(value ?? '0'), 10);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [displayValue, setDisplayValue] = useState(loading ? 0 : numericValue);

  useEffect(() => {
    if (loading || Number.isNaN(numericValue) || prefersReducedMotion) {
      return;
    }

    let frame = 0;
    const duration = 700;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(numericValue * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [loading, numericValue, prefersReducedMotion]);

  const visibleValue = prefersReducedMotion ? numericValue : displayValue;

  return (
    <Card className={cn("landiq-kpi-card group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <div className="landiq-kpi-icon flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground transition-all duration-300 group-hover:scale-105 group-hover:text-primary">
            {icon}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {loading ? (
            <Skeleton className="mt-1 h-8 w-20" />
          ) : (
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {typeof value === 'number' || typeof value === 'string' ? formatNumber(visibleValue) : '-'}
            </div>
          )}

          {loading ? (
            <Skeleton className="h-3 w-32" />
          ) : (
            (description || trend) && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                {trend && (
                  <span className={cn("font-semibold", trend.positive ? "text-emerald-600" : "text-rose-600")}>
                    {trend.positive ? '+' : ''}{trend.value}%
                  </span>
                )}
                <span>{trend ? trend.label : description}</span>
              </p>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
