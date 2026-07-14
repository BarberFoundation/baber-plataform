import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { formatBRL } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { RevenueReport, RevenueByDay } from '@/lib/types';

const SERIES_COLOR = 'hsl(var(--primary))';
const GRID_COLOR = 'hsl(var(--border))';

function fillDays(from: string, to: string, byDay: RevenueByDay[]): RevenueByDay[] {
  const map = new Map(byDay.map((d) => [d.date, d]));
  const out: RevenueByDay[] = [];
  const end = new Date(`${to}T00:00:00`);
  for (const d = new Date(`${from}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
    const key = format(d, 'yyyy-MM-dd');
    out.push(map.get(key) ?? { date: key, totalInCents: 0, count: 0 });
  }
  return out;
}

function HorizontalMoneyBars({ data, nameKey }: { data: Array<Record<string, unknown>>; nameKey: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tickFormatter={(v: number) => formatBRL(v)} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey={nameKey} width={110} tickLine={false} axisLine={false} fontSize={12} />
        <Tooltip formatter={(v) => formatBRL(Number(v))} cursor={{ fill: 'hsl(var(--muted))' }} />
        <Bar dataKey="totalInCents" name="Receita" fill={SERIES_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function RevenueTab({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn: () => apiFetch<RevenueReport>(`/reports/revenue?from=${from}&to=${to}`),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Carregando...</p>;
  if (!data) return <p className="text-muted-foreground text-sm">Sem dados no período.</p>;

  const days = fillDays(from, to, data.byDay).map((d) => ({
    ...d,
    label: format(new Date(`${d.date}T00:00:00`), 'dd/MM'),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Receita total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(data.totalInCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Ticket médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(data.averageTicketInCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Atendimentos concluídos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.appointmentCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receita por dia</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v: number) => formatBRL(v)} width={90} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip formatter={(v) => formatBRL(Number(v))} />
              <Line type="monotone" dataKey="totalInCents" name="Receita" stroke={SERIES_COLOR} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Receita por serviço</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <HorizontalMoneyBars data={data.byService as unknown as Array<Record<string, unknown>>} nameKey="serviceName" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Receita por barbeiro</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <HorizontalMoneyBars data={data.byBarber as unknown as Array<Record<string, unknown>>} nameKey="barberName" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
