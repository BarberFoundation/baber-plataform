import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { apiFetch } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { InactiveClient } from '@/lib/types';

const DAYS_OPTIONS = ['30', '60', '90'] as const;

export default function InactiveClientsSection() {
  const [days, setDays] = useState('60');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'clients', 'inactive', days],
    queryFn: () => apiFetch<InactiveClient[]>(`/reports/clients/inactive?days=${days}`),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Clientes inativos</CardTitle>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OPTIONS.map((d) => (
              <SelectItem key={d} value={d}>{d} dias</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
        {!isLoading && data?.length === 0 && (
          <p className="text-muted-foreground text-sm">Nenhum cliente inativo.</p>
        )}
        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Última visita</TableHead>
                <TableHead>Dias parado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.customerId}>
                  <TableCell>{c.name ?? '—'}</TableCell>
                  <TableCell>{c.phone ?? '—'}</TableCell>
                  <TableCell>{format(new Date(`${c.lastVisitDate}T00:00:00`), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{c.daysSinceLastVisit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
