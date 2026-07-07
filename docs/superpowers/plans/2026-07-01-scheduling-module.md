# Scheduling Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Do NOT add `Co-Authored-By` trailers to any commit message.

**Goal:** Build the Scheduling bounded context — appointment booking, status lifecycle, and available-slot calculation with tenant isolation and barber/service cross-references.

**Architecture:** DDD Clean Architecture. `Appointment` is the aggregate root. `BookingPolicy` is a pure domain service (no DI) that enforces business rules. Two read ports (`IBarberLookup`, `IServiceLookup`) keep Scheduling decoupled from Team/Catalog domains — their adapters query the shared DB schema directly. Application-level overlap detection (race condition risk documented; GIST exclusion constraint is the production-grade fix but requires raw SQL migration beyond Drizzle's current API).

**Tech Stack:** NestJS 11, TypeScript strict, Drizzle ORM + postgres-js, class-validator, Jest (TDD for use cases), pnpm.

---

## Task Index

| # | Task | Layer |
|---|------|-------|
| S1 | `Appointment` entity + `AppointmentStatus` + `TimeSlot` VO + time utils | Domain |
| S2 | Scheduling errors + `BookingPolicy` domain service | Domain |
| S3 | `ISchedulingRepository`, `IBarberLookup`, `IServiceLookup` ports | Domain |
| S4 | DB schema `appointments` table | Infra |
| S5 | TDD — `BookAppointment` use case | Application |
| S6 | TDD — `GetAvailableSlots` use case | Application |
| S7 | TDD — `ConfirmAppointment` use case | Application |
| S8 | TDD — `CancelAppointment` use case | Application |
| S9 | TDD — `CompleteAppointment` use case | Application |
| S10 | TDD — `GetAppointment` use case | Application |
| S11 | TDD — `ListAppointments` use case | Application |
| S12 | `SchedulingDrizzleRepository` + `BarberLookupAdapter` + `ServiceLookupAdapter` | Infra |
| S13 | `SchedulingController` | HTTP |
| S14 | Wire `SchedulingModule` | Module |

---

## Task S1 — `Appointment` entity + `AppointmentStatus` + `TimeSlot` VO + time utils

**Files to create:**
- `apps/api/src/modules/scheduling/domain/value-objects/appointment-status.ts`
- `apps/api/src/modules/scheduling/domain/value-objects/time-slot.ts`
- `apps/api/src/modules/scheduling/domain/utils/time.utils.ts`
- `apps/api/src/modules/scheduling/domain/entities/appointment.entity.ts`
- `apps/api/src/modules/scheduling/domain/entities/appointment.entity.spec.ts`

### Step-by-step

- [ ] Create `appointment-status.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/value-objects/appointment-status.ts
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export const APPOINTMENT_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
```

- [ ] Create `time-slot.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/value-objects/time-slot.ts
export interface TimeSlot {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}
```

- [ ] Create `time.utils.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/utils/time.utils.ts
import { DayOfWeek } from '../../../team/domain/value-objects/work-schedule';

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/** Parses 'YYYY-MM-DD' and returns the day of week. Uses midday to avoid DST edge cases. */
export function dayOfWeekFromDate(date: string): DayOfWeek {
  const days: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const d = new Date(date + 'T12:00:00');
  return days[d.getDay()];
}

/** Returns true if [aStart, aEnd) overlaps with [bStart, bEnd). */
export function timesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) &&
         timeToMinutes(aEnd)   > timeToMinutes(bStart);
}
```

- [ ] Create `appointment.entity.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/entities/appointment.entity.ts
import { randomUUID } from 'crypto';
import { AppointmentStatus } from '../value-objects/appointment-status';

export interface AppointmentProps {
  id: string;
  tenantId: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm (computed: startTime + durationMinutes)
  durationMinutes: number; // cached from service at booking time
  status: AppointmentStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppointmentProps {
  tenantId: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes?: string | null;
}

export class Appointment {
  readonly id: string;
  readonly tenantId: string;
  readonly barberId: string;
  readonly serviceId: string;
  private _clientName: string;
  private _clientPhone: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly durationMinutes: number;
  private _status: AppointmentStatus;
  private _notes: string | null;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: AppointmentProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.barberId = props.barberId;
    this.serviceId = props.serviceId;
    this._clientName = props.clientName;
    this._clientPhone = props.clientPhone;
    this.date = props.date;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    this.durationMinutes = props.durationMinutes;
    this._status = props.status;
    this._notes = props.notes;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get clientName(): string { return this._clientName; }
  get clientPhone(): string { return this._clientPhone; }
  get status(): AppointmentStatus { return this._status; }
  get notes(): string | null { return this._notes; }
  get updatedAt(): Date { return this._updatedAt; }

  static create(props: CreateAppointmentProps): Appointment {
    const now = new Date();
    return new Appointment({
      id: randomUUID(),
      tenantId: props.tenantId,
      barberId: props.barberId,
      serviceId: props.serviceId,
      clientName: props.clientName,
      clientPhone: props.clientPhone,
      date: props.date,
      startTime: props.startTime,
      endTime: props.endTime,
      durationMinutes: props.durationMinutes,
      status: 'PENDING',
      notes: props.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: AppointmentProps): Appointment {
    return new Appointment(props);
  }

  confirm(): void {
    if (this._status !== 'PENDING') {
      throw new Error(`Cannot confirm appointment with status ${this._status}`);
    }
    this._status = 'CONFIRMED';
    this._updatedAt = new Date();
  }

  cancel(): void {
    if (this._status === 'COMPLETED' || this._status === 'CANCELLED') {
      throw new Error(`Cannot cancel appointment with status ${this._status}`);
    }
    this._status = 'CANCELLED';
    this._updatedAt = new Date();
  }

  complete(): void {
    if (this._status !== 'CONFIRMED') {
      throw new Error(`Cannot complete appointment with status ${this._status}`);
    }
    this._status = 'COMPLETED';
    this._updatedAt = new Date();
  }
}
```

- [ ] Create `appointment.entity.spec.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/entities/appointment.entity.spec.ts
import { Appointment } from './appointment.entity';

const BASE: Parameters<typeof Appointment.create>[0] = {
  tenantId: 'tenant-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  clientName: 'João Cliente',
  clientPhone: '+5511999999999',
  date: '2025-03-10',
  startTime: '09:00',
  endTime: '09:30',
  durationMinutes: 30,
};

describe('Appointment entity', () => {
  describe('create()', () => {
    it('creates appointment with PENDING status and generated id', () => {
      const a = Appointment.create(BASE);
      expect(a.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(a.status).toBe('PENDING');
      expect(a.tenantId).toBe('tenant-1');
      expect(a.date).toBe('2025-03-10');
      expect(a.startTime).toBe('09:00');
      expect(a.endTime).toBe('09:30');
      expect(a.notes).toBeNull();
    });

    it('stores notes when provided', () => {
      const a = Appointment.create({ ...BASE, notes: 'corte degradê' });
      expect(a.notes).toBe('corte degradê');
    });
  });

  describe('confirm()', () => {
    it('transitions PENDING to CONFIRMED', () => {
      const a = Appointment.create(BASE);
      a.confirm();
      expect(a.status).toBe('CONFIRMED');
    });

    it('throws when confirming non-PENDING appointment', () => {
      const a = Appointment.reconstitute({ ...BASE, id: '1', status: 'CANCELLED', notes: null, createdAt: new Date(), updatedAt: new Date() });
      expect(() => a.confirm()).toThrow();
    });
  });

  describe('cancel()', () => {
    it('transitions PENDING to CANCELLED', () => {
      const a = Appointment.create(BASE);
      a.cancel();
      expect(a.status).toBe('CANCELLED');
    });

    it('transitions CONFIRMED to CANCELLED', () => {
      const a = Appointment.reconstitute({ ...BASE, id: '1', status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date() });
      a.cancel();
      expect(a.status).toBe('CANCELLED');
    });

    it('throws when cancelling COMPLETED appointment', () => {
      const a = Appointment.reconstitute({ ...BASE, id: '1', status: 'COMPLETED', notes: null, createdAt: new Date(), updatedAt: new Date() });
      expect(() => a.cancel()).toThrow();
    });
  });

  describe('complete()', () => {
    it('transitions CONFIRMED to COMPLETED', () => {
      const a = Appointment.reconstitute({ ...BASE, id: '1', status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date() });
      a.complete();
      expect(a.status).toBe('COMPLETED');
    });

    it('throws when completing non-CONFIRMED appointment', () => {
      const a = Appointment.create(BASE);
      expect(() => a.complete()).toThrow();
    });
  });
});
```

- [ ] Run tests: `npx jest --testPathPattern="appointment.entity.spec" --no-coverage`
  Expected: `Tests: 7 passed, 7 total`

- [ ] Commit: `feat(scheduling): add Appointment entity, AppointmentStatus, TimeSlot VO, time utils`

---

## Task S2 — Scheduling errors + `BookingPolicy` domain service

**Files to create:**
- `apps/api/src/modules/scheduling/domain/errors/scheduling.errors.ts`
- `apps/api/src/modules/scheduling/domain/services/booking-policy.ts`
- `apps/api/src/modules/scheduling/domain/services/booking-policy.spec.ts`

**Files to modify:**
- `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`

### Step-by-step

- [ ] Create scheduling errors:

```typescript
// apps/api/src/modules/scheduling/domain/errors/scheduling.errors.ts
import { DomainError } from '@shared/kernel/errors/domain-error';

export class AppointmentNotFoundError extends DomainError {
  readonly code = 'APPOINTMENT_NOT_FOUND';
  constructor(message = 'Agendamento não encontrado.') { super(message); }
}

export class AppointmentConflictError extends DomainError {
  readonly code = 'APPOINTMENT_CONFLICT';
  constructor(message = 'Horário já ocupado para este barbeiro.') { super(message); }
}

export class InvalidAppointmentTimeError extends DomainError {
  readonly code = 'INVALID_APPOINTMENT_TIME';
  constructor(message = 'Horário fora do expediente do barbeiro.') { super(message); }
}

export class InvalidStatusTransitionError extends DomainError {
  readonly code = 'INVALID_STATUS_TRANSITION';
  constructor(message = 'Transição de status inválida.') { super(message); }
}
```

- [ ] Create `BookingPolicy`:

```typescript
// apps/api/src/modules/scheduling/domain/services/booking-policy.ts
import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';
import { dayOfWeekFromDate, timeToMinutes, timesOverlap } from '../utils/time.utils';
import { AppointmentConflictError, InvalidAppointmentTimeError } from '../errors/scheduling.errors';

export interface BarberScheduleInfo {
  isActive: boolean;
  workSchedule: WorkSchedule;
}

export interface ExistingSlot {
  startTime: string;
  endTime: string;
  status: string; // AppointmentStatus
}

export class BookingPolicy {
  validate(params: {
    barber: BarberScheduleInfo;
    date: string;      // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    existing: ExistingSlot[];
  }): void {
    const { barber, date, startTime, endTime, existing } = params;

    if (!barber.isActive) {
      throw new InvalidAppointmentTimeError('Barbeiro inativo.');
    }

    const dow = dayOfWeekFromDate(date);
    const daySchedule = barber.workSchedule[dow];

    if (!daySchedule.isWorking || !daySchedule.startTime || !daySchedule.endTime) {
      throw new InvalidAppointmentTimeError('Barbeiro não trabalha neste dia.');
    }

    if (
      timeToMinutes(startTime) < timeToMinutes(daySchedule.startTime) ||
      timeToMinutes(endTime)   > timeToMinutes(daySchedule.endTime)
    ) {
      throw new InvalidAppointmentTimeError('Horário fora do expediente.');
    }

    const active = existing.filter((e) => e.status !== 'CANCELLED');
    const conflict = active.some((e) =>
      timesOverlap(startTime, endTime, e.startTime, e.endTime),
    );
    if (conflict) {
      throw new AppointmentConflictError();
    }
  }
}
```

- [ ] Create `booking-policy.spec.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/services/booking-policy.spec.ts
import { BookingPolicy, BarberScheduleInfo } from './booking-policy';
import { AppointmentConflictError, InvalidAppointmentTimeError } from '../errors/scheduling.errors';
import { defaultWorkSchedule } from '../../../team/domain/value-objects/work-schedule';

const ACTIVE_BARBER: BarberScheduleInfo = {
  isActive: true,
  workSchedule: defaultWorkSchedule(), // mon-fri 09:00-18:00, sat 09:00-13:00, sun off
};

// 2025-03-10 is a Monday
const MONDAY = '2025-03-10';
// 2025-03-09 is a Sunday
const SUNDAY = '2025-03-09';

describe('BookingPolicy', () => {
  const policy = new BookingPolicy();

  it('passes when barber works that day and slot is free', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '09:00',
        endTime: '09:30',
        existing: [],
      }),
    ).not.toThrow();
  });

  it('throws InvalidAppointmentTimeError when barber is inactive', () => {
    expect(() =>
      policy.validate({
        barber: { ...ACTIVE_BARBER, isActive: false },
        date: MONDAY,
        startTime: '09:00',
        endTime: '09:30',
        existing: [],
      }),
    ).toThrow(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when barber does not work that day', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: SUNDAY,
        startTime: '10:00',
        endTime: '10:30',
        existing: [],
      }),
    ).toThrow(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when startTime is before work hours', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '08:00',
        endTime: '08:30',
        existing: [],
      }),
    ).toThrow(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when endTime exceeds work hours', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '17:45',
        endTime: '18:15',
        existing: [],
      }),
    ).toThrow(InvalidAppointmentTimeError);
  });

  it('throws AppointmentConflictError when slot overlaps existing appointment', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '09:15',
        endTime: '09:45',
        existing: [{ startTime: '09:00', endTime: '09:30', status: 'CONFIRMED' }],
      }),
    ).toThrow(AppointmentConflictError);
  });

  it('ignores CANCELLED appointments when checking conflicts', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '09:00',
        endTime: '09:30',
        existing: [{ startTime: '09:00', endTime: '09:30', status: 'CANCELLED' }],
      }),
    ).not.toThrow();
  });

  it('allows adjacent slots (no overlap between 09:00-09:30 and 09:30-10:00)', () => {
    expect(() =>
      policy.validate({
        barber: ACTIVE_BARBER,
        date: MONDAY,
        startTime: '09:30',
        endTime: '10:00',
        existing: [{ startTime: '09:00', endTime: '09:30', status: 'CONFIRMED' }],
      }),
    ).not.toThrow();
  });
});
```

- [ ] Add new codes to `DomainExceptionFilter`. Read the file first, then add:

```typescript
APPOINTMENT_NOT_FOUND:     HttpStatus.NOT_FOUND,
APPOINTMENT_CONFLICT:      HttpStatus.CONFLICT,
INVALID_APPOINTMENT_TIME:  HttpStatus.UNPROCESSABLE_ENTITY,
INVALID_STATUS_TRANSITION: HttpStatus.UNPROCESSABLE_ENTITY,
```

- [ ] Run tests: `npx jest --testPathPattern="booking-policy.spec" --no-coverage`
  Expected: `Tests: 7 passed, 7 total`

- [ ] Commit: `feat(scheduling): add scheduling errors, BookingPolicy domain service`

---

## Task S3 — Scheduling ports

**Files to create:**
- `apps/api/src/modules/scheduling/domain/ports/barber-lookup.port.ts`
- `apps/api/src/modules/scheduling/domain/ports/service-lookup.port.ts`
- `apps/api/src/modules/scheduling/domain/repositories/scheduling.repository.ts`

### Step-by-step

- [ ] Create `barber-lookup.port.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/ports/barber-lookup.port.ts
import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';

export const BARBER_LOOKUP = Symbol('IBarberLookup');

export interface BarberLookupResult {
  isActive: boolean;
  workSchedule: WorkSchedule;
}

export interface IBarberLookup {
  findById(id: string, tenantId: string): Promise<BarberLookupResult | null>;
}
```

- [ ] Create `service-lookup.port.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/ports/service-lookup.port.ts
export const SERVICE_LOOKUP = Symbol('IServiceLookup');

export interface ServiceLookupResult {
  durationMinutes: number;
  isActive: boolean;
}

export interface IServiceLookup {
  findById(id: string, tenantId: string): Promise<ServiceLookupResult | null>;
}
```

- [ ] Create `scheduling.repository.ts`:

```typescript
// apps/api/src/modules/scheduling/domain/repositories/scheduling.repository.ts
import { Appointment } from '../entities/appointment.entity';
import { AppointmentStatus } from '../value-objects/appointment-status';

export const SCHEDULING_REPOSITORY = Symbol('ISchedulingRepository');

export interface ListAppointmentsFilter {
  date?: string;      // YYYY-MM-DD
  barberId?: string;
  status?: AppointmentStatus;
}

export interface ISchedulingRepository {
  findById(id: string, tenantId: string): Promise<Appointment | null>;
  findAll(tenantId: string, filter: ListAppointmentsFilter): Promise<Appointment[]>;
  findByBarberAndDate(barberId: string, date: string, tenantId: string): Promise<Appointment[]>;
  save(appointment: Appointment): Promise<Appointment>;
}
```

- [ ] Commit: `feat(scheduling): add ISchedulingRepository, IBarberLookup, IServiceLookup ports`

---

## Task S4 — DB schema `appointments` table

**Files to create:**
- `apps/api/src/shared/database/schema/appointments.ts`

**Files to modify:**
- `apps/api/src/shared/database/schema/index.ts`

### Step-by-step

- [ ] Create `appointments.ts`:

```typescript
// apps/api/src/shared/database/schema/appointments.ts
import { pgTable, pgEnum, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { barbers } from './barbers';
import { services } from './services';

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]);

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  barberId: uuid('barber_id').notNull().references(() => barbers.id),
  serviceId: uuid('service_id').notNull().references(() => services.id),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  date: text('date').notNull(),            // YYYY-MM-DD
  startTime: text('start_time').notNull(), // HH:mm
  endTime: text('end_time').notNull(),     // HH:mm
  durationMinutes: integer('duration_minutes').notNull(),
  status: appointmentStatusEnum('status').notNull().default('PENDING'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AppointmentRow = typeof appointments.$inferSelect;
export type NewAppointmentRow = typeof appointments.$inferInsert;
```

- [ ] Add export to `apps/api/src/shared/database/schema/index.ts`:

```typescript
export * from './tenants';
export * from './users';
export * from './refresh-tokens';
export * from './services';
export * from './barbers';
export * from './appointments';
```

- [ ] Generate and apply migration:

```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
```

- [ ] Run tsc: `pnpm exec tsc --noEmit` — expect zero errors.

- [ ] Commit: `feat(scheduling): add appointments table schema with status enum`

---

## Task S5 — TDD: `BookAppointment` use case

**Files to create:**
- `apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts
import { BookAppointmentUseCase, BookAppointmentInput } from './book-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { IBarberLookup } from '../../domain/ports/barber-lookup.port';
import { IServiceLookup } from '../../domain/ports/service-lookup.port';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentConflictError, InvalidAppointmentTimeError } from '../../domain/errors/scheduling.errors';
import { defaultWorkSchedule } from '../../../team/domain/value-objects/work-schedule';

const MONDAY = '2025-03-10';

const ACTIVE_BARBER = {
  isActive: true,
  workSchedule: defaultWorkSchedule(), // mon-fri 09:00-18:00
};

const ACTIVE_SERVICE = { durationMinutes: 30, isActive: true };

function makeRepo(overrides?: Partial<ISchedulingRepository>): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (a: Appointment) => a),
    ...overrides,
  };
}

function makeBarberLookup(result = ACTIVE_BARBER): IBarberLookup {
  return { findById: jest.fn().mockResolvedValue(result) };
}

function makeServiceLookup(result = ACTIVE_SERVICE): IServiceLookup {
  return { findById: jest.fn().mockResolvedValue(result) };
}

const INPUT: BookAppointmentInput = {
  tenantId: 'tenant-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  clientName: 'João Cliente',
  clientPhone: '+5511999999999',
  date: MONDAY,
  startTime: '09:00',
};

describe('BookAppointmentUseCase', () => {
  it('creates and saves appointment with computed endTime', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup());
    const result = await uc.execute(INPUT);
    expect(result.status).toBe('PENDING');
    expect(result.startTime).toBe('09:00');
    expect(result.endTime).toBe('09:30');
    expect(result.durationMinutes).toBe(30);
    expect(repo.save).toHaveBeenCalledWith(expect.any(Appointment));
  });

  it('throws InvalidAppointmentTimeError when barber not found', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(null), makeServiceLookup());
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when service not found', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup(null));
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(InvalidAppointmentTimeError);
  });

  it('throws InvalidAppointmentTimeError when barber does not work that day', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup());
    await expect(uc.execute({ ...INPUT, date: '2025-03-09' })).rejects.toBeInstanceOf(InvalidAppointmentTimeError);
  });

  it('throws AppointmentConflictError when slot is taken', async () => {
    const existing = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+5511888888888',
      date: MONDAY, startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = makeRepo({ findByBarberAndDate: jest.fn().mockResolvedValue([existing]) });
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup());
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(AppointmentConflictError);
  });
});
```

- [ ] Run (expect red): `npx jest --testPathPattern="book-appointment.use-case.spec" --no-coverage`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { BARBER_LOOKUP, IBarberLookup } from '../../domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP, IServiceLookup } from '../../domain/ports/service-lookup.port';
import { Appointment } from '../../domain/entities/appointment.entity';
import { BookingPolicy } from '../../domain/services/booking-policy';
import { InvalidAppointmentTimeError } from '../../domain/errors/scheduling.errors';
import { addMinutes } from '../../domain/utils/time.utils';

export interface BookAppointmentInput {
  tenantId: string;
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  notes?: string | null;
}

@Injectable()
export class BookAppointmentUseCase {
  private readonly policy = new BookingPolicy();

  constructor(
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository,
    @Inject(BARBER_LOOKUP)         private readonly barberLookup: IBarberLookup,
    @Inject(SERVICE_LOOKUP)        private readonly serviceLookup: IServiceLookup,
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

    return this.repo.save(appointment);
  }
}
```

- [ ] Run (expect green): `npx jest --testPathPattern="book-appointment.use-case.spec" --no-coverage`
  Expected: `Tests: 5 passed, 5 total`

- [ ] Commit: `feat(scheduling): BookAppointment use case`

---

## Task S6 — TDD: `GetAvailableSlots` use case

**Files to create:**
- `apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.spec.ts
import { GetAvailableSlotsUseCase, GetAvailableSlotsInput } from './get-available-slots.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { IBarberLookup } from '../../domain/ports/barber-lookup.port';
import { IServiceLookup } from '../../domain/ports/service-lookup.port';
import { Appointment } from '../../domain/entities/appointment.entity';
import { defaultWorkSchedule } from '../../../team/domain/value-objects/work-schedule';

const MONDAY = '2025-03-10'; // Monday

const ACTIVE_BARBER = {
  isActive: true,
  workSchedule: defaultWorkSchedule(), // mon: 09:00-18:00
};

function makeRepo(existing: Appointment[] = []): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue(existing),
    save: jest.fn(),
  };
}

