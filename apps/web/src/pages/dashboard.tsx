import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { animate, stagger } from 'animejs';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { STATUS_LABEL, STATUS_VARIANT, STATUS_ICON, STATUS_ICON_CLASS } from '@/lib/appointment-status';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { Appointment, AppointmentStatus } from '@/lib/types';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export default function DashboardPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const cardsRef = useRef<HTMLDivElement>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['appointments', today],
    queryFn: () => apiFetch<Appointment[]>(`/appointments?date=${today}`),
  });

  useEffect(() => {
    if (!cardsRef.current) return;
    animate(cardsRef.current.children, {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(120),
      duration: 700,
      easing: 'easeOutQuad',
    });
  }, []);

  useEffect(() => {
    if (isLoading || !tableBodyRef.current) return;
    animate(tableBodyRef.current.children, {
      opacity: [0, 1],
      translateY: [8, 0],
      delay: stagger(90),
      duration: 600,
      easing: 'easeOutQuad',
    });
  }, [isLoading, appointments]);

  const counts = appointments.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<AppointmentStatus, number>>,
  );

  const dateLabel = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{getGreeting()}</p>
        <h1 className="text-2xl font-bold capitalize">{dateLabel}</h1>
        <p className="text-muted-foreground text-sm">Resumo dos agendamentos de hoje</p>
      </div>

      <div ref={cardsRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as AppointmentStatus[]).map((status) => {
          const Icon = STATUS_ICON[status];
          return (
            <Card key={status}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    STATUS_ICON_CLASS[status],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {STATUS_LABEL[status]}
                  </div>
                  <div className="text-3xl font-bold">{counts[status] ?? 0}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agendamentos de hoje ({appointments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : appointments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum agendamento para hoje.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody ref={tableBodyRef}>
                {appointments
                  .slice()
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((appt) => (
                    <TableRow key={appt.id}>
                      <TableCell className="font-mono text-sm">
                        {appt.startTime}–{appt.endTime}
                      </TableCell>
                      <TableCell>{appt.clientName}</TableCell>
                      <TableCell>
                        <StatusBadge status={appt.status} />
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
