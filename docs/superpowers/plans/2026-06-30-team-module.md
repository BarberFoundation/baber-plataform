# Team Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Team bounded context — CRUD for barber profiles, weekly work schedules, and deactivation with tenant isolation.

**Architecture:** DDD Clean Architecture following the Catalog module patterns. `Barber` aggregate root with `WorkSchedule` value object (stored as JSONB). Repository interface as port, use cases in application layer, Drizzle infra adapter, NestJS HTTP controller. No FK to the `users` table — barbers are standalone profiles for MVP (scheduling only needs names/availability, not login).

**Tech Stack:** NestJS 11, TypeScript strict, Drizzle ORM + postgres-js, class-validator, Jest (TDD for use cases), pnpm.

---

## Task Index

| # | Task | Layer |
|---|------|-------|
| T1 | Domain entity `Barber` + `WorkSchedule` value object | Domain |
| T2 | Team domain errors + update `DomainExceptionFilter` | Domain / Shared |
| T3 | Repository interface `ITeamRepository` | Domain |
| T4 | DB schema `barbers` table | Infra |
| T5 | TDD — `AddBarber` use case | Application |
| T6 | TDD — `UpdateBarber` use case | Application |
| T7 | TDD — `SetWorkSchedule` use case | Application |
| T8 | TDD — `GetBarber` use case | Application |
| T9 | TDD — `ListBarbers` use case | Application |
| T10 | TDD — `DeactivateBarber` use case | Application |
| T11 | Drizzle repository `TeamDrizzleRepository` | Infra |
| T12 | HTTP controller `TeamController` | HTTP |
| T13 | Wire `TeamModule` | Module |

---

## Task T1 — Domain entity `Barber` + `WorkSchedule` value object

**Files to create:**
- `apps/api/src/modules/team/domain/value-objects/work-schedule.ts`
- `apps/api/src/modules/team/domain/entities/barber.entity.ts`
- `apps/api/src/modules/team/domain/entities/barber.entity.spec.ts`

### Step-by-step

- [ ] Create the `WorkSchedule` value object:

```typescript
// apps/api/src/modules/team/domain/value-objects/work-schedule.ts
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DaySchedule {
  isWorking: boolean;
  startTime: string | null; // "HH:mm", null when isWorking=false
  endTime: string | null;   // "HH:mm", null when isWorking=false
}

export type WorkSchedule = Record<DayOfWeek, DaySchedule>;

export const DAYS_OF_WEEK: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function defaultWorkSchedule(): WorkSchedule {
  return {
    mon: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    tue: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    wed: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    thu: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    fri: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    sat: { isWorking: true,  startTime: '09:00', endTime: '13:00' },
    sun: { isWorking: false, startTime: null,     endTime: null     },
  };
}
```

- [ ] Create the `Barber` entity:

```typescript
// apps/api/src/modules/team/domain/entities/barber.entity.ts
import { randomUUID } from 'crypto';
import { WorkSchedule, defaultWorkSchedule } from '../value-objects/work-schedule';

export interface BarberProps {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  workSchedule: WorkSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBarberProps {
  tenantId: string;
  name: string;
  phone?: string | null;
  workSchedule?: WorkSchedule;
}

export class Barber {
  readonly id: string;
  readonly tenantId: string;
  private _name: string;
  private _phone: string | null;
  private _isActive: boolean;
  private _workSchedule: WorkSchedule;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: BarberProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this._phone = props.phone;
    this._isActive = props.isActive;
    this._workSchedule = props.workSchedule;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string { return this._name; }
  get phone(): string | null { return this._phone; }
  get isActive(): boolean { return this._isActive; }
  get workSchedule(): WorkSchedule { return this._workSchedule; }
  get updatedAt(): Date { return this._updatedAt; }

  static create(props: CreateBarberProps): Barber {
    const now = new Date();
    return new Barber({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: props.name,
      phone: props.phone ?? null,
      isActive: true,
      workSchedule: props.workSchedule ?? defaultWorkSchedule(),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: BarberProps): Barber {
    return new Barber(props);
  }

  update(name: string, phone: string | null): void {
    this._name = name;
    this._phone = phone;
    this._updatedAt = new Date();
  }

  setWorkSchedule(schedule: WorkSchedule): void {
    this._workSchedule = schedule;
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._isActive = false;
    this._updatedAt = new Date();
  }
}
```