function makeBarberLookup(result = ACTIVE_BARBER): IBarberLookup {
  return { findById: jest.fn().mockResolvedValue(result) };
}

function makeServiceLookup(durationMinutes = 30): IServiceLookup {
  return { findById: jest.fn().mockResolvedValue({ durationMinutes, isActive: true }) };
}

const INPUT: GetAvailableSlotsInput = {
  tenantId: 'tenant-1',
  barberId: 'barber-1',
  serviceId: 'service-1',
  date: MONDAY,
};

describe('GetAvailableSlotsUseCase', () => {
  it('returns slots within work hours for a 30-min service', async () => {
    const uc = new GetAvailableSlotsUseCase(makeRepo(), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toEqual({ startTime: '09:00', endTime: '09:30' });
    expect(slots[slots.length - 1]).toEqual({ startTime: '17:30', endTime: '18:00' });
  });

  it('returns empty array when barber does not work that day (Sunday)', async () => {
    const uc = new GetAvailableSlotsUseCase(makeRepo(), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute({ ...INPUT, date: '2025-03-09' });
    expect(slots).toEqual([]);
  });

  it('returns empty array when barber not found', async () => {
    const uc = new GetAvailableSlotsUseCase(makeRepo(), makeBarberLookup(null), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    expect(slots).toEqual([]);
  });

  it('excludes slots that overlap with existing appointments', async () => {
    const existing = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const uc = new GetAvailableSlotsUseCase(makeRepo([existing]), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    const has0900 = slots.some((s) => s.startTime === '09:00');
    expect(has0900).toBe(false);
    expect(slots[0].startTime).toBe('09:30');
  });

  it('includes slots adjacent to existing appointments', async () => {
    const existing = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const uc = new GetAvailableSlotsUseCase(makeRepo([existing]), makeBarberLookup(), makeServiceLookup(30));
    const slots = await uc.execute(INPUT);
    const has0930 = slots.some((s) => s.startTime === '09:30');
    expect(has0930).toBe(true);
  });
});
```

- [ ] Run (expect red): `npx jest --testPathPattern="get-available-slots.use-case.spec" --no-coverage`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { BARBER_LOOKUP, IBarberLookup } from '../../domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP, IServiceLookup } from '../../domain/ports/service-lookup.port';
import { TimeSlot } from '../../domain/value-objects/time-slot';
import { dayOfWeekFromDate, timeToMinutes, minutesToTime, timesOverlap } from '../../domain/utils/time.utils';

const SLOT_STEP_MINUTES = 30;

export interface GetAvailableSlotsInput {
  tenantId: string;
  barberId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
}

@Injectable()
export class GetAvailableSlotsUseCase {
  constructor(
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository,
    @Inject(BARBER_LOOKUP)         private readonly barberLookup: IBarberLookup,
    @Inject(SERVICE_LOOKUP)        private readonly serviceLookup: IServiceLookup,
  ) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    const [barber, service] = await Promise.all([
      this.barberLookup.findById(input.barberId, input.tenantId),
      this.serviceLookup.findById(input.serviceId, input.tenantId),
    ]);

    if (!barber || !service) return [];

    const dow = dayOfWeekFromDate(input.date);
    const daySchedule = barber.workSchedule[dow];
    if (!daySchedule.isWorking || !daySchedule.startTime || !daySchedule.endTime) return [];

    const workStart   = timeToMinutes(daySchedule.startTime);
    const workEnd     = timeToMinutes(daySchedule.endTime);
    const duration    = service.durationMinutes;

    const existing = await this.repo.findByBarberAndDate(input.barberId, input.date, input.tenantId);
    const active   = existing
      .filter((a) => a.status !== 'CANCELLED')
      .map((a) => ({ startTime: a.startTime, endTime: a.endTime }));

    const slots: TimeSlot[] = [];
    for (let t = workStart; t + duration <= workEnd; t += SLOT_STEP_MINUTES) {
      const startTime = minutesToTime(t);
      const endTime   = minutesToTime(t + duration);
      const blocked   = active.some((e) => timesOverlap(startTime, endTime, e.startTime, e.endTime));
      if (!blocked) slots.push({ startTime, endTime });
    }

    return slots;
  }
}
```

- [ ] Run (expect green): `npx jest --testPathPattern="get-available-slots.use-case.spec" --no-coverage`
  Expected: `Tests: 5 passed, 5 total`

- [ ] Commit: `feat(scheduling): GetAvailableSlots use case`

---

## Task S7 — TDD: `ConfirmAppointment` use case

**Files to create:**
- `apps/api/src/modules/scheduling/application/use-cases/confirm-appointment.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/confirm-appointment.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/confirm-appointment.use-case.spec.ts
import { ConfirmAppointmentUseCase } from './confirm-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';

function makeAppt(status: Appointment['status'] = 'PENDING') {
  return Appointment.reconstitute({
    id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
    clientName: 'João', clientPhone: '+55', date: '2025-03-10',
    startTime: '09:00', endTime: '09:30', durationMinutes: 30,
    status, notes: null, createdAt: new Date(), updatedAt: new Date(),
  });
}

function makeRepo(appt: Appointment | null = makeAppt()): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(appt),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (a: Appointment) => a),
  };
}

describe('ConfirmAppointmentUseCase', () => {
  it('confirms a PENDING appointment', async () => {
    const repo = makeRepo();
    const uc = new ConfirmAppointmentUseCase(repo);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.status).toBe('CONFIRMED');
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const uc = new ConfirmAppointmentUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it('throws InvalidStatusTransitionError when appointment is not PENDING', async () => {
    const uc = new ConfirmAppointmentUseCase(makeRepo(makeAppt('CANCELLED')));
    await expect(uc.execute({ id: 'appt-1', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });
});
```

- [ ] Run (expect red): `npx jest --testPathPattern="confirm-appointment.use-case.spec" --no-coverage`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/confirm-appointment.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';

export interface AppointmentActionInput { id: string; tenantId: string; }

@Injectable()
export class ConfirmAppointmentUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: AppointmentActionInput): Promise<Appointment> {
    const appt = await this.repo.findById(input.id, input.tenantId);
    if (!appt) throw new AppointmentNotFoundError();
    try {
      appt.confirm();
    } catch {
      throw new InvalidStatusTransitionError();
    }
    return this.repo.save(appt);
  }
}
```

- [ ] Run (expect green): `npx jest --testPathPattern="confirm-appointment.use-case.spec" --no-coverage`
  Expected: `Tests: 3 passed, 3 total`

- [ ] Commit: `feat(scheduling): ConfirmAppointment use case`

---

## Task S8 — TDD: `CancelAppointment` use case

**Files to create:**
- `apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.spec.ts
import { CancelAppointmentUseCase } from './cancel-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';

function makeAppt(status: Appointment['status'] = 'PENDING') {
  return Appointment.reconstitute({
    id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
    clientName: 'João', clientPhone: '+55', date: '2025-03-10',
    startTime: '09:00', endTime: '09:30', durationMinutes: 30,
    status, notes: null, createdAt: new Date(), updatedAt: new Date(),
  });
}

function makeRepo(appt: Appointment | null = makeAppt()): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(appt),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (a: Appointment) => a),
  };
}

