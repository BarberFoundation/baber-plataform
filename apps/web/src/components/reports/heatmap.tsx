import type { HeatmapCell } from '@/lib/types';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  if (cells.length === 0) {
    return <p className="text-muted-foreground text-sm">Sem dados no período.</p>;
  }

  const byKey = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c.count]));
  const max = Math.max(...cells.map((c) => c.count));
  const hours = cells.map((c) => c.hour);
  const minHour = Math.min(...hours);
  const maxHour = Math.max(...hours);
  const hourRange = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th />
            {WEEKDAY_LABELS.map((label) => (
              <th key={label} className="text-muted-foreground text-xs font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hourRange.map((hour) => (
            <tr key={hour}>
              <td className="text-muted-foreground pr-1 text-right font-mono text-xs">
                {String(hour).padStart(2, '0')}h
              </td>
              {WEEKDAY_LABELS.map((_, weekday) => {
                const count = byKey.get(`${weekday}-${hour}`) ?? 0;
                const intensity = max === 0 ? 0 : count / max;
                return (
                  <td
                    key={weekday}
                    title={`${WEEKDAY_LABELS[weekday]} ${String(hour).padStart(2, '0')}h — ${count} agendamento(s)`}
                    className="h-6 w-10 rounded"
                    style={{
                      backgroundColor: `hsl(var(--primary) / ${intensity === 0 ? 0.06 : 0.15 + intensity * 0.85})`,
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