- [ ] Write the spec:

```typescript
// apps/api/src/modules/team/domain/entities/barber.entity.spec.ts
import { Barber } from './barber.entity';
import { defaultWorkSchedule } from '../value-objects/work-schedule';

const BASE = {
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: '+5511999999999',
};

describe('Barber entity', () => {
  describe('create()', () => {
    it('creates an active barber with generated id, default schedule, and timestamps', () => {
      const b = Barber.create(BASE);
      expect(b.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(b.tenantId).toBe('tenant-1');
      expect(b.name).toBe('João Barber');
      expect(b.phone).toBe('+5511999999999');
      expect(b.isActive).toBe(true);
      expect(b.workSchedule).toEqual(defaultWorkSchedule());
      expect(b.createdAt).toBeInstanceOf(Date);
      expect(b.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults phone to null when omitted', () => {
      const b = Barber.create({ tenantId: 'tenant-1', name: 'Ana' });
      expect(b.phone).toBeNull();
    });

    it('uses provided workSchedule when given', () => {
      const schedule = defaultWorkSchedule();
      schedule.sun = { isWorking: true, startTime: '10:00', endTime: '14:00' };
      const b = Barber.create({ ...BASE, workSchedule: schedule });
      expect(b.workSchedule.sun.isWorking).toBe(true);
    });
  });

  describe('reconstitute()', () => {
    it('restores all fields exactly', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      const b = Barber.reconstitute({
        id: 'fixed-id',
        tenantId: 'tenant-2',
        name: 'Pedro',
        phone: null,
        isActive: false,
        workSchedule: defaultWorkSchedule(),
        createdAt: now,
        updatedAt: now,
      });
      expect(b.id).toBe('fixed-id');
      expect(b.isActive).toBe(false);
      expect(b.phone).toBeNull();
    });
  });

  describe('update()', () => {
    it('mutates name and phone, bumps updatedAt', () => {
      const b = Barber.create(BASE);
      const before = b.updatedAt;
      b.update('João Silva', null);
      expect(b.name).toBe('João Silva');
      expect(b.phone).toBeNull();
      expect(b.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('setWorkSchedule()', () => {
    it('replaces work schedule and bumps updatedAt', () => {
      const b = Barber.create(BASE);
      const newSchedule = defaultWorkSchedule();
      newSchedule.mon = { isWorking: false, startTime: null, endTime: null };
      b.setWorkSchedule(newSchedule);
      expect(b.workSchedule.mon.isWorking).toBe(false);
    });
  });

  describe('deactivate()', () => {
    it('sets isActive to false and bumps updatedAt', () => {
      const b = Barber.create(BASE);
      b.deactivate();
      expect(b.isActive).toBe(false);
    });
  });
});
```

- [ ] Run tests:

```bash
pnpm --filter api test -- --testPathPattern="barber.entity.spec"
```

Expected: `Tests: 7 passed, 7 total`

- [ ] Commit: `feat(team): add Barber entity and WorkSchedule value object`

---

## Task T2 — Team domain errors + update `DomainExceptionFilter`

**Files to create:**
- `apps/api/src/modules/team/domain/errors/team.errors.ts`

**Files to modify:**
- `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`

### Step-by-step

- [ ] Create team errors:

```typescript
// apps/api/src/modules/team/domain/errors/team.errors.ts
import { DomainError } from '@shared/kernel/errors/domain-error';

export class BarberNotFoundError extends DomainError {
  readonly code = 'BARBER_NOT_FOUND';
  constructor(message = 'Barbeiro não encontrado.') {
    super(message);
  }
}
```

- [ ] Add `BARBER_NOT_FOUND` to the filter. Current `ERROR_CODE_TO_STATUS` in `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`:

```typescript
const ERROR_CODE_TO_STATUS: Record<string, HttpStatus> = {
  INVALID_FIREBASE_TOKEN: HttpStatus.UNAUTHORIZED,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  SERVICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  SERVICE_NAME_TAKEN: HttpStatus.CONFLICT,
};
```

Add one entry:

```typescript
const ERROR_CODE_TO_STATUS: Record<string, HttpStatus> = {
  INVALID_FIREBASE_TOKEN: HttpStatus.UNAUTHORIZED,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  SERVICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  SERVICE_NAME_TAKEN: HttpStatus.CONFLICT,
  BARBER_NOT_FOUND: HttpStatus.NOT_FOUND,
};
```

