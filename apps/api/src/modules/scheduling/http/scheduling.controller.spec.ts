import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import request from 'supertest';
import { SchedulingController } from './scheduling.controller';
import { BookAppointmentUseCase } from '../application/use-cases/book-appointment.use-case';
import { GetAvailableSlotsUseCase } from '../application/use-cases/get-available-slots.use-case';
import { ConfirmAppointmentUseCase } from '../application/use-cases/confirm-appointment.use-case';
import { CancelAppointmentUseCase } from '../application/use-cases/cancel-appointment.use-case';
import { CompleteAppointmentUseCase } from '../application/use-cases/complete-appointment.use-case';
import { GetAppointmentUseCase } from '../application/use-cases/get-appointment.use-case';
import { ListAppointmentsUseCase } from '../application/use-cases/list-appointments.use-case';
import { ListMyAppointmentsUseCase } from '../application/use-cases/list-my-appointments.use-case';
import { Appointment } from '../domain/entities/appointment.entity';
import { JwtGuard } from '@shared/auth/jwt.guard';
import { RolesGuard } from '@shared/auth/roles.guard';
import { JwtTokenService } from '@shared/auth/jwt-token.service';

// UUID v4 válido (o header x-tenant-id passa por isUUID(tenantId, '4')).
const TENANT_ID = '123e4567-e89b-42d3-a456-426614174000';

const appointmentFixture = Appointment.reconstitute({
  id: 'a1',
  tenantId: 't1',
  barberId: 'b1',
  serviceId: 's1',
  customerId: 'c1',
  clientName: 'Maria',
  clientPhone: '+5511999999999',
  date: '2026-07-01',
  startTime: '09:00',
  endTime: '09:30',
  durationMinutes: 30,
  priceInCents: 5000,
  status: 'PENDING',
  notes: null,
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01'),
});

describe('SchedulingController (http) — real JwtGuard + RolesGuard', () => {
  let app: INestApplication;
  const jwtTokenService = new JwtTokenService('test-access-secret', 'test-refresh-secret', '15m', '30d');

  const bookAppointment = { execute: jest.fn().mockResolvedValue(appointmentFixture) };
  const getAvailableSlots = { execute: jest.fn().mockResolvedValue([]) };
  const confirmAppointment = { execute: jest.fn().mockResolvedValue(undefined) };
  const cancelAppointment = { execute: jest.fn().mockResolvedValue(undefined) };
  const completeAppointment = { execute: jest.fn().mockResolvedValue(undefined) };
  const getAppointment = { execute: jest.fn().mockResolvedValue(appointmentFixture) };
  const listAppointments = { execute: jest.fn().mockResolvedValue([appointmentFixture]) };
  const listMyAppointments = { execute: jest.fn().mockResolvedValue([appointmentFixture]) };

  function bearer(role: 'ADMIN' | 'RECEPTIONIST' | 'CLIENT') {
    const token = jwtTokenService.signAccess({ userId: 'u1', tenantId: 't1', role });
    return `Bearer ${token}`;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SchedulingController],
      providers: [
        { provide: BookAppointmentUseCase, useValue: bookAppointment },
        { provide: GetAvailableSlotsUseCase, useValue: getAvailableSlots },
        { provide: ConfirmAppointmentUseCase, useValue: confirmAppointment },
        { provide: CancelAppointmentUseCase, useValue: cancelAppointment },
        { provide: CompleteAppointmentUseCase, useValue: completeAppointment },
        { provide: GetAppointmentUseCase, useValue: getAppointment },
        { provide: ListAppointmentsUseCase, useValue: listAppointments },
        { provide: ListMyAppointmentsUseCase, useValue: listMyAppointments },
        Reflector,
        { provide: JwtTokenService, useValue: jwtTokenService },
        { provide: APP_GUARD, useClass: JwtGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('200 on the @Public available-slots route without any token', async () => {
    await request(app.getHttpServer())
      .get('/appointments/available-slots')
      .set('x-tenant-id', TENANT_ID)
      .query({ serviceId: 's1', date: '2026-07-01' })
      .expect(200);
  });

  it('401 on a protected route with no Authorization header', async () => {
    await request(app.getHttpServer()).get('/appointments').expect(401);
  });

  it('401 on a protected route with a malformed token', async () => {
    await request(app.getHttpServer())
      .get('/appointments')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('403 when the role is authenticated but not allowed for the route', async () => {
    await request(app.getHttpServer())
      .get('/appointments')
      .set('Authorization', bearer('CLIENT'))
      .expect(403);
  });

  it('200 when the role is allowed (ADMIN on GET /appointments)', async () => {
    await request(app.getHttpServer())
      .get('/appointments')
      .set('Authorization', bearer('ADMIN'))
      .expect(200);
  });

  it('200 when the role is allowed (RECEPTIONIST on GET /appointments)', async () => {
    await request(app.getHttpServer())
      .get('/appointments')
      .set('Authorization', bearer('RECEPTIONIST'))
      .expect(200);
  });

  it('403 when a non-CLIENT tries the CLIENT-only booking route', async () => {
    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', bearer('ADMIN'))
      .send({
        serviceId: 's1',
        clientName: 'Maria',
        clientPhone: '+5511999999999',
        date: '2026-07-01',
        startTime: '09:00',
      })
      .expect(403);
  });

  it('201 when a CLIENT books an appointment', async () => {
    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', bearer('CLIENT'))
      .send({
        serviceId: 's1',
        clientName: 'Maria',
        clientPhone: '+5511999999999',
        date: '2026-07-01',
        startTime: '09:00',
      })
      .expect(201);
  });

  it('204 when a CLIENT cancels their own appointment (multi-role route)', async () => {
    await request(app.getHttpServer())
      .patch('/appointments/123e4567-e89b-42d3-a456-426614174000/cancel')
      .set('Authorization', bearer('CLIENT'))
      .expect(204);
  });

  it('403 when a CLIENT tries to complete an appointment (ADMIN/RECEPTIONIST only)', async () => {
    await request(app.getHttpServer())
      .patch('/appointments/123e4567-e89b-42d3-a456-426614174000/complete')
      .set('Authorization', bearer('CLIENT'))
      .expect(403);
  });
});
