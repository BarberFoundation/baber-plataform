# Scheduling My-Appointments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Do NOT add `Co-Authored-By` trailers to any commit message.
>
> **Depends on:** `docs/superpowers/plans/2026-07-07-scheduling-auto-assign.md` (must be merged first — this plan's `BookAppointmentUseCase`/`BookAppointmentInput` edits build on that plan's version of the same file).

**Goal:** Link appointments to the authenticated customer who booked them (`customerId`), require login to book, add `GET /appointments/my` for a customer's own appointments, and let a customer cancel (not reschedule) their own upcoming appointment.

**Architecture:** Add a nullable `customer_id` FK column to `appointments` (nullable so existing/admin-created rows aren't broken). `POST /appointments` moves from `@Public()` to `@Roles('CLIENT')`, sourcing `customerId` from the JWT. `GET /appointments/my` is a new `ListMyAppointmentsUseCase` filtering by `customerId`. `PATCH /:id/cancel` keeps `ADMIN` access but also allows the appointment's own customer, enforced via a manual ownership check inside the handler (the existing `RolesGuard` only checks role, not resource ownership) plus a new domain rule: customers can only cancel while status is `PENDING`/`CONFIRMED` and the appointment hasn't started yet.

**Tech Stack:** NestJS 11, TypeScript strict, Drizzle ORM + postgres-js, class-validator, Jest.

**Repo:** `C:\Users\gabry\Documents\baber` (`apps/api`).

**Design ref:** `docs/superpowers/specs/2026-07-07-mobile-app-full-design.md` §2.

---

## Task 1: `customer_id` column + migration

**Files:**
- Modify: `apps/api/src/shared/database/schema/appointments.ts`

- [ ] **Step 1: Add the column**

In `appointments.ts`, add the import and column:

```ts
import { pgTable, pgEnum, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { barbers } from './barbers';
import { services } from './services';
import { users } from './users';

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
  customerId: uuid('customer_id').references(() => users.id),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  status: appointmentStatusEnum('status').notNull().default('PENDING'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AppointmentRow = typeof appointments.$inferSelect;
export type NewAppointmentRow = typeof appointments.$inferInsert;
```

- [ ] **Step 2: Generate the migration**

Run: `cd apps/api && npx drizzle-kit generate`
Expected: creates `drizzle/migrations/0008_<name>.sql` containing `ALTER TABLE "appointments" ADD COLUMN "customer_id" uuid; ALTER TABLE "appointments" ADD CONSTRAINT ... FOREIGN KEY ("customer_id") REFERENCES "users"("id");` (exact adjective/noun name is drizzle-kit's auto-generated slug — commit whatever it names it).

- [ ] **Step 3: Apply the migration to the local dev database**

Run: `cd apps/api && npx drizzle-kit migrate`
Expected: "Migrations applied successfully" (or similar) with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/shared/database/schema/appointments.ts apps/api/drizzle/migrations
git commit -m "feat(scheduling): add nullable customer_id to appointments"
```

---

## Task 2: Domain entity + repository carry `customerId`

**Files:**
- Modify: `apps/api/src/modules/scheduling/domain/entities/appointment.entity.ts`
- Modify: `apps/api/src/modules/scheduling/domain/repositories/scheduling.repository.ts`
- Modify: `apps/api/src/modules/scheduling/infra/repositories/scheduling-drizzle.repository.ts`
- Test: `apps/api/src/modules/scheduling/domain/entities/appointment.entity.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `appointment.entity.spec.ts` (check the file first for its existing `describe` structure, then add this test inside it — if the file uses a different fixture-building helper, adapt the property names accordingly, keeping the assertions):

```ts
  it('create() defaults customerId to null when not provided, and stores it when provided', () => {
    const withoutCustomer = Appointment.create({
      tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: '2025-03-10',
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
    });
    expect(withoutCustomer.customerId).toBeNull();

    const withCustomer = Appointment.create({
      tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: '2025-03-10',
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      customerId: 'user-1',
    });
    expect(withCustomer.customerId).toBe('user-1');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/scheduling/domain/entities/appointment.entity.spec.ts`
Expected: FAIL — `customerId` property doesn't exist on `Appointment`.

- [ ] **Step 3: Add `customerId` to the entity**

In `appointment.entity.ts`, add `customerId` to both prop interfaces and the class:

```ts
export interface AppointmentProps {
  id: string;
  tenantId: string;
  barberId: string;
  serviceId: string;
  customerId: string | null;
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
  customerId?: string | null;
  clientName: string;
  clientPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes?: string | null;
}
```

Add the field to the class (readonly, alongside `serviceId`):

```ts
  readonly serviceId: string;
  readonly customerId: string | null;
```

Set it in the constructor (alongside `this.serviceId = props.serviceId;`):

```ts
    this.serviceId = props.serviceId;
    this.customerId = props.customerId;
```

Set it in `create()` (alongside `serviceId: props.serviceId,`):

```ts
      serviceId: props.serviceId,
      customerId: props.customerId ?? null,
```

`reconstitute()` needs no change — it already passes through all of `AppointmentProps`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/scheduling/domain/entities/appointment.entity.spec.ts`
Expected: PASS

- [ ] **Step 5: Update the repository port and Drizzle adapter**

In `scheduling.repository.ts`, add a filter option and a lookup method:

```ts
export interface ListAppointmentsFilter {
  date?: string;
  barberId?: string;
  status?: AppointmentStatus;
  customerId?: string;
}

export interface ISchedulingRepository {
  findById(id: string, tenantId: string): Promise<Appointment | null>;
  findAll(tenantId: string, filter: ListAppointmentsFilter): Promise<Appointment[]>;
  findByBarberAndDate(barberId: string, date: string, tenantId: string): Promise<Appointment[]>;
  save(appointment: Appointment): Promise<Appointment>;
}
```

(`customerId` reuses the existing `findAll(tenantId, filter)` shape — no new repository method needed.)

In `scheduling-drizzle.repository.ts`:

1. Add `customerId` handling to `findAll`'s conditions:

```ts
  async findAll(tenantId: string, filter: ListAppointmentsFilter): Promise<Appointment[]> {
    const conditions = [eq(schema.appointments.tenantId, tenantId)];
    if (filter.date)       conditions.push(eq(schema.appointments.date,       filter.date));
    if (filter.barberId)   conditions.push(eq(schema.appointments.barberId,   filter.barberId));
    if (filter.status)     conditions.push(eq(schema.appointments.status,    filter.status));
    if (filter.customerId) conditions.push(eq(schema.appointments.customerId, filter.customerId));
    const rows = await this.db
      .select()
      .from(schema.appointments)
      .where(and(...conditions));
    return rows.map((r) => this.toEntity(r));
  }
```

2. Add `customerId` to `save()`'s insert values and to `toEntity()`:

In the `.values({...})` block of `save()`, add after `serviceId: appointment.serviceId,`:

```ts
        customerId:      appointment.customerId,
```

In `toEntity()`, add after `serviceId: row.serviceId,`:

```ts
      customerId:      row.customerId,
```

- [ ] **Step 6: Run the full scheduling suite**

Run: `npx jest apps/api/src/modules/scheduling`
Expected: PASS (existing `book-appointment`/`get-available-slots`/etc. specs don't pass `customerId` — confirm they still pass since it's optional everywhere it's constructed).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/scheduling/domain/entities/appointment.entity.ts apps/api/src/modules/scheduling/domain/entities/appointment.entity.spec.ts apps/api/src/modules/scheduling/domain/repositories/scheduling.repository.ts apps/api/src/modules/scheduling/infra/repositories/scheduling-drizzle.repository.ts
git commit -m "feat(scheduling): thread customerId through entity and repository"
```

---

## Task 3: `POST /appointments` requires login, sets `customerId`

**Files:**
- Modify: `apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.ts`
- Modify: `apps/api/src/modules/scheduling/http/scheduling.controller.ts`
- Test: `apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `book-appointment.use-case.spec.ts`:

```ts
  it('stores customerId on the created appointment when provided', async () => {
    const repo = makeRepo();
    const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup(), MOCK_EMITTER);
    const result = await uc.execute({ ...INPUT, customerId: 'user-1' });
    expect(result.customerId).toBe('user-1');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts`
Expected: FAIL — `Appointment.create` in `BookAppointmentUseCase.execute` doesn't pass `customerId` through yet.

- [ ] **Step 3: Pass `customerId` through in the use case**

In `book-appointment.use-case.ts`, add `customerId: input.customerId ?? null,` to the `Appointment.create({...})` call (after `serviceId: input.serviceId,`):

```ts
    const appointment = Appointment.create({
      tenantId: input.tenantId,
      barberId: assignedBarberId,
      serviceId: input.serviceId,
      customerId: input.customerId ?? null,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      date: input.date,
      startTime: input.startTime,
      endTime,
      durationMinutes: service.durationMinutes,
      notes: input.notes ?? null,
    });
```

(`BookAppointmentInput.customerId?: string | null` already exists from the previous plan's Task 4 — confirm it's there; if this plan is applied standalone, add it to the interface.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts`
Expected: PASS

- [ ] **Step 5: Require login on the controller and pass the JWT's userId as customerId**

In `scheduling.controller.ts`:

1. Remove `@Public()` from the `book` handler and add `@Roles('CLIENT')`.
2. Add `@CurrentUser() user: JwtPayload` as a parameter and pass `customerId: user.userId` through. Since the endpoint is no longer `@Public()`, it also no longer needs a manual `x-tenant-id` header check — the JWT already carries `tenantId`.

Replace the `book` handler:

```ts
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
```

Add `customerId` to `serializeAppointment`:

```ts
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
```

- [ ] **Step 6: Run the full scheduling suite + typecheck**

Run: `npx jest apps/api/src/modules/scheduling`
Expected: PASS

Run: `cd apps/api && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.ts apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts apps/api/src/modules/scheduling/http/scheduling.controller.ts
git commit -m "feat(scheduling): require CLIENT login to book, link appointment to customerId"
```

---

## Task 4: `ListMyAppointmentsUseCase` + `GET /appointments/my`

**Files:**
- Create: `apps/api/src/modules/scheduling/application/use-cases/list-my-appointments.use-case.ts`
- Test: `apps/api/src/modules/scheduling/application/use-cases/list-my-appointments.use-case.spec.ts`
- Modify: `apps/api/src/modules/scheduling/http/scheduling.controller.ts`
- Modify: `apps/api/src/modules/scheduling/scheduling.module.ts`

- [ ] **Step 1: Write the failing test**

Create `list-my-appointments.use-case.spec.ts`:

```ts
import { ListMyAppointmentsUseCase } from './list-my-appointments.use-case';
import { ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';

function makeAppt(overrides: Partial<Parameters<typeof Appointment.reconstitute>[0]> = {}) {
  return Appointment.reconstitute({
    id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
    customerId: 'user-1', clientName: 'Ana', clientPhone: '+55', date: '2025-03-10',
    startTime: '09:00', endTime: '09:30', durationMinutes: 30,
    status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  });
}

describe('ListMyAppointmentsUseCase', () => {
  it('delegates to repo.findAll filtering by tenantId and customerId', async () => {
    const appt = makeAppt();
    const repo: ISchedulingRepository = {
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([appt]),
      findByBarberAndDate: jest.fn(),
      save: jest.fn(),
    };
    const uc = new ListMyAppointmentsUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', customerId: 'user-1' });
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', { customerId: 'user-1' });
    expect(result).toEqual([appt]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/list-my-appointments.use-case.spec.ts`
Expected: FAIL — file doesn't exist yet.

- [ ] **Step 3: Implement**

Create `list-my-appointments.use-case.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';

export interface ListMyAppointmentsInput {
  tenantId: string;
  customerId: string;
}

@Injectable()
export class ListMyAppointmentsUseCase {
  constructor(@Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository) {}

  async execute(input: ListMyAppointmentsInput): Promise<Appointment[]> {
    const appointments = await this.repo.findAll(input.tenantId, { customerId: input.customerId });
    return appointments.sort((a, b) => {
      const aKey = `${a.date}T${a.startTime}`;
      const bKey = `${b.date}T${b.startTime}`;
      return bKey.localeCompare(aKey);
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/list-my-appointments.use-case.spec.ts`
Expected: PASS

- [ ] **Step 5: Wire into the module**

In `scheduling.module.ts`, add `ListMyAppointmentsUseCase` to the `providers` array (find the existing entry for `ListAppointmentsUseCase` and add it right after).

- [ ] **Step 6: Add the controller route**

In `scheduling.controller.ts`, add `ListMyAppointmentsUseCase` to the constructor injection list (after `listAppointments`):

```ts
    private readonly listAppointments:      ListAppointmentsUseCase,
    private readonly listMyAppointments:    ListMyAppointmentsUseCase,
```

Add the import:

```ts
import { ListMyAppointmentsUseCase } from '../application/use-cases/list-my-appointments.use-case';
```

Add the route handler (place it before the ADMIN-only `@Get()` route — NestJS matches static-before-parametric within the same method, but `/appointments/my` vs `/appointments` are both static-ish; place `my` route ahead of `:id` to avoid `my` being captured as an `:id` param):

```ts
  @Roles('CLIENT')
  @Get('my')
  async myAppointments(@CurrentUser() user: JwtPayload) {
    const appts = await this.listMyAppointments.execute({ tenantId: user.tenantId, customerId: user.userId });
    return appts.map(serializeAppointment);
  }
```

Place this handler directly after the `availableSlots` handler and before `book`, so `GET /appointments/my` is registered before the parametric `GET /appointments/:id` route.

- [ ] **Step 7: Run the full scheduling suite + typecheck**

Run: `npx jest apps/api/src/modules/scheduling`
Expected: PASS

Run: `cd apps/api && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/scheduling/application/use-cases/list-my-appointments.use-case.ts apps/api/src/modules/scheduling/application/use-cases/list-my-appointments.use-case.spec.ts apps/api/src/modules/scheduling/http/scheduling.controller.ts apps/api/src/modules/scheduling/scheduling.module.ts
git commit -m "feat(scheduling): add GET /appointments/my for the logged-in customer"
```

---

## Task 5: Customer can cancel their own upcoming appointment

**Files:**
- Modify: `apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.ts`
- Modify: `apps/api/src/modules/scheduling/domain/errors/scheduling.errors.ts`
- Modify: `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`
- Modify: `apps/api/src/modules/scheduling/http/scheduling.controller.ts`
- Test: `apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.spec.ts`

- [ ] **Step 1: Add `ForbiddenCancellationError`**

In `scheduling.errors.ts`, add:

```ts
export class ForbiddenCancellationError extends DomainError {
  readonly code = 'FORBIDDEN_CANCELLATION';
  constructor(message = 'Você não pode cancelar este agendamento.') { super(message); }
}
```

In `domain-exception.filter.ts`, add to `ERROR_CODE_TO_STATUS`:

```ts
  FORBIDDEN_CANCELLATION: HttpStatus.FORBIDDEN,
```

- [ ] **Step 2: Write the failing tests**

Check `cancel-appointment.use-case.spec.ts` first for its existing structure/helpers, then add these tests (adapt fixture-building to match what's already there, following the pattern from `appointment.entity.spec.ts`'s `Appointment.reconstitute` calls used elsewhere in this module):

```ts
  it('allows the owning customer to cancel their own future PENDING appointment', async () => {
    const future = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2999-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(future), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn().mockImplementation(async (a) => a) };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'user-1', role: 'CLIENT' } });
    expect(result.status).toBe('CANCELLED');
  });

  it('throws ForbiddenCancellationError when a different customer tries to cancel', async () => {
    const future = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2999-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(future), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn() };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    await expect(
      uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'user-2', role: 'CLIENT' } }),
    ).rejects.toBeInstanceOf(ForbiddenCancellationError);
  });

  it('throws ForbiddenCancellationError when the customer tries to cancel a past appointment', async () => {
    const past = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2000-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(past), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn() };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    await expect(
      uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'user-1', role: 'CLIENT' } }),
    ).rejects.toBeInstanceOf(ForbiddenCancellationError);
  });

  it('allows ADMIN to cancel regardless of ownership', async () => {
    const future = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      customerId: 'user-1', clientName: 'Ana', clientPhone: '+55',
      date: '2999-01-01', startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'PENDING', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = { findById: jest.fn().mockResolvedValue(future), findAll: jest.fn(), findByBarberAndDate: jest.fn(), save: jest.fn().mockImplementation(async (a) => a) };
    const uc = new CancelAppointmentUseCase(repo as any, MOCK_EMITTER);
    const result = await uc.execute({ id: 'appt-1', tenantId: 'tenant-1', requestedBy: { userId: 'admin-1', role: 'ADMIN' } });
    expect(result.status).toBe('CANCELLED');
  });
```

Add the `MOCK_EMITTER` constant and imports at the top of the file if not already present:

```ts
import { ForbiddenCancellationError } from '../../domain/errors/scheduling.errors';

const MOCK_EMITTER: any = { emit: jest.fn() };
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.spec.ts`
Expected: FAIL — `execute` currently takes `{ id, tenantId }` only (no `requestedBy`), and admin-only tests calling the old shape may also break compilation; this is expected until Step 4.

- [ ] **Step 4: Implement ownership + time-window check**

Replace the full contents of `cancel-appointment.use-case.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { Appointment } from '../../domain/entities/appointment.entity';
import {
  AppointmentNotFoundError,
  InvalidStatusTransitionError,
  ForbiddenCancellationError,
} from '../../domain/errors/scheduling.errors';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { Role } from '@shared/auth/roles.decorator';

export interface CancelAppointmentInput {
  id: string;
  tenantId: string;
  requestedBy: { userId: string; role: Role };
}

@Injectable()
export class CancelAppointmentUseCase {
  constructor(
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository,
    @Inject(EventEmitter2)         private readonly emitter: EventEmitter2,
  ) {}

  async execute(input: CancelAppointmentInput): Promise<Appointment> {
    const appt = await this.repo.findById(input.id, input.tenantId);
    if (!appt) throw new AppointmentNotFoundError();

    if (input.requestedBy.role !== 'ADMIN') {
      if (appt.customerId !== input.requestedBy.userId) {
        throw new ForbiddenCancellationError();
      }
      const startsAt = new Date(`${appt.date}T${appt.startTime}:00`);
      if (startsAt.getTime() <= Date.now()) {
        throw new ForbiddenCancellationError('Não é possível cancelar um agendamento que já começou.');
      }
    }

    try {
      appt.cancel();
    } catch {
      throw new InvalidStatusTransitionError();
    }
    const saved = await this.repo.save(appt);
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
    this.emitter.emit(APPOINTMENT_EVENTS.CANCELLED, payload);
    return saved;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.spec.ts`
Expected: PASS

- [ ] **Step 6: Update the controller — allow CLIENT role too, pass `requestedBy`**

In `scheduling.controller.ts`, change the `cancel` handler's role decorator and body:

```ts
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
```

- [ ] **Step 7: Run the full scheduling suite + typecheck**

Run: `npx jest apps/api/src/modules/scheduling`
Expected: PASS

Run: `cd apps/api && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.ts apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.spec.ts apps/api/src/modules/scheduling/domain/errors/scheduling.errors.ts apps/api/src/shared/kernel/errors/domain-exception.filter.ts apps/api/src/modules/scheduling/http/scheduling.controller.ts
git commit -m "feat(scheduling): let a customer cancel their own future appointment"
```

---

## Task 6: Manual smoke check

- [ ] **Step 1: Run the full backend test suite**

Run: `cd apps/api && npm test`
Expected: PASS, no regressions in other modules.

- [ ] **Step 2: Note results**

Report the actual test output — don't claim success unless the run was observed green.