- [ ] Commit: `feat(team): add BarberNotFoundError; map BARBER_NOT_FOUND to 404`

---

## Task T3 — Repository interface `ITeamRepository`

**Files to create:**
- `apps/api/src/modules/team/domain/repositories/team.repository.ts`

### Step-by-step

- [ ] Create the interface:

```typescript
// apps/api/src/modules/team/domain/repositories/team.repository.ts
import { Barber } from '../entities/barber.entity';

export const TEAM_REPOSITORY = Symbol('ITeamRepository');

export interface ITeamRepository {
  findById(id: string, tenantId: string): Promise<Barber | null>;
  findAll(tenantId: string, includeInactive: boolean): Promise<Barber[]>;
  save(barber: Barber): Promise<Barber>;
}
```

- [ ] Commit: `feat(team): add ITeamRepository port with Symbol token`

---

## Task T4 — DB schema `barbers` table

**Files to create:**
- `apps/api/src/shared/database/schema/barbers.ts`

**Files to modify:**
- `apps/api/src/shared/database/schema/index.ts`

### Step-by-step

- [ ] Create the schema file:

```typescript
// apps/api/src/shared/database/schema/barbers.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { WorkSchedule } from '../../../modules/team/domain/value-objects/work-schedule';

export const barbers = pgTable('barbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: text('name').notNull(),
  phone: text('phone'),
  isActive: boolean('is_active').notNull().default(true),
  workSchedule: jsonb('work_schedule').notNull().$type<WorkSchedule>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BarberRow = typeof barbers.$inferSelect;
export type NewBarberRow = typeof barbers.$inferInsert;
```

- [ ] Add export to `apps/api/src/shared/database/schema/index.ts`:

```typescript
export * from './tenants';
export * from './users';
export * from './refresh-tokens';
export * from './services';
export * from './barbers';
```

- [ ] Generate and run migration:

```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
```

Expected: migration file created; applied without errors.

- [ ] Commit: `feat(team): add barbers table schema with JSONB work_schedule`

---

## Task T5 — TDD: `AddBarber` use case

**Files to create:**
- `apps/api/src/modules/team/application/use-cases/add-barber.use-case.ts`
- `apps/api/src/modules/team/application/use-cases/add-barber.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/team/application/use-cases/add-barber.use-case.spec.ts
import { AddBarberUseCase, AddBarberInput } from './add-barber.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';

function makeRepo(overrides?: Partial<ITeamRepository>): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
    ...overrides,
  };
}

const INPUT: AddBarberInput = {
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: '+5511999999999',
};

describe('AddBarberUseCase', () => {
  it('creates and saves a new active barber', async () => {
    const repo = makeRepo();
    const uc = new AddBarberUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.name).toBe('João Barber');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.phone).toBe('+5511999999999');
    expect(result.isActive).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(expect.any(Barber));
  });

  it('defaults phone to null when omitted', async () => {
    const repo = makeRepo();
    const uc = new AddBarberUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', name: 'Ana' });
    expect(result.phone).toBeNull();
  });

  it('assigns default work schedule when none provided', async () => {
    const repo = makeRepo();
    const uc = new AddBarberUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.workSchedule.mon.isWorking).toBe(true);
    expect(result.workSchedule.sun.isWorking).toBe(false);
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="add-barber.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/team/application/use-cases/add-barber.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { WorkSchedule } from '../../domain/value-objects/work-schedule';

export interface AddBarberInput {
  tenantId: string;
  name: string;
  phone?: string | null;
  workSchedule?: WorkSchedule;
}

@Injectable()
export class AddBarberUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: AddBarberInput): Promise<Barber> {
    const barber = Barber.create({
      tenantId: input.tenantId,
      name: input.name,
      phone: input.phone ?? null,
      workSchedule: input.workSchedule,
    });
    return this.repo.save(barber);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="add-barber.use-case.spec"`

Expected: `Tests: 3 passed, 3 total`

- [ ] Commit: `feat(team): AddBarber use case`

---

## Task T6 — TDD: `UpdateBarber` use case

