import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value?: number | string;
  icon: ReactNode;
  description?: string;
  loading?: boolean;
  trend?: { value: number; label: string; positive: boolean };
  className?: string;
}

export function StatCard({ title, value, icon, description, loading, trend, className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground tracking-tight">{title}</p>
          <div className="h-4 w-4 text-muted-foreground">{icon}</div>
        </div>
        <div className="flex flex-col gap-1">
          {loading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <div className="text-2xl font-bold">{value !== undefined ? value : '-'}</div>
          )}
          
          {loading ? (
            <Skeleton className="h-3 w-32 mt-1" />
          ) : (
            (description || trend) && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {trend && (
                  <span className={cn("font-medium", trend.positive ? "text-emerald-500" : "text-rose-500")}>
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
