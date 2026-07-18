import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatBRL, formatPct } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { BarberRankingEntry } from '@/lib/types';

type SortKey = 'totalInCents' | 'appointmentCount' | 'averageTicketInCents' | 'occupancyRate';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'totalInCents', label: 'Faturamento' },
  { key: 'appointmentCount', label: 'Atendimentos' },
  { key: 'averageTicketInCents', label: 'Ticket médio' },
  { key: 'occupancyRate', label: 'Ocupação' },
];

export default function RankingTab({ from, to }: { from: string; to: string }) {
  const [sortBy, setSortBy] = useState<SortKey>('totalInCents');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'ranking', from, to],
    queryFn: () => apiFetch<BarberRankingEntry[]>(`/reports/barbers/ranking?from=${from}&to=${to}`),
  });

  function handleSort(key: SortKey) {
    if (key === sortBy) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Carregando...</p>;
  if (!data || data.length === 0) return <p className="text-muted-foreground text-sm">Sem dados no período.</p>;

  const sorted = [...data].sort((a, b) => {
    const diff = a[sortBy] - b[sortBy];
    if (diff !== 0) return sortDir === 'desc' ? -diff : diff;
    return a.barberName.localeCompare(b.barberName);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ranking de barbeiros</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Barbeiro</TableHead>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  aria-sort={sortBy === col.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortBy === col.key &&
                      (sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((entry, i) => (
              <TableRow key={entry.barberId}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium">{entry.barberName}</TableCell>
                <TableCell>{formatBRL(entry.totalInCents)}</TableCell>
                <TableCell>{entry.appointmentCount}</TableCell>
                <TableCell>{formatBRL(entry.averageTicketInCents)}</TableCell>
                <TableCell>{formatPct(entry.occupancyRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