**Files to create:**
- `apps/api/src/modules/team/application/use-cases/update-barber.use-case.ts`
- `apps/api/src/modules/team/application/use-cases/update-barber.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/team/application/use-cases/update-barber.use-case.spec.ts
import { UpdateBarberUseCase, UpdateBarberInput } from './update-barber.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';

const EXISTING = Barber.reconstitute({
  id: 'barber-1',
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: '+5511999999999',
  isActive: true,
  workSchedule: {
    mon: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    tue: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    wed: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    thu: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    fri: { isWorking: true,  startTime: '09:00', endTime: '18:00' },
    sat: { isWorking: true,  startTime: '09:00', endTime: '13:00' },
    sun: { isWorking: false, startTime: null,     endTime: null     },
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

function makeRepo(existing: Barber | null = EXISTING): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

const INPUT: UpdateBarberInput = {
  id: 'barber-1',
  tenantId: 'tenant-1',
  name: 'João Silva',
  phone: null,
};

describe('UpdateBarberUseCase', () => {
  it('updates name and phone then saves', async () => {
    const repo = makeRepo();
    const uc = new UpdateBarberUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.name).toBe('João Silva');
    expect(result.phone).toBeNull();
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws BarberNotFoundError when barber does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new UpdateBarberUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(BarberNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('passes tenantId to findById for isolation', async () => {
    const repo = makeRepo();
    const uc = new UpdateBarberUseCase(repo);
    await uc.execute(INPUT);
    expect(repo.findById).toHaveBeenCalledWith('barber-1', 'tenant-1');
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="update-barber.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/team/application/use-cases/update-barber.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';

export interface UpdateBarberInput {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
}

@Injectable()
export class UpdateBarberUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: UpdateBarberInput): Promise<Barber> {
    const barber = await this.repo.findById(input.id, input.tenantId);
    if (!barber) throw new BarberNotFoundError();

    barber.update(input.name, input.phone);
    return this.repo.save(barber);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="update-barber.use-case.spec"`

Expected: `Tests: 3 passed, 3 total`

- [ ] Commit: `feat(team): UpdateBarber use case`

---

## Task T7 — TDD: `SetWorkSchedule` use case

**Files to create:**
- `apps/api/src/modules/team/application/use-cases/set-work-schedule.use-case.ts`
- `apps/api/src/modules/team/application/use-cases/set-work-schedule.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/team/application/use-cases/set-work-schedule.use-case.spec.ts
import { SetWorkScheduleUseCase, SetWorkScheduleInput } from './set-work-schedule.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';
import { defaultWorkSchedule, WorkSchedule } from '../../domain/value-objects/work-schedule';

const EXISTING = Barber.reconstitute({
  id: 'barber-1',
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: null,
  isActive: true,
  workSchedule: defaultWorkSchedule(),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

const NEW_SCHEDULE: WorkSchedule = {
  mon: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  tue: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  wed: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  thu: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  fri: { isWorking: true,  startTime: '08:00', endTime: '17:00' },
  sat: { isWorking: false, startTime: null,     endTime: null     },
  sun: { isWorking: false, startTime: null,     endTime: null     },
};

function makeRepo(existing: Barber | null = EXISTING): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

const INPUT: SetWorkScheduleInput = {
  id: 'barber-1',
  tenantId: 'tenant-1',
  workSchedule: NEW_SCHEDULE,
};

describe('SetWorkScheduleUseCase', () => {
  it('replaces work schedule and saves', async () => {
    const repo = makeRepo();
    const uc = new SetWorkScheduleUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.workSchedule.sat.isWorking).toBe(false);
    expect(result.workSchedule.mon.startTime).toBe('08:00');
    expect(repo.save).toHaveBeenCalled();
  });

  it('throws BarberNotFoundError when barber does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new SetWorkScheduleUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(BarberNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('passes tenantId to findById for isolation', async () => {
    const repo = makeRepo();
    const uc = new SetWorkScheduleUseCase(repo);
    await uc.execute(INPUT);
    expect(repo.findById).toHaveBeenCalledWith('barber-1', 'tenant-1');
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="set-work-schedule.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/team/application/use-cases/set-work-schedule.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';
import { WorkSchedule } from '../../domain/value-objects/work-schedule';

export interface SetWorkScheduleInput {
  id: string;
  tenantId: string;
  workSchedule: WorkSchedule;
}

@Injectable()
export class SetWorkScheduleUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: SetWorkScheduleInput): Promise<Barber> {
    const barber = await this.repo.findById(input.id, input.tenantId);
    if (!barber) throw new BarberNotFoundError();

    barber.setWorkSchedule(input.workSchedule);
    return this.repo.save(barber);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="set-work-schedule.use-case.spec"`

