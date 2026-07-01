import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { BARBER_LOOKUP, IBarberLookup } from '../../domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP, IServiceLookup } from '../../domain/ports/service-lookup.port';
import { Appointment } from '../../domain/entities/appointment.entity';
import { BookingPolicy } from '../../domain/services/booking-policy';
import { InvalidAppointmentTimeError } from '../../domain/errors/scheduling.errors';
import { addMinutes } from '../../domain/utils/time.utils';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';

export interface BookAppointmentInput {
  tenantId: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  startTime: string;
  notes?: string | null;
}

@Injectable()
export class BookAppointmentUseCase {
  private readonly policy = new BookingPolicy();

  constructor(
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository,
    @Inject(BARBER_LOOKUP)         private readonly barberLookup: IBarberLookup,
    @Inject(SERVICE_LOOKUP)        private readonly serviceLookup: IServiceLookup,
    @Inject(EventEmitter2)         private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: BookAppointmentInput): Promise<Appointment> {
    const [barber, service] = await Promise.all([
      this.barberLookup.findById(input.barberId, input.tenantId),
      this.serviceLookup.findById(input.serviceId, input.tenantId),
    ]);

    if (!barber) throw new InvalidAppointmentTimeError('Barbeiro não encontrado.');
    if (!service) throw new InvalidAppointmentTimeError('Serviço não encontrado.');

    const endTime = addMinutes(input.startTime, service.durationMinutes);
    const existing = await this.repo.findByBarberAndDate(input.barberId, input.date, input.tenantId);

    this.policy.validate({
      barber,
      date: input.date,
      startTime: input.startTime,
      endTime,
      existing: existing.map((a) => ({ startTime: a.startTime, endTime: a.endTime, status: a.status })),
    });

    const appointment = Appointment.create({
      tenantId: input.tenantId,
      barberId: input.barberId,
      serviceId: input.serviceId,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      date: input.date,
      startTime: input.startTime,
      endTime,
      durationMinutes: service.durationMinutes,
      notes: input.notes ?? null,
    });

    const saved = await this.repo.save(appointment);
    const payload: AppointmentEventPayload = {
      appointmentId: saved.id,
      tenantId:      saved.tenantId,
      clientName:    saved.clientName,
      clientPhone:   saved.clientPhone,
      barberId:      saved.barberId,
      serviceId:     saved.serviceId,
      date:          saved.date,
      startTime:     saved.startTime,
      endTime:       saved.endTime,
    };
    this.emitter.emit(APPOINTMENT_EVENTS.BOOKED, payload);
    return saved;
  }
}
