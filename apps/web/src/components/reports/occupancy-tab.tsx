import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { apiFetch } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Heatmap from './heatmap';
import type { OccupancyReport } from '@/lib/types';

const SERIES_COLOR = 'hsl(var(--primary))';

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

export default function OccupancyTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'occupancy', from, to],
    queryFn: () => apiFetch<OccupancyReport>(`/reports/occupancy?from=${from}&to=${to}`),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Carregando...</p>;
  if (!data) return <p className="text-muted-foreground text-sm">Sem dados no período.</p>;

  const barbers = data.byBarber.map((b) => ({ ...b, ratePct: Math.round(b.rate * 100) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Ocupação geral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pct(data.overallRate)}</p>
            <p className="text-muted-foreground text-xs">
              {data.scheduledMinutes} de {data.availableMinutes} minutos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Taxa de cancelamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pct(data.cancellation.rate)}</p>
            <p className="text-muted-foreground text-xs">
              {data.cancellation.cancelled} de {data.cancellation.total} agendamentos
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horários de pico</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap cells={data.heatmap} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ocupação por barbeiro</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barbers} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis type="category" dataKey="barberName" width={110} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(v) => `${Number(v)}%`} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="ratePct" name="Ocupação" fill={SERIES_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