describe('CancelAppointmentUseCase', () => {
  it('cancels a PENDING appointment', async () => {
    const repo = makeRepo();
    const uc = new CancelAppointmentUseCase(repo);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.status).toBe('CANCELLED');
  });

  it('cancels a CONFIRMED appointment', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(makeAppt('CONFIRMED')));
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.status).toBe('CANCELLED');
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it('throws InvalidStatusTransitionError when appointment is COMPLETED', async () => {
    const uc = new CancelAppointmentUseCase(makeRepo(makeAppt('COMPLETED')));
    await expect(uc.execute({ id: 'appt-1', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });
});
```

- [ ] Run (expect red): `npx jest --testPathPattern="cancel-appointment.use-case.spec" --no-coverage`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';
import { AppointmentActionInput } from './confirm-appointment.use-case';

@Injectable()
export class CancelAppointmentUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: AppointmentActionInput): Promise<Appointment> {
    const appt = await this.repo.findById(input.id, input.tenantId);
    if (!appt) throw new AppointmentNotFoundError();
    try {
      appt.cancel();
    } catch {
      throw new InvalidStatusTransitionError();
    }
    return this.repo.save(appt);
  }
}
```

- [ ] Run (expect green): `npx jest --testPathPattern="cancel-appointment.use-case.spec" --no-coverage`
  Expected: `Tests: 4 passed, 4 total`

- [ ] Commit: `feat(scheduling): CancelAppointment use case`

---

## Task S9 — TDD: `CompleteAppointment` use case

**Files to create:**
- `apps/api/src/modules/scheduling/application/use-cases/complete-appointment.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/complete-appointment.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/complete-appointment.use-case.spec.ts
import { CompleteAppointmentUseCase } from './complete-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';

function makeAppt(status: Appointment['status'] = 'CONFIRMED') {
  return Appointment.reconstitute({
    id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
    clientName: 'João', clientPhone: '+55', date: '2025-03-10',
    startTime: '09:00', endTime: '09:30', durationMinutes: 30,
    status, notes: null, createdAt: new Date(), updatedAt: new Date(),
  });
}

function makeRepo(appt: Appointment | null = makeAppt()): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(appt),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (a: Appointment) => a),
  };
}

describe('CompleteAppointmentUseCase', () => {
  it('completes a CONFIRMED appointment', async () => {
    const repo = makeRepo();
    const uc = new CompleteAppointmentUseCase(repo);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.status).toBe('COMPLETED');
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const uc = new CompleteAppointmentUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });

  it('throws InvalidStatusTransitionError when appointment is not CONFIRMED', async () => {
    const uc = new CompleteAppointmentUseCase(makeRepo(makeAppt('PENDING')));
    await expect(uc.execute({ id: 'appt-1', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });
});
```

- [ ] Run (expect red): `npx jest --testPathPattern="complete-appointment.use-case.spec" --no-coverage`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/complete-appointment.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError, InvalidStatusTransitionError } from '../../domain/errors/scheduling.errors';
import { AppointmentActionInput } from './confirm-appointment.use-case';

