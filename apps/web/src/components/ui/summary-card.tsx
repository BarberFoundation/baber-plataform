import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface SummaryCardProps {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  count: number;
}

export function SummaryCard({ icon: Icon, iconClassName, label, count }: SummaryCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            iconClassName,
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
