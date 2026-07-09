import { Clock, CalendarCheck, CheckCheck, XCircle } from 'lucide-react';
import type { AppointmentStatus } from '@/lib/types';

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const STATUS_VARIANT: Record<AppointmentStatus, 'warning' | 'success' | 'secondary' | 'destructive'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
};

export const STATUS_ICON: Record<AppointmentStatus, typeof Clock> = {
  PENDING: Clock,
  CONFIRMED: CalendarCheck,
  COMPLETED: CheckCheck,
  CANCELLED: XCircle,
};

export const STATUS_ICON_CLASS: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400',
  COMPLETED: 'bg-secondary text-secondary-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};