@Injectable()
export class CompleteAppointmentUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: AppointmentActionInput): Promise<Appointment> {
    const appt = await this.repo.findById(input.id, input.tenantId);
    if (!appt) throw new AppointmentNotFoundError();
    try {
      appt.complete();
    } catch {
      throw new InvalidStatusTransitionError();
    }
    return this.repo.save(appt);
  }
}
```

- [ ] Run (expect green): `npx jest --testPathPattern="complete-appointment.use-case.spec" --no-coverage`
  Expected: `Tests: 3 passed, 3 total`

- [ ] Commit: `feat(scheduling): CompleteAppointment use case`

---

## Task S10 — TDD: `GetAppointment` use case

**Files to create:**
- `apps/api/src/modules/scheduling/application/use-cases/get-appointment.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/get-appointment.use-case.spec.ts`

### Step-by-step

- [ ] Write spec (TDD — red):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/get-appointment.use-case.spec.ts
import { GetAppointmentUseCase } from './get-appointment.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError } from '../../domain/errors/scheduling.errors';

const EXISTING = Appointment.reconstitute({
  id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
  clientName: 'João', clientPhone: '+55', date: '2025-03-10',
  startTime: '09:00', endTime: '09:30', durationMinutes: 30,
  status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
});

function makeRepo(appt: Appointment | null = EXISTING): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(appt),
    findAll: jest.fn().mockResolvedValue([]),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };
}

describe('GetAppointmentUseCase', () => {
  it('returns the appointment when it exists', async () => {
    const uc = new GetAppointmentUseCase(makeRepo());
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1' });
    expect(result.id).toBe('appt-1');
    expect(result.clientName).toBe('João');
  });

  it('throws AppointmentNotFoundError when not found', async () => {
    const uc = new GetAppointmentUseCase(makeRepo(null));
    await expect(uc.execute({ id: 'x', tenantId: 'tenant-1' })).rejects.toBeInstanceOf(AppointmentNotFoundError);
  });
});
```