Expected: `Tests: 3 passed, 3 total`

- [ ] Commit: `feat(team): SetWorkSchedule use case`

---

## Task T8 — TDD: `GetBarber` use case

**Files to create:**
- `apps/api/src/modules/team/application/use-cases/get-barber.use-case.ts`
- `apps/api/src/modules/team/application/use-cases/get-barber.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/team/application/use-cases/get-barber.use-case.spec.ts
import { GetBarberUseCase } from './get-barber.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';
import { defaultWorkSchedule } from '../../domain/value-objects/work-schedule';

const EXISTING = Barber.reconstitute({
  id: 'barber-1',
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: null,
  isActive: true,
  workSchedule: defaultWorkSchedule(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(existing: Barber | null = EXISTING): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

describe('GetBarberUseCase', () => {
  it('returns the barber when it exists', async () => {
    const repo = makeRepo();
    const uc = new GetBarberUseCase(repo);
    const result = await uc.execute({ id: 'barber-1', tenantId: 'tenant-1' });
    expect(result.id).toBe('barber-1');
    expect(result.name).toBe('João Barber');
    expect(repo.findById).toHaveBeenCalledWith('barber-1', 'tenant-1');
  });

  it('throws BarberNotFoundError when barber does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new GetBarberUseCase(repo);
    await expect(
      uc.execute({ id: 'missing', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(BarberNotFoundError);
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="get-barber.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/team/application/use-cases/get-barber.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';

export interface GetBarberInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class GetBarberUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: GetBarberInput): Promise<Barber> {
    const barber = await this.repo.findById(input.id, input.tenantId);
    if (!barber) throw new BarberNotFoundError();
    return barber;
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="get-barber.use-case.spec"`

Expected: `Tests: 2 passed, 2 total`

- [ ] Commit: `feat(team): GetBarber use case`

---

## Task T9 — TDD: `ListBarbers` use case

**Files to create:**
- `apps/api/src/modules/team/application/use-cases/list-barbers.use-case.ts`
- `apps/api/src/modules/team/application/use-cases/list-barbers.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/team/application/use-cases/list-barbers.use-case.spec.ts
import { ListBarbersUseCase } from './list-barbers.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { defaultWorkSchedule } from '../../domain/value-objects/work-schedule';

const makeBarber = (id: string, isActive: boolean) =>
  Barber.reconstitute({
    id,
    tenantId: 'tenant-1',
    name: `Barber ${id}`,
    phone: null,
    isActive,
    workSchedule: defaultWorkSchedule(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const ACTIVE   = makeBarber('b1', true);
const INACTIVE = makeBarber('b2', false);

function makeRepo(barbers: Barber[] = [ACTIVE, INACTIVE]): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockImplementation(
      async (_tenantId: string, includeInactive: boolean) =>
        includeInactive ? barbers : barbers.filter((b) => b.isActive),
    ),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

describe('ListBarbersUseCase', () => {
  it('returns only active barbers when includeInactive is false', async () => {
    const repo = makeRepo();
    const uc = new ListBarbersUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b1');
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', false);
  });

  it('returns all barbers including inactive when includeInactive is true', async () => {
    const repo = makeRepo();
    const uc = new ListBarbersUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: true });
    expect(result).toHaveLength(2);
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', true);
  });

  it('returns empty array when tenant has no barbers', async () => {
    const repo = makeRepo([]);
    const uc = new ListBarbersUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: false });
    expect(result).toEqual([]);
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="list-barbers.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/team/application/use-cases/list-barbers.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';

export interface ListBarbersInput {
  tenantId: string;
  includeInactive: boolean;
}

@Injectable()
export class ListBarbersUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: ListBarbersInput): Promise<Barber[]> {
    return this.repo.findAll(input.tenantId, input.includeInactive);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="list-barbers.use-case.spec"`

Expected: `Tests: 3 passed, 3 total`

- [ ] Commit: `feat(team): ListBarbers use case`

---

## Task T10 — TDD: `DeactivateBarber` use case

**Files to create:**
- `apps/api/src/modules/team/application/use-cases/deactivate-barber.use-case.ts`
- `apps/api/src/modules/team/application/use-cases/deactivate-barber.use-case.spec.ts`

### Step-by-step

- [ ] Write spec first (TDD — red):

