import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

const VARIANT_CLASS = {
  success: 'bg-emerald-500/10 text-emerald-400',
  destructive: 'bg-destructive/10 text-destructive',
} as const;

interface SummaryCardProps {
  icon: LucideIcon;
  label: string;
  count: number;
  variant?: keyof typeof VARIANT_CLASS;
  iconClassName?: string;
}

export function SummaryCard({ icon: Icon, label, count, variant, iconClassName }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            variant ? VARIANT_CLASS[variant] : iconClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold">{count}</div>
        </div>
      </CardContent>
    </Card>
  );
}