- [ ] Run (expect red): `npx jest --testPathPattern="get-appointment.use-case.spec" --no-coverage`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/get-appointment.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentNotFoundError } from '../../domain/errors/scheduling.errors';

@Injectable()
export class GetAppointmentUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: { id: string; tenantId: string }): Promise<Appointment> {
    const appt = await this.repo.findById(input.id, input.tenantId);
    if (!appt) throw new AppointmentNotFoundError();
    return appt;
  }
}
```

- [ ] Run (expect green): `npx jest --testPathPattern="get-appointment.use-case.spec" --no-coverage`
  Expected: `Tests: 2 passed, 2 total`

- [ ] Commit: `feat(scheduling): GetAppointment use case`

---

## Task S11 — TDD: `ListAppointments` use case

**Files to create:**
- `apps/api/src/modules/scheduling/application/use-cases/list-appointments.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/list-appointments.use-case.spec.ts`

### Step-by-step

- [ ] Write spec (TDD — red):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/list-appointments.use-case.spec.ts
import { ListAppointmentsUseCase, ListAppointmentsInput } from './list-appointments.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';

function makeAppt(id: string, date: string, barberId: string, status: Appointment['status']) {
  return Appointment.reconstitute({
    id, tenantId: 'tenant-1', barberId, serviceId: 'svc-1',
    clientName: 'João', clientPhone: '+55', date,
    startTime: '09:00', endTime: '09:30', durationMinutes: 30,
    status, notes: null, createdAt: new Date(), updatedAt: new Date(),
  });
}

const APPTS = [
  makeAppt('a1', '2025-03-10', 'barber-1', 'PENDING'),
  makeAppt('a2', '2025-03-10', 'barber-2', 'CONFIRMED'),
  makeAppt('a3', '2025-03-11', 'barber-1', 'COMPLETED'),
];

function makeRepo(appts = APPTS): ISchedulingRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockImplementation(async (_tenantId: string, filter: { date?: string; barberId?: string; status?: string }) => {
      return appts.filter((a) => {
        if (filter.date     && a.date     !== filter.date)     return false;
        if (filter.barberId && a.barberId !== filter.barberId) return false;
        if (filter.status   && a.status   !== filter.status)   return false;
        return true;
      });
    }),
    findByBarberAndDate: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };
}

describe('ListAppointmentsUseCase', () => {
  it('returns all appointments for tenant when no filter applied', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1' });
    expect(result).toHaveLength(3);
  });

  it('filters by date', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1', date: '2025-03-10' });
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.date === '2025-03-10')).toBe(true);
  });

  it('filters by barberId', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1', barberId: 'barber-1' });
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.barberId === 'barber-1')).toBe(true);
  });

  it('filters by status', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1', status: 'CONFIRMED' });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('CONFIRMED');
  });

  it('returns empty array when no appointments match', async () => {
    const uc = new ListAppointmentsUseCase(makeRepo());
    const result = await uc.execute({ tenantId: 'tenant-1', date: '2099-01-01' });
    expect(result).toEqual([]);
  });
});
```

