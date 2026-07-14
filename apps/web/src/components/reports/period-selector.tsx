import { format, subDays, startOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const FMT = 'yyyy-MM-dd';

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const PRESETS = [
  { label: '7 dias', range: () => [format(subDays(new Date(), 6), FMT), format(new Date(), FMT)] as const },
  { label: '30 dias', range: () => [format(subDays(new Date(), 29), FMT), format(new Date(), FMT)] as const },
  { label: 'Mês atual', range: () => [format(startOfMonth(new Date()), FMT), format(new Date(), FMT)] as const },
];

export default function PeriodSelector({ from, to, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(({ label, range }) => {
        const [presetFrom, presetTo] = range();
        const active = presetFrom === from && presetTo === to;
        return (
          <Button
            key={label}
            variant={active ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(presetFrom, presetTo)}
          >
            {label}
          </Button>
        );
      })}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={from}
          max={to}
          onChange={(e) => e.target.value && onChange(e.target.value, to)}
          className="w-40"
          aria-label="Data inicial"
        />
        <span className="text-muted-foreground text-sm">até</span>
        <Input
          type="date"
          value={to}
          min={from}
          onChange={(e) => e.target.value && onChange(from, e.target.value)}
          className="w-40"
          aria-label="Data final"
        />
      </div>
    </div>
  );
}
