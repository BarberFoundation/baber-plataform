import { Module } from '@nestjs/common';

/**
 * Scheduling — agendamentos, disponibilidade, políticas de booking.
 * CORE do sistema. Agregado Appointment (N items), VO TimeSlot,
 * domain service BookingPolicy, exclusion constraint GIST anti-overlap.
 */
@Module({})
export class SchedulingModule {}
