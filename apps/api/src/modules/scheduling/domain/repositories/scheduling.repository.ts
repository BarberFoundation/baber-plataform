import { Appointment } from '../entities/appointment.entity';
import { AppointmentStatus } from '../value-objects/appointment-status';

export const SCHEDULING_REPOSITORY = Symbol('ISchedulingRepository');

export interface ListAppointmentsFilter {
  date?: string;
  barberId?: string;
  status?: AppointmentStatus;
}

export interface ISchedulingRepository {
  findById(id: string, tenantId: string): Promise<Appointment | null>;
  findAll(tenantId: string, filter: ListAppointmentsFilter): Promise<Appointment[]>;
  findByBarberAndDate(barberId: string, date: string, tenantId: string): Promise<Appointment[]>;
  save(appointment: Appointment): Promise<Appointment>;
}
