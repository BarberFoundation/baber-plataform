# Scheduling Auto-Assign Barbeiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Do NOT add `Co-Authored-By` trailers to any commit message.

**Goal:** Make `barberId` optional in `GET /appointments/available-slots` and `POST /appointments` — when absent, the backend aggregates slots across all active barbers of the tenant and auto-assigns the first available one at booking time.

**Architecture:** Extend `IBarberLookup` with a `listActiveByTenant` method. `GetAvailableSlotsUseCase` gains a private per-barber slot calculator reused for both single-barber and multi-barber (union) modes. `BookAppointmentUseCase` gains a candidate-iteration path when `barberId` is absent, reusing `BookingPolicy` per candidate; a new `NoBarberAvailableError` covers the case where nobody is free.

**Tech Stack:** NestJS 11, TypeScript strict, Drizzle ORM + postgres-js, class-validator, Jest.

**Repo:** `C:\Users\gabry\Documents\baber` (`apps/api`).

**Design ref:** `docs/superpowers/specs/2026-07-07-mobile-app-full-design.md` §1.

---

## Task 1: `IBarberLookup.listActiveByTenant`

**Files:**
- Modify: `apps/api/src/modules/scheduling/domain/ports/barber-lookup.port.ts`
- Modify: `apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.ts`
- Test: `apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.spec.ts`:

```ts
import { BarberLookupAdapter } from './barber-lookup.adapter';

function makeDb(rows: any[]) {
  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(rows),
  } as any;
}

describe('BarberLookupAdapter.listActiveByTenant', () => {
  it('returns id, isActive and workSchedule for each row', async () => {
    const rows = [
      { id: 'b1', isActive: true, workSchedule: {} },
      { id: 'b2', isActive: true, workSchedule: {} },
    ];
    const adapter = new BarberLookupAdapter(makeDb(rows));
    const result = await adapter.listActiveByTenant('tenant-1');
    expect(result).toEqual([
      { id: 'b1', isActive: true, workSchedule: {} },
      { id: 'b2', isActive: true, workSchedule: {} },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.spec.ts`