```typescript
// apps/api/src/modules/team/application/use-cases/deactivate-barber.use-case.spec.ts
import { DeactivateBarberUseCase } from './deactivate-barber.use-case';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { BarberNotFoundError } from '../../domain/errors/team.errors';
import { defaultWorkSchedule } from '../../domain/value-objects/work-schedule';

const ACTIVE = Barber.reconstitute({
  id: 'barber-1',
  tenantId: 'tenant-1',
  name: 'João Barber',
  phone: null,
  isActive: true,
  workSchedule: defaultWorkSchedule(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(existing: Barber | null = ACTIVE): ITeamRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation(async (b: Barber) => b),
  };
}

describe('DeactivateBarberUseCase', () => {
  it('deactivates barber and saves', async () => {
    const repo = makeRepo();
    const uc = new DeactivateBarberUseCase(repo);
    await uc.execute({ id: 'barber-1', tenantId: 'tenant-1' });
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Barber;
    expect(saved.isActive).toBe(false);
  });

  it('throws BarberNotFoundError when barber does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new DeactivateBarberUseCase(repo);
    await expect(
      uc.execute({ id: 'missing', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(BarberNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="deactivate-barber.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/team/application/use-cases/deactivate-barber.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { TEAM_REPOSITORY, ITeamRepository } from '../../domain/repositories/team.repository';
import { BarberNotFoundError } from '../../domain/errors/team.errors';

export interface DeactivateBarberInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class DeactivateBarberUseCase {
  constructor(
    @Inject(TEAM_REPOSITORY)
    private readonly repo: ITeamRepository,
  ) {}

  async execute(input: DeactivateBarberInput): Promise<void> {
    const barber = await this.repo.findById(input.id, input.tenantId);
    if (!barber) throw new BarberNotFoundError();
    barber.deactivate();
    await this.repo.save(barber);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="deactivate-barber.use-case.spec"`

Expected: `Tests: 2 passed, 2 total`

- [ ] Commit: `feat(team): DeactivateBarber use case`

---

## Task T11 — Drizzle repository `TeamDrizzleRepository`

**Files to create:**
- `apps/api/src/modules/team/infra/repositories/team-drizzle.repository.ts`

### Step-by-step

- [ ] Create the repository:

```typescript
// apps/api/src/modules/team/infra/repositories/team-drizzle.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { ITeamRepository } from '../../domain/repositories/team.repository';
import { Barber } from '../../domain/entities/barber.entity';
import { WorkSchedule, defaultWorkSchedule } from '../../domain/value-objects/work-schedule';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class TeamDrizzleRepository implements ITeamRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async findById(id: string, tenantId: string): Promise<Barber | null> {
    const rows = await this.db
      .select()
      .from(schema.barbers)
      .where(and(eq(schema.barbers.id, id), eq(schema.barbers.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findAll(tenantId: string, includeInactive: boolean): Promise<Barber[]> {
    const where = includeInactive
      ? eq(schema.barbers.tenantId, tenantId)
      : and(eq(schema.barbers.tenantId, tenantId), eq(schema.barbers.isActive, true));

    const rows = await this.db.select().from(schema.barbers).where(where);
    return rows.map((r) => this.toEntity(r));
  }

  async save(barber: Barber): Promise<Barber> {
    const now = new Date();
    await this.db
      .insert(schema.barbers)
      .values({
        id: barber.id,
        tenantId: barber.tenantId,
        name: barber.name,
        phone: barber.phone,
        isActive: barber.isActive,
        workSchedule: barber.workSchedule,
        createdAt: barber.createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.barbers.id,
        set: {
          name: barber.name,
          phone: barber.phone,
          isActive: barber.isActive,
          workSchedule: barber.workSchedule,
          updatedAt: now,
        },
      });

    return Barber.reconstitute({
      id: barber.id,
      tenantId: barber.tenantId,
      name: barber.name,
      phone: barber.phone,
      isActive: barber.isActive,
      workSchedule: barber.workSchedule,
      createdAt: barber.createdAt,
      updatedAt: now,
    });
  }

  private toEntity(row: typeof schema.barbers.$inferSelect): Barber {
    return Barber.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      phone: row.phone ?? null,
      isActive: row.isActive,
      workSchedule: (row.workSchedule as WorkSchedule) ?? defaultWorkSchedule(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
```

- [ ] Commit: `feat(team): TeamDrizzleRepository with JSONB work_schedule upsert`

