import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { STATUS_LABEL, STATUS_VARIANT, STATUS_ICON, STATUS_ICON_CLASS } from '@/lib/appointment-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { Appointment, AppointmentStatus, Barber } from '@/lib/types';

export default function AppointmentsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [barberId, setBarberId] = useState('');
  const [status, setStatus] = useState('');

  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (barberId) params.set('barberId', barberId);
  if (status) params.set('status', status);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', date, barberId, status],
    queryFn: () => apiFetch<Appointment[]>(`/appointments?${params.toString()}`),
  });

  const { data: barbers = [] } = useQuery({
    queryKey: ['barbers-admin'],
    queryFn: () => apiFetch<Barber[]>('/barbers/admin?includeInactive=false'),
  });

  const confirm = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/appointments/${id}/confirm`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Confirmado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/appointments/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Cancelado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const complete = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/appointments/${id}/complete`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Concluído.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sorted = appointments.slice().sort((a, b) => a.startTime.localeCompare(b.startTime));

  const statusCounts = sorted.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<AppointmentStatus, number>>,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agendamentos</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as AppointmentStatus[]).map((s) => {
          const Icon = STATUS_ICON[s];
          return (
            <Card key={s}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    STATUS_ICON_CLASS[s],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{STATUS_LABEL[s]}</div>
                  <div className="text-3xl font-bold">{statusCounts[s] ?? 0}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
            <Select value={barberId} onValueChange={setBarberId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os barbeiros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os barbeiros</SelectItem>
                {barbers.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{sorted.length} agendamento(s)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : sorted.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum agendamento encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((appt) => (
                  <TableRow key={appt.id}>
                    <TableCell className="font-mono text-sm">
                      {appt.startTime}–{appt.endTime}
                    </TableCell>
                    <TableCell>{appt.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{appt.clientPhone}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[appt.status]}>
                        {STATUS_LABEL[appt.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {appt.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={confirm.isPending}
                              onClick={() => confirm.mutate(appt.id)}
                            >
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate(appt.id)}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                        {appt.status === 'CONFIRMED' && (
                          <>
                            <Button
                              size="sm"
                              disabled={complete.isPending}
                              onClick={() => complete.mutate(appt.id)}
                            >
                              Concluir
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate(appt.id)}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