- [ ] Run (expect red): `npx jest --testPathPattern="list-appointments.use-case.spec" --no-coverage`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/scheduling/application/use-cases/list-appointments.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository, ListAppointmentsFilter } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentStatus } from '../../domain/value-objects/appointment-status';

export interface ListAppointmentsInput {
  tenantId: string;
  date?: string;
  barberId?: string;
  status?: AppointmentStatus;
}

@Injectable()
export class ListAppointmentsUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: ListAppointmentsInput): Promise<Appointment[]> {
    const filter: ListAppointmentsFilter = {
      date:     input.date,
      barberId: input.barberId,
      status:   input.status,
    };
    return this.repo.findAll(input.tenantId, filter);
  }
}
```

- [ ] Run (expect green): `npx jest --testPathPattern="list-appointments.use-case.spec" --no-coverage`
  Expected: `Tests: 5 passed, 5 total`

- [ ] Commit: `feat(scheduling): ListAppointments use case`

---

## Task S12 — `SchedulingDrizzleRepository` + lookup adapters

**Files to create:**
- `apps/api/src/modules/scheduling/infra/repositories/scheduling-drizzle.repository.ts`
- `apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.ts`
- `apps/api/src/modules/scheduling/infra/adapters/service-lookup.adapter.ts`

### Step-by-step

- [ ] Create `scheduling-drizzle.repository.ts`:

```typescript
// apps/api/src/modules/scheduling/infra/repositories/scheduling-drizzle.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import {
  ISchedulingRepository,
  ListAppointmentsFilter,
} from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentStatus } from '../../domain/value-objects/appointment-status';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class SchedulingDrizzleRepository implements ISchedulingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findById(id: string, tenantId: string): Promise<Appointment | null> {
    const rows = await this.db
      .select()
      .from(schema.appointments)
      .where(and(eq(schema.appointments.id, id), eq(schema.appointments.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findAll(tenantId: string, filter: ListAppointmentsFilter): Promise<Appointment[]> {
    const conditions = [eq(schema.appointments.tenantId, tenantId)];
    if (filter.date)     conditions.push(eq(schema.appointments.date,     filter.date));
    if (filter.barberId) conditions.push(eq(schema.appointments.barberId, filter.barberId));
    if (filter.status)   conditions.push(eq(schema.appointments.status,   filter.status));
    const rows = await this.db
      .select()
      .from(schema.appointments)
      .where(and(...conditions));
    return rows.map((r) => this.toEntity(r));
  }

  async findByBarberAndDate(barberId: string, date: string, tenantId: string): Promise<Appointment[]> {
    const rows = await this.db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.tenantId, tenantId),
          eq(schema.appointments.barberId, barberId),
          eq(schema.appointments.date,     date),
        ),
      );
    return rows.map((r) => this.toEntity(r));
  }

  async save(appointment: Appointment): Promise<Appointment> {
    const updatedAt = appointment.updatedAt;
    await this.db
      .insert(schema.appointments)
      .values({
        id:              appointment.id,
        tenantId:        appointment.tenantId,
        barberId:        appointment.barberId,
        serviceId:       appointment.serviceId,
        clientName:      appointment.clientName,
        clientPhone:     appointment.clientPhone,
        date:            appointment.date,
        startTime:       appointment.startTime,
        endTime:         appointment.endTime,
        durationMinutes: appointment.durationMinutes,
        status:          appointment.status,
        notes:           appointment.notes,
        createdAt:       appointment.createdAt,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.appointments.id,
        set: {
          status:    appointment.status,
          notes:     appointment.notes,
          updatedAt,
        },
      });

    return Appointment.reconstitute({
      id:              appointment.id,
      tenantId:        appointment.tenantId,
      barberId:        appointment.barberId,
      serviceId:       appointment.serviceId,
      clientName:      appointment.clientName,
      clientPhone:     appointment.clientPhone,
      date:            appointment.date,
      startTime:       appointment.startTime,
      endTime:         appointment.endTime,
      durationMinutes: appointment.durationMinutes,
      status:          appointment.status,
      notes:           appointment.notes,
      createdAt:       appointment.createdAt,
      updatedAt,
    });
  }

  private toEntity(row: typeof schema.appointments.$inferSelect): Appointment {
    return Appointment.reconstitute({
      id:              row.id,
      tenantId:        row.tenantId,
      barberId:        row.barberId,
      serviceId:       row.serviceId,
      clientName:      row.clientName,
      clientPhone:     row.clientPhone,
      date:            row.date,
      startTime:       row.startTime,
      endTime:         row.endTime,
      durationMinutes: row.durationMinutes,
      status:          row.status as AppointmentStatus,
      notes:           row.notes ?? null,
      createdAt:       row.createdAt,
      updatedAt:       row.updatedAt,
    });
  }
}
```

- [ ] Create `barber-lookup.adapter.ts`:

```typescript
// apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IBarberLookup, BarberLookupResult } from '../../domain/ports/barber-lookup.port';
import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class BarberLookupAdapter implements IBarberLookup {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findById(id: string, tenantId: string): Promise<BarberLookupResult | null> {
    const rows = await this.db
      .select({ isActive: schema.barbers.isActive, workSchedule: schema.barbers.workSchedule })
      .from(schema.barbers)
      .where(and(eq(schema.barbers.id, id), eq(schema.barbers.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return null;
    return {
      isActive:     rows[0].isActive,
      workSchedule: rows[0].workSchedule as WorkSchedule,
    };
  }
}
```

- [ ] Create `service-lookup.adapter.ts`:

```typescript
// apps/api/src/modules/scheduling/infra/adapters/service-lookup.adapter.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { IServiceLookup, ServiceLookupResult } from '../../domain/ports/service-lookup.port';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class ServiceLookupAdapter implements IServiceLookup {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async findById(id: string, tenantId: string): Promise<ServiceLookupResult | null> {
    const rows = await this.db
      .select({ durationMinutes: schema.services.durationMinutes, isActive: schema.services.isActive })
      .from(schema.services)
      .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, tenantId)))
      .limit(1);
    if (!rows[0]) return null;
    return {
      durationMinutes: rows[0].durationMinutes,
      isActive:        rows[0].isActive,
    };
  }
}
```

- [ ] Run tsc: `pnpm exec tsc --noEmit` — expect zero errors.

- [ ] Commit: `feat(scheduling): SchedulingDrizzleRepository, BarberLookupAdapter, ServiceLookupAdapter`

---

## Task S13 — `SchedulingController`

**Files to create:**
- `apps/api/src/modules/scheduling/http/scheduling.controller.ts`

### Step-by-step

- [ ] Create `scheduling.controller.ts`:

```typescript
// apps/api/src/modules/scheduling/http/scheduling.controller.ts
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
} from 'class-validator';
import { isUUID } from 'class-validator';
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
import { Appointment } from '../domain/entities/appointment.entity';
import { AppointmentStatus, APPOINTMENT_STATUSES } from '../domain/value-objects/appointment-status';

