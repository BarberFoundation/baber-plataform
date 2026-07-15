import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { NewReturningCounts, NewReturningByDay } from '@/lib/types';

const NEW_COLOR = 'hsl(var(--primary))';
const RETURNING_COLOR = 'hsl(var(--muted-foreground))';
const GRID_COLOR = 'hsl(var(--border))';

function fillDays(from: string, to: string, byDay: NewReturningByDay[]): NewReturningByDay[] {
  const map = new Map(byDay.map((d) => [d.date, d]));
  const out: NewReturningByDay[] = [];
  const end = new Date(`${to}T00:00:00`);
  for (const d = new Date(`${from}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
    const key = format(d, 'yyyy-MM-dd');
    out.push(map.get(key) ?? { date: key, newCount: 0, returningCount: 0 });
  }
  return out;
}

export default function NewReturningSection({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'clients', 'new-returning', from, to],
    queryFn: () => apiFetch<NewReturningCounts>(`/reports/clients/new-returning?from=${from}&to=${to}`),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Carregando...</p>;
  if (!data) return <p className="text-muted-foreground text-sm">Sem dados no período.</p>;

  const days = fillDays(from, to, data.byDay).map((d) => ({
    ...d,
    label: format(new Date(`${d.date}T00:00:00`), 'dd/MM'),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Novos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.newCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">Recorrentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.returningCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novos vs recorrentes por dia</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="newCount" name="Novos" stroke={NEW_COLOR} dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="returningCount" name="Recorrentes" stroke={RETURNING_COLOR} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
