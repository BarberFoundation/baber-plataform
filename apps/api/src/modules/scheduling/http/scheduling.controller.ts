import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  isUUID,
} from 'class-validator';
import { Public } from '@shared/auth/public.decorator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { BookAppointmentUseCase } from '../application/use-cases/book-appointment.use-case';
import { GetAvailableSlotsUseCase } from '../application/use-cases/get-available-slots.use-case';
import { ConfirmAppointmentUseCase } from '../application/use-cases/confirm-appointment.use-case';
import { CancelAppointmentUseCase } from '../application/use-cases/cancel-appointment.use-case';
import { CompleteAppointmentUseCase } from '../application/use-cases/complete-appointment.use-case';
import { GetAppointmentUseCase } from '../application/use-cases/get-appointment.use-case';
import { ListAppointmentsUseCase } from '../application/use-cases/list-appointments.use-case';
import { ListMyAppointmentsUseCase } from '../application/use-cases/list-my-appointments.use-case';
import { Appointment } from '../domain/entities/appointment.entity';
import { AppointmentStatus, APPOINTMENT_STATUSES } from '../domain/value-objects/appointment-status';

class BookAppointmentDto {
  @IsString()
  @IsOptional()
  barberId?: string;

  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @IsString()
  @IsNotEmpty()
  clientName!: string;

  @IsString()
  @IsNotEmpty()
  clientPhone!: string;

  @IsDateString()
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime deve estar no formato HH:mm' })
  startTime!: string;

  @IsString()
  @IsOptional()
  notes?: string | null;
}

function serializeAppointment(a: Appointment) {
  return {
    id:              a.id,
    tenantId:        a.tenantId,
    barberId:        a.barberId,
    serviceId:       a.serviceId,
    customerId:      a.customerId,
    clientName:      a.clientName,
    clientPhone:     a.clientPhone,
    date:            a.date,
    startTime:       a.startTime,
    endTime:         a.endTime,
    durationMinutes: a.durationMinutes,
    status:          a.status,
    notes:           a.notes,
    createdAt:       a.createdAt,
    updatedAt:       a.updatedAt,
  };
}

function requireTenantId(tenantId: string | undefined): void {
  if (!tenantId) throw new BadRequestException('x-tenant-id header is required.');
  if (!isUUID(tenantId, '4')) throw new BadRequestException('x-tenant-id must be a valid UUID v4.');
}

@Controller('appointments')
export class SchedulingController {
  constructor(
    private readonly bookAppointment:     BookAppointmentUseCase,
    private readonly getAvailableSlots:   GetAvailableSlotsUseCase,
    private readonly confirmAppointment:  ConfirmAppointmentUseCase,
    private readonly cancelAppointment:   CancelAppointmentUseCase,
    private readonly completeAppointment: CompleteAppointmentUseCase,
    private readonly getAppointment:      GetAppointmentUseCase,
    private readonly listAppointments:    ListAppointmentsUseCase,
    private readonly listMyAppointments:  ListMyAppointmentsUseCase,
  ) {}

  @Public()
  @Get('available-slots')
  async availableSlots(
    @Headers('x-tenant-id') tenantId: string,
    @Query('barberId') barberId: string | undefined,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    requireTenantId(tenantId);
    if (!serviceId || !date) {
      throw new BadRequestException('serviceId e date são obrigatórios.');
    }
    return this.getAvailableSlots.execute({ tenantId, barberId: barberId || undefined, serviceId, date });
  }

  @Roles('CLIENT')
  @Get('my')
  async myAppointments(@CurrentUser() user: JwtPayload) {
    const appts = await this.listMyAppointments.execute({ tenantId: user.tenantId, customerId: user.userId });
    return appts.map(serializeAppointment);
  }

  @Roles('CLIENT')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async book(
    @CurrentUser() user: JwtPayload,
    @Body() dto: BookAppointmentDto,
  ) {
    const appt = await this.bookAppointment.execute({
      tenantId:    user.tenantId,
      customerId:  user.userId,
      barberId:    dto.barberId,
      serviceId:   dto.serviceId,
      clientName:  dto.clientName,
      clientPhone: dto.clientPhone,
      date:        dto.date,
      startTime:   dto.startTime,
      notes:       dto.notes ?? null,
    });
    return serializeAppointment(appt);
  }

  @Roles('ADMIN')
  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('date') date?: string,
    @Query('barberId') barberId?: string,
    @Query('status') status?: string,
  ) {
    const validStatus = APPOINTMENT_STATUSES.includes(status as AppointmentStatus)
      ? (status as AppointmentStatus)
      : undefined;
    const appts = await this.listAppointments.execute({
      tenantId: user.tenantId,
      date,
      barberId,
      status: validStatus,
    });
    return appts.map(serializeAppointment);
  }

  @Roles('ADMIN')
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const appt = await this.getAppointment.execute({ id, tenantId: user.tenantId });
    return serializeAppointment(appt);
  }

  @Roles('ADMIN')
  @Patch(':id/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirm(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.confirmAppointment.execute({ id, tenantId: user.tenantId });
  }

  @Roles('ADMIN', 'CLIENT')
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.cancelAppointment.execute({
      id,
      tenantId: user.tenantId,
      requestedBy: { userId: user.userId, role: user.role },
    });
  }

  @Roles('ADMIN')
  @Patch(':id/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async complete(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.completeAppointment.execute({ id, tenantId: user.tenantId });
  }
}