class BookAppointmentDto {
  @IsString()
  @IsNotEmpty()
  barberId!: string;

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
  ) {}

  /** Public: check available slots before booking */
  @Public()
  @Get('available-slots')
  async availableSlots(
    @Headers('x-tenant-id') tenantId: string,
    @Query('barberId') barberId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    requireTenantId(tenantId);
    if (!barberId || !serviceId || !date) {
      throw new BadRequestException('barberId, serviceId e date são obrigatórios.');
    }
    return this.getAvailableSlots.execute({ tenantId, barberId, serviceId, date });
  }

  /** Public: client books appointment */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async book(
    @Headers('x-tenant-id') tenantId: string,
    @Body() dto: BookAppointmentDto,
  ) {
    requireTenantId(tenantId);
    const appt = await this.bookAppointment.execute({
      tenantId,
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

  /** ADMIN: list appointments with optional filters */
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

  /** ADMIN: get single appointment */
  @Roles('ADMIN')
  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const appt = await this.getAppointment.execute({ id, tenantId: user.tenantId });
    return serializeAppointment(appt);
  }

  /** ADMIN: confirm */
  @Roles('ADMIN')
  @Patch(':id/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirm(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.confirmAppointment.execute({ id, tenantId: user.tenantId });
  }

  /** ADMIN: cancel */
  @Roles('ADMIN')
  @Patch(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.cancelAppointment.execute({ id, tenantId: user.tenantId });
  }

  /** ADMIN: complete */
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
```

- [ ] Run tsc: `pnpm exec tsc --noEmit` — expect zero errors.

- [ ] Commit: `feat(scheduling): SchedulingController with 7 routes`

---

## Task S14 — Wire `SchedulingModule`

**Files to modify:**
- `apps/api/src/modules/scheduling/scheduling.module.ts`

### Step-by-step

- [ ] Replace stub with full wiring:

```typescript
// apps/api/src/modules/scheduling/scheduling.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/database/database.module';

import { SCHEDULING_REPOSITORY } from './domain/repositories/scheduling.repository';
import { BARBER_LOOKUP }         from './domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP }        from './domain/ports/service-lookup.port';

import { SchedulingDrizzleRepository } from './infra/repositories/scheduling-drizzle.repository';
import { BarberLookupAdapter }         from './infra/adapters/barber-lookup.adapter';
import { ServiceLookupAdapter }        from './infra/adapters/service-lookup.adapter';

import { BookAppointmentUseCase }     from './application/use-cases/book-appointment.use-case';
import { GetAvailableSlotsUseCase }   from './application/use-cases/get-available-slots.use-case';
import { ConfirmAppointmentUseCase }  from './application/use-cases/confirm-appointment.use-case';
import { CancelAppointmentUseCase }   from './application/use-cases/cancel-appointment.use-case';
import { CompleteAppointmentUseCase } from './application/use-cases/complete-appointment.use-case';
import { GetAppointmentUseCase }      from './application/use-cases/get-appointment.use-case';
import { ListAppointmentsUseCase }    from './application/use-cases/list-appointments.use-case';

import { SchedulingController } from './http/scheduling.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [SchedulingController],
  providers: [
    { provide: SCHEDULING_REPOSITORY, useClass: SchedulingDrizzleRepository },
    { provide: BARBER_LOOKUP,         useClass: BarberLookupAdapter },
    { provide: SERVICE_LOOKUP,        useClass: ServiceLookupAdapter },
    BookAppointmentUseCase,
    GetAvailableSlotsUseCase,
    ConfirmAppointmentUseCase,
    CancelAppointmentUseCase,
    CompleteAppointmentUseCase,
    GetAppointmentUseCase,
    ListAppointmentsUseCase,
  ],
})
export class SchedulingModule {}
```

- [ ] Run full test suite: `npx jest --no-coverage`
  Expected: all previous tests pass + scheduling tests.

- [ ] Run tsc: `pnpm exec tsc --noEmit` — zero errors.

- [ ] Run build: `pnpm --filter api build` — success.

- [ ] Commit: `feat(scheduling): wire SchedulingModule`

---

## Final directory structure

```
apps/api/src/modules/scheduling/
├── domain/
│   ├── entities/
│   │   ├── appointment.entity.ts
│   │   └── appointment.entity.spec.ts
│   ├── errors/
│   │   └── scheduling.errors.ts
│   ├── ports/
│   │   ├── barber-lookup.port.ts
│   │   └── service-lookup.port.ts
│   ├── repositories/
│   │   └── scheduling.repository.ts
│   ├── services/
│   │   ├── booking-policy.ts
│   │   └── booking-policy.spec.ts
│   ├── utils/
│   │   └── time.utils.ts
│   └── value-objects/
│       ├── appointment-status.ts
│       └── time-slot.ts
├── application/
│   └── use-cases/
│       ├── book-appointment.use-case.ts + .spec.ts
│       ├── get-available-slots.use-case.ts + .spec.ts
│       ├── confirm-appointment.use-case.ts + .spec.ts
│       ├── cancel-appointment.use-case.ts + .spec.ts
│       ├── complete-appointment.use-case.ts + .spec.ts
│       ├── get-appointment.use-case.ts + .spec.ts
│       └── list-appointments.use-case.ts + .spec.ts
├── infra/
│   ├── adapters/
│   │   ├── barber-lookup.adapter.ts
│   │   └── service-lookup.adapter.ts
│   └── repositories/
│       └── scheduling-drizzle.repository.ts
├── http/
│   └── scheduling.controller.ts
└── scheduling.module.ts