---

## Task T12 — HTTP controller `TeamController`

**Files to create:**
- `apps/api/src/modules/team/http/team.controller.ts`

### Step-by-step

- [ ] Create the controller:

```typescript
// apps/api/src/modules/team/http/team.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '@shared/auth/public.decorator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { AddBarberUseCase } from '../application/use-cases/add-barber.use-case';
import { UpdateBarberUseCase } from '../application/use-cases/update-barber.use-case';
import { SetWorkScheduleUseCase } from '../application/use-cases/set-work-schedule.use-case';
import { GetBarberUseCase } from '../application/use-cases/get-barber.use-case';
import { ListBarbersUseCase } from '../application/use-cases/list-barbers.use-case';
import { DeactivateBarberUseCase } from '../application/use-cases/deactivate-barber.use-case';
import { Barber } from '../domain/entities/barber.entity';
import { DayOfWeek, DAYS_OF_WEEK } from '../domain/value-objects/work-schedule';

class DayScheduleDto {
  @IsBoolean()
  isWorking!: boolean;

  @IsString()
  @IsOptional()
  startTime!: string | null;

  @IsString()
  @IsOptional()
  endTime!: string | null;
}

class WorkScheduleDto implements Record<DayOfWeek, DayScheduleDto> {
  @ValidateNested() @Type(() => DayScheduleDto) mon!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) tue!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) wed!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) thu!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) fri!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) sat!: DayScheduleDto;
  @ValidateNested() @Type(() => DayScheduleDto) sun!: DayScheduleDto;
}

class AddBarberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  phone?: string | null;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkScheduleDto)
  workSchedule?: WorkScheduleDto;
}

class UpdateBarberDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  phone!: string | null;
}

class SetWorkScheduleDto {
  @IsObject()
  @ValidateNested()
  @Type(() => WorkScheduleDto)
  workSchedule!: WorkScheduleDto;
}

function serializeBarber(barber: Barber) {
  return {
    id: barber.id,
    tenantId: barber.tenantId,
    name: barber.name,
    phone: barber.phone,
    isActive: barber.isActive,
    workSchedule: barber.workSchedule,
    createdAt: barber.createdAt,
    updatedAt: barber.updatedAt,
  };
}

@Controller('barbers')
export class TeamController {
  constructor(
    private readonly addBarber: AddBarberUseCase,
    private readonly updateBarber: UpdateBarberUseCase,
    private readonly setWorkSchedule: SetWorkScheduleUseCase,
    private readonly getBarber: GetBarberUseCase,
    private readonly listBarbers: ListBarbersUseCase,
    private readonly deactivateBarber: DeactivateBarberUseCase,
  ) {}

  @Public()
  @Get()
  async list(@Headers('x-tenant-id') tenantId: string) {
    const barbers = await this.listBarbers.execute({ tenantId, includeInactive: false });
    return barbers.map(serializeBarber);
  }

  @Roles('ADMIN')
  @Get('admin')
  async listAdmin(
    @CurrentUser() user: JwtPayload,
    @Query('includeInactive') includeInactiveRaw?: string,
  ) {
    const includeInactive = includeInactiveRaw === 'true';
    const barbers = await this.listBarbers.execute({ tenantId: user.tenantId, includeInactive });
    return barbers.map(serializeBarber);
  }

  @Public()
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    const barber = await this.getBarber.execute({ id, tenantId });
    return serializeBarber(barber);
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: AddBarberDto) {
    const barber = await this.addBarber.execute({
      tenantId: user.tenantId,
      name: dto.name,
      phone: dto.phone ?? null,
      workSchedule: dto.workSchedule,
    });
    return serializeBarber(barber);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateBarberDto,
  ) {
    const barber = await this.updateBarber.execute({
      id,
      tenantId: user.tenantId,
      name: dto.name,
      phone: dto.phone,
    });
    return serializeBarber(barber);
  }

  @Roles('ADMIN')
  @Put(':id/work-schedule')
  async updateWorkSchedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: SetWorkScheduleDto,
  ) {
    const barber = await this.setWorkSchedule.execute({
      id,
      tenantId: user.tenantId,
      workSchedule: dto.workSchedule,
    });
    return serializeBarber(barber);
  }

  @Roles('ADMIN')
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.deactivateBarber.execute({ id, tenantId: user.tenantId });
  }
}
```