Expected: FAIL with "listActiveByTenant is not a function" (or DB mock method mismatch since it doesn't exist yet).

- [ ] **Step 3: Add the method to the port**

In `apps/api/src/modules/scheduling/domain/ports/barber-lookup.port.ts`, replace the full contents:

```ts
import { WorkSchedule } from '../../../team/domain/value-objects/work-schedule';

export const BARBER_LOOKUP = Symbol('IBarberLookup');

export interface BarberLookupResult {
  isActive: boolean;
  workSchedule: WorkSchedule;
}

export interface ActiveBarber {
  id: string;
  isActive: boolean;
  workSchedule: WorkSchedule;
}

export interface IBarberLookup {
  findById(id: string, tenantId: string): Promise<BarberLookupResult | null>;
  listActiveByTenant(tenantId: string): Promise<ActiveBarber[]>;
}
```

- [ ] **Step 4: Implement in the Drizzle adapter**

In `apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.ts`, add after `findById`:

```ts
  async listActiveByTenant(tenantId: string): Promise<ActiveBarber[]> {
    const rows = await this.db
      .select({ id: schema.barbers.id, isActive: schema.barbers.isActive, workSchedule: schema.barbers.workSchedule })
      .from(schema.barbers)
      .where(and(eq(schema.barbers.tenantId, tenantId), eq(schema.barbers.isActive, true)));
    return rows.map((r) => ({
      id: r.id,
      isActive: r.isActive,
      workSchedule: r.workSchedule as WorkSchedule,
    }));
  }
```

Update the import line to include `ActiveBarber`:

```ts
import { IBarberLookup, BarberLookupResult, ActiveBarber } from '../../domain/ports/barber-lookup.port';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/scheduling/domain/ports/barber-lookup.port.ts apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.ts apps/api/src/modules/scheduling/infra/adapters/barber-lookup.adapter.spec.ts
git commit -m "feat(scheduling): add IBarberLookup.listActiveByTenant"
```

---

## Task 2: `GetAvailableSlotsUseCase` supports optional `barberId` (aggregated slots)

**Files:**
- Modify: `apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.ts`
- Test: `apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `get-available-slots.use-case.spec.ts`, inside the existing `describe` block, after the last test. Also update the top imports/helpers as shown (the test file needs a `listActiveByTenant` mock added to `makeBarberLookup`):

Replace the `makeBarberLookup` helper:

```ts
function makeBarberLookup(result = ACTIVE_BARBER, activeList: any[] = [{ id: 'barber-1', ...ACTIVE_BARBER }]): IBarberLookup {
  return {
    findById: jest.fn().mockResolvedValue(result),
    listActiveByTenant: jest.fn().mockResolvedValue(activeList),
  };
}
```

Add these tests at the end of the `describe` block:

```ts
  it('aggregates slots across all active barbers when barberId is omitted', async () => {
    const barberA = { id: 'barber-a', isActive: true, workSchedule: defaultWorkSchedule() };
    const barberB = { id: 'barber-b', isActive: true, workSchedule: defaultWorkSchedule() };
    const busyA = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-a', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo: ISchedulingRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      findByBarberAndDate: jest.fn().mockImplementation(async (barberId: string) =>
        barberId === 'barber-a' ? [busyA] : [],
      ),
      save: jest.fn(),
    };
    const uc = new GetAvailableSlotsUseCase(
      repo,
      makeBarberLookup(ACTIVE_BARBER, [barberA, barberB]),
      makeServiceLookup(30),
    );
    const { barberId, ...rest } = INPUT;
    const slots = await uc.execute(rest);
    expect(slots.some((s) => s.startTime === '09:00')).toBe(true);
  });

  it('returns empty array when no active barbers exist and barberId is omitted', async () => {
    const repo = makeRepo();
    const uc = new GetAvailableSlotsUseCase(repo, makeBarberLookup(ACTIVE_BARBER, []), makeServiceLookup(30));
    const { barberId, ...rest } = INPUT;
    const slots = await uc.execute(rest);
    expect(slots).toEqual([]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.spec.ts`
Expected: FAIL — `barberId` currently required by `GetAvailableSlotsInput`, and the aggregation behavior doesn't exist.

- [ ] **Step 3: Implement**

Replace the full contents of `get-available-slots.use-case.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { BARBER_LOOKUP, IBarberLookup, ActiveBarber } from '../../domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP, IServiceLookup } from '../../domain/ports/service-lookup.port';
import { TimeSlot } from '../../domain/value-objects/time-slot';
import { dayOfWeekFromDate, timeToMinutes, minutesToTime, timesOverlap } from '../../domain/utils/time.utils';

const SLOT_STEP_MINUTES = 30;

export interface GetAvailableSlotsInput {
  tenantId: string;
  barberId?: string;
  serviceId: string;
  date: string;
}

@Injectable()
export class GetAvailableSlotsUseCase {
  constructor(
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: ISchedulingRepository,
    @Inject(BARBER_LOOKUP)         private readonly barberLookup: IBarberLookup,
    @Inject(SERVICE_LOOKUP)        private readonly serviceLookup: IServiceLookup,
  ) {}

  async execute(input: GetAvailableSlotsInput): Promise<TimeSlot[]> {
    const service = await this.serviceLookup.findById(input.serviceId, input.tenantId);
    if (!service) return [];

    if (input.barberId) {
      const barber = await this.barberLookup.findById(input.barberId, input.tenantId);
      if (!barber) return [];
      return this.slotsForBarber(input.barberId, barber, input.date, service.durationMinutes, input.tenantId);
    }

    const activeBarbers = await this.barberLookup.listActiveByTenant(input.tenantId);
    if (activeBarbers.length === 0) return [];

    const perBarberSlots = await Promise.all(
      activeBarbers.map((b) => this.slotsForBarber(b.id, b, input.date, service.durationMinutes, input.tenantId)),
    );

    const merged = new Map<string, TimeSlot>();
    for (const slots of perBarberSlots) {
      for (const s of slots) merged.set(s.startTime, s);
    }
    return Array.from(merged.values()).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }

  private async slotsForBarber(
    barberId: string,
    barber: ActiveBarber | { isActive: boolean; workSchedule: ActiveBarber['workSchedule'] },
    date: string,
    duration: number,
    tenantId: string,
  ): Promise<TimeSlot[]> {
    const dow = dayOfWeekFromDate(date);
    const daySchedule = barber.workSchedule[dow];
    if (!daySchedule.isWorking || !daySchedule.startTime || !daySchedule.endTime) return [];

    const workStart = timeToMinutes(daySchedule.startTime);
    const workEnd   = timeToMinutes(daySchedule.endTime);

    const existing = await this.repo.findByBarberAndDate(barberId, date, tenantId);
    const active = existing
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

Note: the existing single-barber tests in the spec file construct `INPUT` with `barberId: 'barber-1'` — those keep passing unchanged since `barberId` is now optional but still accepted.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.spec.ts`
Expected: PASS (all 7 tests: 5 original + 2 new)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.ts apps/api/src/modules/scheduling/application/use-cases/get-available-slots.use-case.spec.ts
git commit -m "feat(scheduling): aggregate available slots across barbers when barberId omitted"
```

---

## Task 3: `NoBarberAvailableError`

**Files:**
- Modify: `apps/api/src/modules/scheduling/domain/errors/scheduling.errors.ts`
- Modify: `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`

- [ ] **Step 1: Add the error class**

In `scheduling.errors.ts`, add after `InvalidStatusTransitionError`:

```ts
export class NoBarberAvailableError extends DomainError {
  readonly code = 'NO_BARBER_AVAILABLE';
  constructor(message = 'Nenhum barbeiro disponível neste horário.') { super(message); }
}
```

- [ ] **Step 2: Map it to HTTP 409**

In `domain-exception.filter.ts`, add to `ERROR_CODE_TO_STATUS`:

```ts
  NO_BARBER_AVAILABLE: HttpStatus.CONFLICT,
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/scheduling/domain/errors/scheduling.errors.ts apps/api/src/shared/kernel/errors/domain-exception.filter.ts
git commit -m "feat(scheduling): add NoBarberAvailableError mapped to 409"
```

---

## Task 4: `BookAppointmentUseCase` auto-assigns when `barberId` omitted

**Files:**
- Modify: `apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.ts`
- Test: `apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to `book-appointment.use-case.spec.ts`. First replace `makeBarberLookup` to also stub `listActiveByTenant`:

```ts
function makeBarberLookup(result = ACTIVE_BARBER, activeList: any[] = [{ id: 'barber-1', ...ACTIVE_BARBER }]): IBarberLookup {
  return {
    findById: jest.fn().mockResolvedValue(result),
    listActiveByTenant: jest.fn().mockResolvedValue(activeList),
  };
}
```

Then add these tests at the end of the `describe` block:

```ts
  it('auto-assigns the first available active barber when barberId is omitted', async () => {
    const repo = makeRepo();
    const barberLookup = makeBarberLookup(ACTIVE_BARBER, [
      { id: 'barber-1', ...ACTIVE_BARBER },
      { id: 'barber-2', ...ACTIVE_BARBER },
    ]);
    const uc = new BookAppointmentUseCase(repo, barberLookup, makeServiceLookup(), MOCK_EMITTER);
    const { barberId, ...rest } = INPUT;
    const result = await uc.execute(rest);
    expect(result.barberId).toBe('barber-1');
  });

  it('skips a busy barber and assigns the next available one', async () => {
    const busyOnBarber1 = Appointment.reconstitute({
      id: 'appt-1', tenantId: 'tenant-1', barberId: 'barber-1', serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = makeRepo({
      findByBarberAndDate: jest.fn().mockImplementation(async (barberId: string) =>
        barberId === 'barber-1' ? [busyOnBarber1] : [],
      ),
    });
    const barberLookup = makeBarberLookup(ACTIVE_BARBER, [
      { id: 'barber-1', ...ACTIVE_BARBER },
      { id: 'barber-2', ...ACTIVE_BARBER },
    ]);
    const uc = new BookAppointmentUseCase(repo, barberLookup, makeServiceLookup(), MOCK_EMITTER);
    const { barberId, ...rest } = INPUT;
    const result = await uc.execute(rest);
    expect(result.barberId).toBe('barber-2');
  });

  it('throws NoBarberAvailableError when every active barber is busy', async () => {
    const busy = (bId: string) => Appointment.reconstitute({
      id: `appt-${bId}`, tenantId: 'tenant-1', barberId: bId, serviceId: 'service-1',
      clientName: 'Ana', clientPhone: '+55', date: MONDAY,
      startTime: '09:00', endTime: '09:30', durationMinutes: 30,
      status: 'CONFIRMED', notes: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const repo = makeRepo({
      findByBarberAndDate: jest.fn().mockImplementation(async (barberId: string) => [busy(barberId)]),
    });
    const barberLookup = makeBarberLookup(ACTIVE_BARBER, [
      { id: 'barber-1', ...ACTIVE_BARBER },
      { id: 'barber-2', ...ACTIVE_BARBER },
    ]);
    const uc = new BookAppointmentUseCase(repo, barberLookup, makeServiceLookup(), MOCK_EMITTER);
    const { barberId, ...rest } = INPUT;
    await expect(uc.execute(rest)).rejects.toBeInstanceOf(NoBarberAvailableError);
  });

  it('throws NoBarberAvailableError when there are no active barbers', async () => {
    const repo = makeRepo();
    const barberLookup = makeBarberLookup(ACTIVE_BARBER, []);
    const uc = new BookAppointmentUseCase(repo, barberLookup, makeServiceLookup(), MOCK_EMITTER);
    const { barberId, ...rest } = INPUT;
    await expect(uc.execute(rest)).rejects.toBeInstanceOf(NoBarberAvailableError);
  });
```

Update the top import line to include `NoBarberAvailableError`:

```ts
import { AppointmentConflictError, InvalidAppointmentTimeError, NoBarberAvailableError } from '../../domain/errors/scheduling.errors';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts`
Expected: FAIL — `barberId` currently required in `BookAppointmentInput`; no auto-assign logic exists.

- [ ] **Step 3: Implement**

Replace the full contents of `book-appointment.use-case.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { SCHEDULING_REPOSITORY, ISchedulingRepository } from '../../domain/repositories/scheduling.repository';
import { BARBER_LOOKUP, IBarberLookup, ActiveBarber } from '../../domain/ports/barber-lookup.port';
import { SERVICE_LOOKUP, IServiceLookup } from '../../domain/ports/service-lookup.port';
import { Appointment } from '../../domain/entities/appointment.entity';
import { BookingPolicy } from '../../domain/services/booking-policy';
import { InvalidAppointmentTimeError, NoBarberAvailableError } from '../../domain/errors/scheduling.errors';
import { addMinutes } from '../../domain/utils/time.utils';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';

export interface BookAppointmentInput {
  tenantId: string;
  barberId?: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  date: string;
  startTime: string;
  notes?: string | null;
  customerId?: string | null;
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
    const service = await this.serviceLookup.findById(input.serviceId, input.tenantId);
    if (!service) throw new InvalidAppointmentTimeError('Serviço não encontrado.');

    const endTime = addMinutes(input.startTime, service.durationMinutes);

    const assignedBarberId = input.barberId
      ? await this.assignSpecificBarber(input.barberId, input.tenantId, input.date, input.startTime, endTime)
      : await this.assignFirstAvailableBarber(input.tenantId, input.date, input.startTime, endTime);

    const appointment = Appointment.create({
      tenantId: input.tenantId,
      barberId: assignedBarberId,
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

  private async assignSpecificBarber(
    barberId: string,
    tenantId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<string> {
    const barber = await this.barberLookup.findById(barberId, tenantId);
    if (!barber) throw new InvalidAppointmentTimeError('Barbeiro não encontrado.');

    const existing = await this.repo.findByBarberAndDate(barberId, date, tenantId);
    this.policy.validate({
      barber,
      date,
      startTime,
      endTime,
      existing: existing.map((a) => ({ startTime: a.startTime, endTime: a.endTime, status: a.status })),
    });
    return barberId;
  }

  private async assignFirstAvailableBarber(
    tenantId: string,
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<string> {
    const candidates = await this.barberLookup.listActiveByTenant(tenantId);
    for (const candidate of candidates) {
      const existing = await this.repo.findByBarberAndDate(candidate.id, date, tenantId);
      try {
        this.policy.validate({
          barber: candidate,
          date,
          startTime,
          endTime,
          existing: existing.map((a) => ({ startTime: a.startTime, endTime: a.endTime, status: a.status })),
        });
        return candidate.id;
      } catch {
        continue;
      }
    }
    throw new NoBarberAvailableError();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts`
Expected: PASS (all 8 tests: 4 original + 4 new)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.ts apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.spec.ts
git commit -m "feat(scheduling): auto-assign first available barber when barberId omitted"
```

---

## Task 5: Controller — make `barberId` optional on both endpoints

**Files:**
- Modify: `apps/api/src/modules/scheduling/http/scheduling.controller.ts`
- Test: `apps/api/src/modules/scheduling/http/scheduling.controller.spec.ts` (check if it exists first; create if not)

- [ ] **Step 1: Check for an existing controller spec**

Run: `ls apps/api/src/modules/scheduling/http/scheduling.controller.spec.ts 2>/dev/null || echo "no existing spec"`

If it doesn't exist, skip straight to Step 3 (this plan relies on the use-case unit tests from Tasks 2 and 4 for behavior coverage; the controller change here is a thin wiring change with no new branching logic, consistent with how `book`/`availableSlots` handlers are already untested at the controller level in this codebase).

- [ ] **Step 2: N/A**

(No controller-level test file exists in this codebase for scheduling; skip.)

- [ ] **Step 3: Update `BookAppointmentDto` and the two handlers**

In `scheduling.controller.ts`, change `barberId` in `BookAppointmentDto` to optional:

```ts
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
```

Update the `availableSlots` handler to no longer require `barberId`:

```ts
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
```

Update the `book` handler to pass `barberId` through as optional:

```ts
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
```

- [ ] **Step 4: Full scheduling test suite + build check**

Run: `npx jest apps/api/src/modules/scheduling`
Expected: PASS, all suites green.

Run: `cd apps/api && npx tsc --noEmit`
Expected: no type errors (confirms `BookAppointmentDto.barberId?` flows correctly into `BookAppointmentInput.barberId?`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/scheduling/http/scheduling.controller.ts
git commit -m "feat(scheduling): make barberId optional in book and available-slots endpoints"
```

---

## Task 6: Generate and apply the migration check (no schema change needed — verify)

**Files:** none (verification-only task)

This plan does **not** change the `appointments.barber_id` column (it stays `NOT NULL` — auto-assign always resolves to a real barber before saving, so every row still has one). No migration is needed for this plan. The nullable `customer_id` column is handled in the next plan (`2026-07-07-scheduling-my-appointments.md`).

- [ ] **Step 1: Confirm no pending schema diff**

Run: `cd apps/api && npx drizzle-kit generate`
Expected: "No schema changes, nothing to migrate" (or equivalent — confirms Tasks 1–5 touched no Drizzle schema files).

---

## Task 7: Manual smoke check

- [ ] **Step 1: Run the full backend test suite**

Run: `cd apps/api && npm test`
Expected: PASS, no regressions in other modules.

- [ ] **Step 2: Note results**

Report the actual test output — don't claim success unless the run was observed green.