apps/api/src/shared/database/schema/
└── appointments.ts  (added)
    index.ts         (updated)

apps/api/src/shared/kernel/errors/
└── domain-exception.filter.ts  (updated — 4 new codes)
```

---

## Self-review checklist

- [x] All 7 use cases implemented: Book, GetAvailableSlots, Confirm, Cancel, Complete, Get, List
- [x] No placeholders — every step has complete compilable code
- [x] `BookingPolicy` is pure domain logic (no DI, no async) — fully unit-testable without mocks
- [x] Cross-module data access via `IBarberLookup`/`IServiceLookup` ports — Scheduling domain is decoupled from Team/Catalog
- [x] `SCHEDULING_REPOSITORY`, `BARBER_LOOKUP`, `SERVICE_LOOKUP` Symbol tokens used throughout
- [x] `DomainExceptionFilter` updated with all 4 new codes
- [x] DB schema uses `pgEnum` for `appointment_status`, `text` for date/time fields (avoids timezone surprises)
- [x] `save()` honors `appointment.updatedAt` (set by domain entity methods)
- [x] Public routes (`POST /appointments`, `GET /appointments/available-slots`) validate `x-tenant-id` presence and UUID format
- [x] All ADMIN routes use `ParseUUIDPipe` on `:id` param
- [x] `GetAvailableSlots` uses 30-min step; slots generated from work-hours start to (end - duration)
- [x] Adjacent slots are available (overlap check is strict: `aStart < bEnd && aEnd > bStart`)
- [x] CANCELLED appointments excluded from overlap check in both `BookingPolicy` and `GetAvailableSlots`
- [x] No `Co-Authored-By` in any commit message
- [x] One commit per task