- [ ] Commit: `feat(team): TeamController with all 7 routes`

---

## Task T13 — Wire `TeamModule`

**Files to modify:**
- `apps/api/src/modules/team/team.module.ts`

`AppModule` already imports `TeamModule` — no change needed there.

### Step-by-step

- [ ] Replace the stub with full wiring:

```typescript
// apps/api/src/modules/team/team.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/database/database.module';

import { TEAM_REPOSITORY } from './domain/repositories/team.repository';
import { TeamDrizzleRepository } from './infra/repositories/team-drizzle.repository';

import { AddBarberUseCase } from './application/use-cases/add-barber.use-case';
import { UpdateBarberUseCase } from './application/use-cases/update-barber.use-case';
import { SetWorkScheduleUseCase } from './application/use-cases/set-work-schedule.use-case';
import { GetBarberUseCase } from './application/use-cases/get-barber.use-case';
import { ListBarbersUseCase } from './application/use-cases/list-barbers.use-case';
import { DeactivateBarberUseCase } from './application/use-cases/deactivate-barber.use-case';

import { TeamController } from './http/team.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [TeamController],
  providers: [
    { provide: TEAM_REPOSITORY, useClass: TeamDrizzleRepository },
    AddBarberUseCase,
    UpdateBarberUseCase,
    SetWorkScheduleUseCase,
    GetBarberUseCase,
    ListBarbersUseCase,
    DeactivateBarberUseCase,
  ],
})
export class TeamModule {}
```

- [ ] Run full test suite:

```bash
pnpm --filter api test
```

Expected: all previous tests pass; new team use-case tests included.

- [ ] Run tsc:

```bash
pnpm exec tsc --noEmit
```

Expected: zero errors.

- [ ] Run build:

```bash
pnpm --filter api build
```

Expected: success.

- [ ] Commit: `feat(team): wire TeamModule — all providers and controller registered`

---

## Final directory structure

```
apps/api/src/modules/team/
├── domain/
│   ├── entities/
│   │   ├── barber.entity.ts
│   │   └── barber.entity.spec.ts
│   ├── errors/
│   │   └── team.errors.ts
│   ├── repositories/
│   │   └── team.repository.ts
│   └── value-objects/
│       └── work-schedule.ts
├── application/
│   └── use-cases/
│       ├── add-barber.use-case.ts
│       ├── add-barber.use-case.spec.ts
│       ├── update-barber.use-case.ts
│       ├── update-barber.use-case.spec.ts
│       ├── set-work-schedule.use-case.ts
│       ├── set-work-schedule.use-case.spec.ts
│       ├── get-barber.use-case.ts
│       ├── get-barber.use-case.spec.ts
│       ├── list-barbers.use-case.ts
│       ├── list-barbers.use-case.spec.ts
│       ├── deactivate-barber.use-case.ts
│       └── deactivate-barber.use-case.spec.ts
├── infra/
│   └── repositories/
│       └── team-drizzle.repository.ts
├── http/
│   └── team.controller.ts
└── team.module.ts

apps/api/src/shared/database/schema/
└── barbers.ts  (added)
    index.ts    (updated — export barbers)

apps/api/src/shared/kernel/errors/
└── domain-exception.filter.ts  (updated — BARBER_NOT_FOUND → 404)
```

---

## Self-review checklist

- [x] All 6 use cases covered: AddBarber, UpdateBarber, SetWorkSchedule, GetBarber, ListBarbers, DeactivateBarber
- [x] No placeholders — every step has real compilable code
- [x] `WorkSchedule` value object defined once and reused consistently across entity, use cases, repository, controller, schema
- [x] `TEAM_REPOSITORY` Symbol token used in all use cases and module wiring
- [x] `BARBER_NOT_FOUND` → 404 added to `DomainExceptionFilter`
- [x] DB schema `barbers.ts` uses `jsonb` for `work_schedule` with `$type<WorkSchedule>()`
- [x] `TeamDrizzleRepository.save()` returns fresh entity with `updatedAt: now` (same pattern as CatalogDrizzleRepository)
- [x] Public routes use `x-tenant-id` header; admin routes use `@CurrentUser()` JWT payload
- [x] `PUT /barbers/:id/work-schedule` is idempotent — full replacement of schedule
- [x] `AppModule` already imports `TeamModule` — no modification needed
- [x] TDD red-green cycle explicit in each use-case task
- [x] One commit per task
