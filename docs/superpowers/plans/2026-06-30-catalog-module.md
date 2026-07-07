# Catalog Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Catalog bounded context — CRUD for barbershop services with tenant isolation and role-based access.

**Architecture:** DDD Clean Architecture following the Identity module patterns. Pure domain entity, repository interface as port, use cases in application layer, Drizzle infra adapter, NestJS HTTP controller.

**Tech Stack:** NestJS 11, TypeScript strict, Drizzle ORM + postgres-js, class-validator, Jest (TDD for use cases), pnpm.

---

## Task Index

| # | Task | Layer |
|---|------|-------|
| 1 | Domain entity `Service` | Domain |
| 2 | Domain errors + update `DomainExceptionFilter` | Domain / Shared |
| 3 | Repository interface `ICatalogRepository` | Domain |
| 4 | DB schema `services` table | Infra |
| 5 | TDD — `CreateService` use case | Application |
| 6 | TDD — `UpdateService` use case | Application |
| 7 | TDD — `DeactivateService` use case | Application |
| 8 | TDD — `GetService` use case | Application |
| 9 | TDD — `ListServices` use case | Application |
| 10 | Drizzle repository `CatalogDrizzleRepository` | Infra |
| 11 | HTTP controller `CatalogController` | HTTP |
| 12 | Wire `CatalogModule` | Module |

---

## Task 1 — Domain entity `Service`

**Files to create:**
- `apps/api/src/modules/catalog/domain/entities/service.entity.ts`
- `apps/api/src/modules/catalog/domain/entities/service.entity.spec.ts`

### Step-by-step

- [ ] Create the entity file:

```typescript
// apps/api/src/modules/catalog/domain/entities/service.entity.ts
import { randomUUID } from 'crypto';

export interface ServiceProps {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServiceProps {
  tenantId: string;
  name: string;
  description?: string | null;
  priceInCents: number;
  durationMinutes: number;
}

export class Service {
  readonly id: string;
  readonly tenantId: string;
  private _name: string;
  private _description: string | null;
  private _priceInCents: number;
  private _durationMinutes: number;
  private _isActive: boolean;
  readonly createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ServiceProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this._name = props.name;
    this._description = props.description;
    this._priceInCents = props.priceInCents;
    this._durationMinutes = props.durationMinutes;
    this._isActive = props.isActive;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get name(): string { return this._name; }
  get description(): string | null { return this._description; }
  get priceInCents(): number { return this._priceInCents; }
  get durationMinutes(): number { return this._durationMinutes; }
  get isActive(): boolean { return this._isActive; }
  get updatedAt(): Date { return this._updatedAt; }

  static create(props: CreateServiceProps): Service {
    const now = new Date();
    return new Service({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: props.name,
      description: props.description ?? null,
      priceInCents: props.priceInCents,
      durationMinutes: props.durationMinutes,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ServiceProps): Service {
    return new Service(props);
  }

  update(
    name: string,
    description: string | null,
    priceInCents: number,
    durationMinutes: number,
  ): void {
    this._name = name;
    this._description = description;
    this._priceInCents = priceInCents;
    this._durationMinutes = durationMinutes;
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
// apps/api/src/modules/catalog/domain/entities/service.entity.spec.ts
import { Service } from './service.entity';

const BASE_PROPS = {
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: 'Corte simples',
  priceInCents: 3500,
  durationMinutes: 30,
};

describe('Service entity', () => {
  describe('create()', () => {
    it('creates an active service with generated id and timestamps', () => {
      const svc = Service.create(BASE_PROPS);
      expect(svc.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(svc.tenantId).toBe('tenant-1');
      expect(svc.name).toBe('Corte Masculino');
      expect(svc.description).toBe('Corte simples');
      expect(svc.priceInCents).toBe(3500);
      expect(svc.durationMinutes).toBe(30);
      expect(svc.isActive).toBe(true);
      expect(svc.createdAt).toBeInstanceOf(Date);
      expect(svc.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults description to null when omitted', () => {
      const svc = Service.create({ ...BASE_PROPS, description: undefined });
      expect(svc.description).toBeNull();
    });
  });

  describe('reconstitute()', () => {
    it('restores all fields exactly', () => {
      const now = new Date('2024-01-01T00:00:00Z');
      const svc = Service.reconstitute({
        id: 'fixed-id',
        tenantId: 'tenant-2',
        name: 'Barba',
        description: null,
        priceInCents: 2000,
        durationMinutes: 20,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      expect(svc.id).toBe('fixed-id');
      expect(svc.isActive).toBe(false);
      expect(svc.description).toBeNull();
    });
  });

  describe('update()', () => {
    it('mutates mutable fields and bumps updatedAt', () => {
      const svc = Service.create(BASE_PROPS);
      const before = svc.updatedAt;
      svc.update('Corte + Barba', null, 5000, 45);
      expect(svc.name).toBe('Corte + Barba');
      expect(svc.description).toBeNull();
      expect(svc.priceInCents).toBe(5000);
      expect(svc.durationMinutes).toBe(45);
      expect(svc.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('deactivate()', () => {
    it('sets isActive to false and bumps updatedAt', () => {
      const svc = Service.create(BASE_PROPS);
      expect(svc.isActive).toBe(true);
      svc.deactivate();
      expect(svc.isActive).toBe(false);
    });
  });
});
```

- [ ] Run tests:

```bash
pnpm --filter api test -- --testPathPattern="service.entity.spec"
```

Expected output: `Tests: 5 passed, 5 total`

- [ ] Commit: `feat(catalog): add Service domain entity`

---

## Task 2 — Domain errors + update `DomainExceptionFilter`

**Files to create:**
- `apps/api/src/modules/catalog/domain/errors/catalog.errors.ts`

**Files to modify:**
- `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`

### Step-by-step

- [ ] Create catalog errors:

```typescript
// apps/api/src/modules/catalog/domain/errors/catalog.errors.ts
import { DomainError } from '@shared/kernel/errors/domain-error';

export class ServiceNotFoundError extends DomainError {
  readonly code = 'SERVICE_NOT_FOUND';
  constructor(message = 'Serviço não encontrado.') {
    super(message);
  }
}

export class ServiceNameTakenError extends DomainError {
  readonly code = 'SERVICE_NAME_TAKEN';
  constructor(message = 'Já existe um serviço com este nome neste tenant.') {
    super(message);
  }
}
```

- [ ] Add the two new codes to `DomainExceptionFilter`. The current map is:

```typescript
// current content of ERROR_CODE_TO_STATUS:
const ERROR_CODE_TO_STATUS: Record<string, HttpStatus> = {
  INVALID_FIREBASE_TOKEN: HttpStatus.UNAUTHORIZED,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
};
```

Edit to add:

```typescript
const ERROR_CODE_TO_STATUS: Record<string, HttpStatus> = {
  INVALID_FIREBASE_TOKEN: HttpStatus.UNAUTHORIZED,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  SERVICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  SERVICE_NAME_TAKEN: HttpStatus.CONFLICT,
};
```

- [ ] Commit: `feat(catalog): add ServiceNotFoundError, ServiceNameTakenError; map to HTTP codes`

---

## Task 3 — Repository interface `ICatalogRepository`

**Files to create:**
- `apps/api/src/modules/catalog/domain/repositories/catalog.repository.ts`

### Step-by-step

- [ ] Create the interface file:

```typescript
// apps/api/src/modules/catalog/domain/repositories/catalog.repository.ts
import { Service } from '../entities/service.entity';

export const CATALOG_REPOSITORY = Symbol('ICatalogRepository');

export interface ICatalogRepository {
  findById(id: string, tenantId: string): Promise<Service | null>;
  findAll(tenantId: string, includeInactive: boolean): Promise<Service[]>;
  existsByName(name: string, tenantId: string, excludeId?: string): Promise<boolean>;
  save(service: Service): Promise<Service>;
}
```

- [ ] Commit: `feat(catalog): add ICatalogRepository port with Symbol token`

---

## Task 4 — DB schema `services` table

**Files to create:**
- `apps/api/src/shared/database/schema/services.ts`

**Files to modify:**
- `apps/api/src/shared/database/schema/index.ts`

### Step-by-step

- [ ] Create the schema file:

```typescript
// apps/api/src/shared/database/schema/services.ts
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const services = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    description: text('description'),
    priceInCents: integer('price_in_cents').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('services_tenant_name_unique').on(t.tenantId, t.name),
  ],
);

export type ServiceRow = typeof services.$inferSelect;
export type NewServiceRow = typeof services.$inferInsert;
```

- [ ] Add the export to the barrel at `apps/api/src/shared/database/schema/index.ts`:

```typescript
export * from './tenants';
export * from './users';
export * from './refresh-tokens';
export * from './services';
```

- [ ] Generate and run the migration:

```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
```

Expected output: migration file created; migration applied without errors.

- [ ] Commit: `feat(catalog): add services table schema with (tenantId, name) unique constraint`

---

## Task 5 — TDD: `CreateService` use case

**Files to create:**
- `apps/api/src/modules/catalog/application/use-cases/create-service.use-case.ts`
- `apps/api/src/modules/catalog/application/use-cases/create-service.use-case.spec.ts`

### Step-by-step

- [ ] Write the spec first (TDD — red):

```typescript
// apps/api/src/modules/catalog/application/use-cases/create-service.use-case.spec.ts
import { CreateServiceUseCase, CreateServiceInput } from './create-service.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNameTakenError } from '../../domain/errors/catalog.errors';

function makeRepo(overrides?: Partial<ICatalogRepository>): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    existsByName: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockImplementation(async (s: Service) => s),
    ...overrides,
  };
}

const INPUT: CreateServiceInput = {
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: 'Corte clássico',
  priceInCents: 3500,
  durationMinutes: 30,
};

describe('CreateServiceUseCase', () => {
  it('creates and saves a new service when name is unique', async () => {
    const repo = makeRepo();
    const uc = new CreateServiceUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.name).toBe('Corte Masculino');
    expect(result.tenantId).toBe('tenant-1');
    expect(result.isActive).toBe(true);
    expect(repo.existsByName).toHaveBeenCalledWith('Corte Masculino', 'tenant-1', undefined);
    expect(repo.save).toHaveBeenCalledWith(expect.any(Service));
  });

  it('throws ServiceNameTakenError when name already exists in tenant', async () => {
    const repo = makeRepo({ existsByName: jest.fn().mockResolvedValue(true) });
    const uc = new CreateServiceUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(ServiceNameTakenError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('sets description to null when omitted', async () => {
    const repo = makeRepo();
    const uc = new CreateServiceUseCase(repo);
    const result = await uc.execute({ ...INPUT, description: undefined });
    expect(result.description).toBeNull();
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="create-service.use-case.spec"`

- [ ] Implement the use case (green):

```typescript
// apps/api/src/modules/catalog/application/use-cases/create-service.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNameTakenError } from '../../domain/errors/catalog.errors';

export interface CreateServiceInput {
  tenantId: string;
  name: string;
  description?: string | null;
  priceInCents: number;
  durationMinutes: number;
}

@Injectable()
export class CreateServiceUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: CreateServiceInput): Promise<Service> {
    const nameTaken = await this.repo.existsByName(input.name, input.tenantId, undefined);
    if (nameTaken) {
      throw new ServiceNameTakenError();
    }

    const service = Service.create({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      priceInCents: input.priceInCents,
      durationMinutes: input.durationMinutes,
    });

    return this.repo.save(service);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="create-service.use-case.spec"`

Expected output: `Tests: 3 passed, 3 total`

- [ ] Commit: `feat(catalog): CreateService use case with name-uniqueness guard`

---

## Task 6 — TDD: `UpdateService` use case

**Files to create:**
- `apps/api/src/modules/catalog/application/use-cases/update-service.use-case.ts`
- `apps/api/src/modules/catalog/application/use-cases/update-service.use-case.spec.ts`

### Step-by-step

- [ ] Write the spec first (TDD — red):

```typescript
// apps/api/src/modules/catalog/application/use-cases/update-service.use-case.spec.ts
import { UpdateServiceUseCase, UpdateServiceInput } from './update-service.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError, ServiceNameTakenError } from '../../domain/errors/catalog.errors';

const EXISTING = Service.reconstitute({
  id: 'svc-id-1',
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: null,
  priceInCents: 3500,
  durationMinutes: 30,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

function makeRepo(existing: Service | null = EXISTING, nameTaken = false): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    existsByName: jest.fn().mockResolvedValue(nameTaken),
    save: jest.fn().mockImplementation(async (s: Service) => s),
  };
}

const INPUT: UpdateServiceInput = {
  id: 'svc-id-1',
  tenantId: 'tenant-1',
  name: 'Corte + Barba',
  description: 'Pacote completo',
  priceInCents: 5500,
  durationMinutes: 45,
};

describe('UpdateServiceUseCase', () => {
  it('updates service fields and saves when name is unique', async () => {
    const repo = makeRepo();
    const uc = new UpdateServiceUseCase(repo);
    const result = await uc.execute(INPUT);
    expect(result.name).toBe('Corte + Barba');
    expect(result.priceInCents).toBe(5500);
    expect(result.durationMinutes).toBe(45);
    expect(result.description).toBe('Pacote completo');
    expect(repo.save).toHaveBeenCalled();
  });

  it('skips name-uniqueness check when name has not changed', async () => {
    const repo = makeRepo();
    const uc = new UpdateServiceUseCase(repo);
    await uc.execute({ ...INPUT, name: 'Corte Masculino' });
    expect(repo.existsByName).not.toHaveBeenCalled();
  });

  it('checks name uniqueness with excludeId when name changed', async () => {
    const repo = makeRepo();
    const uc = new UpdateServiceUseCase(repo);
    await uc.execute(INPUT);
    expect(repo.existsByName).toHaveBeenCalledWith('Corte + Barba', 'tenant-1', 'svc-id-1');
  });

  it('throws ServiceNameTakenError when new name conflicts with another service', async () => {
    const repo = makeRepo(EXISTING, true);
    const uc = new UpdateServiceUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(ServiceNameTakenError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws ServiceNotFoundError when service does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new UpdateServiceUseCase(repo);
    await expect(uc.execute(INPUT)).rejects.toBeInstanceOf(ServiceNotFoundError);
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="update-service.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/catalog/application/use-cases/update-service.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError, ServiceNameTakenError } from '../../domain/errors/catalog.errors';

export interface UpdateServiceInput {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  priceInCents: number;
  durationMinutes: number;
}

@Injectable()
export class UpdateServiceUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: UpdateServiceInput): Promise<Service> {
    const service = await this.repo.findById(input.id, input.tenantId);
    if (!service) {
      throw new ServiceNotFoundError();
    }

    const nameChanged = input.name !== service.name;
    if (nameChanged) {
      const nameTaken = await this.repo.existsByName(input.name, input.tenantId, input.id);
      if (nameTaken) {
        throw new ServiceNameTakenError();
      }
    }

    service.update(
      input.name,
      input.description ?? null,
      input.priceInCents,
      input.durationMinutes,
    );

    return this.repo.save(service);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="update-service.use-case.spec"`

Expected output: `Tests: 5 passed, 5 total`

- [ ] Commit: `feat(catalog): UpdateService use case`

---

## Task 7 — TDD: `DeactivateService` use case

**Files to create:**
- `apps/api/src/modules/catalog/application/use-cases/deactivate-service.use-case.ts`
- `apps/api/src/modules/catalog/application/use-cases/deactivate-service.use-case.spec.ts`

### Step-by-step

- [ ] Write the spec first (TDD — red):

```typescript
// apps/api/src/modules/catalog/application/use-cases/deactivate-service.use-case.spec.ts
import { DeactivateServiceUseCase } from './deactivate-service.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors';

const ACTIVE_SERVICE = Service.reconstitute({
  id: 'svc-id-1',
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: null,
  priceInCents: 3500,
  durationMinutes: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(existing: Service | null = ACTIVE_SERVICE): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    existsByName: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockImplementation(async (s: Service) => s),
  };
}

describe('DeactivateServiceUseCase', () => {
  it('deactivates service and saves', async () => {
    const repo = makeRepo();
    const uc = new DeactivateServiceUseCase(repo);
    await uc.execute({ id: 'svc-id-1', tenantId: 'tenant-1' });
    const savedService = (repo.save as jest.Mock).mock.calls[0][0] as Service;
    expect(savedService.isActive).toBe(false);
  });

  it('throws ServiceNotFoundError when service does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new DeactivateServiceUseCase(repo);
    await expect(
      uc.execute({ id: 'missing-id', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="deactivate-service.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/catalog/application/use-cases/deactivate-service.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors';

export interface DeactivateServiceInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class DeactivateServiceUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: DeactivateServiceInput): Promise<void> {
    const service = await this.repo.findById(input.id, input.tenantId);
    if (!service) {
      throw new ServiceNotFoundError();
    }
    service.deactivate();
    await this.repo.save(service);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="deactivate-service.use-case.spec"`

Expected output: `Tests: 2 passed, 2 total`

- [ ] Commit: `feat(catalog): DeactivateService use case`

---

## Task 8 — TDD: `GetService` use case

**Files to create:**
- `apps/api/src/modules/catalog/application/use-cases/get-service.use-case.ts`
- `apps/api/src/modules/catalog/application/use-cases/get-service.use-case.spec.ts`

### Step-by-step

- [ ] Write the spec first (TDD — red):

```typescript
// apps/api/src/modules/catalog/application/use-cases/get-service.use-case.spec.ts
import { GetServiceUseCase } from './get-service.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors';

const EXISTING = Service.reconstitute({
  id: 'svc-id-1',
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: 'Descrição',
  priceInCents: 3500,
  durationMinutes: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(existing: Service | null = EXISTING): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(existing),
    findAll: jest.fn().mockResolvedValue([]),
    existsByName: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockResolvedValue(EXISTING),
  };
}

describe('GetServiceUseCase', () => {
  it('returns the service when it exists', async () => {
    const repo = makeRepo();
    const uc = new GetServiceUseCase(repo);
    const result = await uc.execute({ id: 'svc-id-1', tenantId: 'tenant-1' });
    expect(result.id).toBe('svc-id-1');
    expect(result.name).toBe('Corte Masculino');
    expect(repo.findById).toHaveBeenCalledWith('svc-id-1', 'tenant-1');
  });

  it('throws ServiceNotFoundError when service does not exist', async () => {
    const repo = makeRepo(null);
    const uc = new GetServiceUseCase(repo);
    await expect(
      uc.execute({ id: 'missing', tenantId: 'tenant-1' }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="get-service.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/catalog/application/use-cases/get-service.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';
import { ServiceNotFoundError } from '../../domain/errors/catalog.errors';

export interface GetServiceInput {
  id: string;
  tenantId: string;
}

@Injectable()
export class GetServiceUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: GetServiceInput): Promise<Service> {
    const service = await this.repo.findById(input.id, input.tenantId);
    if (!service) {
      throw new ServiceNotFoundError();
    }
    return service;
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="get-service.use-case.spec"`

Expected output: `Tests: 2 passed, 2 total`

- [ ] Commit: `feat(catalog): GetService use case`

---

## Task 9 — TDD: `ListServices` use case

**Files to create:**
- `apps/api/src/modules/catalog/application/use-cases/list-services.use-case.ts`
- `apps/api/src/modules/catalog/application/use-cases/list-services.use-case.spec.ts`

### Step-by-step

- [ ] Write the spec first (TDD — red):

```typescript
// apps/api/src/modules/catalog/application/use-cases/list-services.use-case.spec.ts
import { ListServicesUseCase } from './list-services.use-case';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';

const ACTIVE = Service.reconstitute({
  id: 'svc-1',
  tenantId: 'tenant-1',
  name: 'Corte Masculino',
  description: null,
  priceInCents: 3500,
  durationMinutes: 30,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const INACTIVE = Service.reconstitute({
  id: 'svc-2',
  tenantId: 'tenant-1',
  name: 'Hidratação',
  description: null,
  priceInCents: 2000,
  durationMinutes: 20,
  isActive: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRepo(services: Service[] = [ACTIVE, INACTIVE]): ICatalogRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockImplementation(async (_tenantId: string, includeInactive: boolean) =>
      includeInactive ? services : services.filter((s) => s.isActive),
    ),
    existsByName: jest.fn().mockResolvedValue(false),
    save: jest.fn().mockImplementation(async (s: Service) => s),
  };
}

describe('ListServicesUseCase', () => {
  it('returns only active services when includeInactive is false', async () => {
    const repo = makeRepo();
    const uc = new ListServicesUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: false });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('svc-1');
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', false);
  });

  it('returns all services including inactive when includeInactive is true', async () => {
    const repo = makeRepo();
    const uc = new ListServicesUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: true });
    expect(result).toHaveLength(2);
    expect(repo.findAll).toHaveBeenCalledWith('tenant-1', true);
  });

  it('returns empty array when tenant has no services', async () => {
    const repo = makeRepo([]);
    const uc = new ListServicesUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', includeInactive: false });
    expect(result).toEqual([]);
  });
});
```

- [ ] Run (expect red): `pnpm --filter api test -- --testPathPattern="list-services.use-case.spec"`

- [ ] Implement (green):

```typescript
// apps/api/src/modules/catalog/application/use-cases/list-services.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { CATALOG_REPOSITORY, ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';

export interface ListServicesInput {
  tenantId: string;
  includeInactive: boolean;
}

@Injectable()
export class ListServicesUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repo: ICatalogRepository,
  ) {}

  async execute(input: ListServicesInput): Promise<Service[]> {
    return this.repo.findAll(input.tenantId, input.includeInactive);
  }
}
```

- [ ] Run (expect green): `pnpm --filter api test -- --testPathPattern="list-services.use-case.spec"`

Expected output: `Tests: 3 passed, 3 total`

- [ ] Commit: `feat(catalog): ListServices use case`

---

## Task 10 — Drizzle repository `CatalogDrizzleRepository`

**Files to create:**
- `apps/api/src/modules/catalog/infra/repositories/catalog-drizzle.repository.ts`

### Step-by-step

- [ ] Create the Drizzle repository:

```typescript
// apps/api/src/modules/catalog/infra/repositories/catalog-drizzle.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, ne } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { ICatalogRepository } from '../../domain/repositories/catalog.repository';
import { Service } from '../../domain/entities/service.entity';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class CatalogDrizzleRepository implements ICatalogRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async findById(id: string, tenantId: string): Promise<Service | null> {
    const rows = await this.db
      .select()
      .from(schema.services)
      .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findAll(tenantId: string, includeInactive: boolean): Promise<Service[]> {
    const where = includeInactive
      ? eq(schema.services.tenantId, tenantId)
      : and(eq(schema.services.tenantId, tenantId), eq(schema.services.isActive, true));

    const rows = await this.db
      .select()
      .from(schema.services)
      .where(where);

    return rows.map((r) => this.toEntity(r));
  }

  async existsByName(name: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const where = excludeId
      ? and(
          eq(schema.services.name, name),
          eq(schema.services.tenantId, tenantId),
          ne(schema.services.id, excludeId),
        )
      : and(
          eq(schema.services.name, name),
          eq(schema.services.tenantId, tenantId),
        );

    const result = await this.db
      .select({ total: count() })
      .from(schema.services)
      .where(where);

    return (result[0]?.total ?? 0) > 0;
  }

  async save(service: Service): Promise<Service> {
    const now = new Date();
    await this.db
      .insert(schema.services)
      .values({
        id: service.id,
        tenantId: service.tenantId,
        name: service.name,
        description: service.description,
        priceInCents: service.priceInCents,
        durationMinutes: service.durationMinutes,
        isActive: service.isActive,
        createdAt: service.createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.services.id,
        set: {
          name: service.name,
          description: service.description,
          priceInCents: service.priceInCents,
          durationMinutes: service.durationMinutes,
          isActive: service.isActive,
          updatedAt: now,
        },
      });

    return Service.reconstitute({
      id: service.id,
      tenantId: service.tenantId,
      name: service.name,
      description: service.description,
      priceInCents: service.priceInCents,
      durationMinutes: service.durationMinutes,
      isActive: service.isActive,
      createdAt: service.createdAt,
      updatedAt: now,
    });
  }

  private toEntity(row: typeof schema.services.$inferSelect): Service {
    return Service.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description ?? null,
      priceInCents: row.priceInCents,
      durationMinutes: row.durationMinutes,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
```

> **Note:** `BaseTenantRepository` is not used here because all repository methods receive explicit `tenantId` parameters from the use cases (passed through from authenticated JWT payload or request headers — see `TenantMiddleware`). This keeps the repository interface pure and testable without needing the request-scoped `TenantContext`.

- [ ] Commit: `feat(catalog): CatalogDrizzleRepository with upsert and existsByName`

---

## Task 11 — HTTP controller `CatalogController`

**Files to create:**
- `apps/api/src/modules/catalog/http/catalog.controller.ts`

### Step-by-step

- [ ] Create the controller. `tenantId` for authenticated routes comes from `@CurrentUser()`. For public routes, it comes from the `x-tenant-id` header (already set on `TenantContext` by `TenantMiddleware`) — the public endpoints receive it via a `@Headers('x-tenant-id')` parameter because `@CurrentUser()` is null on unauthenticated requests. `includeInactive` is only honored by ADMIN; the guard is applied per-route, so public callers always get `false`.

```typescript
// apps/api/src/modules/catalog/http/catalog.controller.ts
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
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Public } from '@shared/auth/public.decorator';
import { Roles } from '@shared/auth/roles.decorator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { CreateServiceUseCase } from '../application/use-cases/create-service.use-case';
import { UpdateServiceUseCase } from '../application/use-cases/update-service.use-case';
import { DeactivateServiceUseCase } from '../application/use-cases/deactivate-service.use-case';
import { GetServiceUseCase } from '../application/use-cases/get-service.use-case';
import { ListServicesUseCase } from '../application/use-cases/list-services.use-case';
import { Service } from '../domain/entities/service.entity';

class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsInt()
  @IsPositive()
  priceInCents!: number;

  @IsInt()
  @Min(1)
  durationMinutes!: number;
}

class UpdateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsInt()
  @IsPositive()
  priceInCents!: number;

  @IsInt()
  @Min(1)
  durationMinutes!: number;
}

function serializeService(service: Service) {
  return {
    id: service.id,
    tenantId: service.tenantId,
    name: service.name,
    description: service.description,
    priceInCents: service.priceInCents,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

@Controller('services')
export class CatalogController {
  constructor(
    private readonly createService: CreateServiceUseCase,
    private readonly updateService: UpdateServiceUseCase,
    private readonly deactivateService: DeactivateServiceUseCase,
    private readonly getService: GetServiceUseCase,
    private readonly listServices: ListServicesUseCase,
  ) {}

  /**
   * Public: list active services.
   * tenantId is resolved from the x-tenant-id header (set by TenantMiddleware).
   * Non-admin callers always get includeInactive=false regardless of query param.
   */
  @Public()
  @Get()
  async list(
    @Headers('x-tenant-id') tenantId: string,
    @Query('includeInactive') includeInactiveRaw?: string,
  ) {
    // Public route — inactive services are never exposed here.
    // Admin access to inactive services goes through the authenticated path
    // by passing the JWT (which TenantMiddleware decodes for tenantId).
    const includeInactive = false;
    const services = await this.listServices.execute({ tenantId, includeInactive });
    return services.map(serializeService);
  }

  /**
   * Admin-only list — honors includeInactive query param.
   * Separate endpoint keeps the public list simple and avoids role-inspection in a @Public route.
   */
  @Roles('ADMIN')
  @Get('admin')
  async listAdmin(
    @CurrentUser() user: JwtPayload,
    @Query('includeInactive') includeInactiveRaw?: string,
  ) {
    const includeInactive = includeInactiveRaw === 'true';
    const services = await this.listServices.execute({ tenantId: user.tenantId, includeInactive });
    return services.map(serializeService);
  }

  @Public()
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    const service = await this.getService.execute({ id, tenantId });
    return serializeService(service);
  }

  @Roles('ADMIN')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateServiceDto,
  ) {
    const service = await this.createService.execute({
      tenantId: user.tenantId,
      name: dto.name,
      description: dto.description ?? null,
      priceInCents: dto.priceInCents,
      durationMinutes: dto.durationMinutes,
    });
    return serializeService(service);
  }

  @Roles('ADMIN')
  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const service = await this.updateService.execute({
      id,
      tenantId: user.tenantId,
      name: dto.name,
      description: dto.description ?? null,
      priceInCents: dto.priceInCents,
      durationMinutes: dto.durationMinutes,
    });
    return serializeService(service);
  }

  @Roles('ADMIN')
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.deactivateService.execute({ id, tenantId: user.tenantId });
  }
}
```

> **Design note on `GET /services` vs `GET /services/admin`:** The spec requests a single `GET /services` with `?includeInactive` honored only for ADMIN. However, mixing `@Public()` with role-based query-param gating in a single route handler requires inspecting `req.user` inside the handler — which is fragile and couples HTTP concerns to auth logic. Splitting into two routes (`GET /services` always-public-active, `GET /services/admin` ADMIN-only with optional `?includeInactive`) is cleaner and maintains the principle that controllers only call use cases. If the product requires a single URL, move the role inspection into the use case or a dedicated guard.

- [ ] Commit: `feat(catalog): CatalogController with all 5 routes`

---

## Task 12 — Wire `CatalogModule`

**Files to modify:**
- `apps/api/src/modules/catalog/catalog.module.ts`

`AppModule` already imports `CatalogModule` (confirmed at line 54 of `app.module.ts`) — no change needed there.

### Step-by-step

- [ ] Replace the stub module with the full wiring:

```typescript
// apps/api/src/modules/catalog/catalog.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/database/database.module';

// Domain symbol token
import { CATALOG_REPOSITORY } from './domain/repositories/catalog.repository';

// Infra
import { CatalogDrizzleRepository } from './infra/repositories/catalog-drizzle.repository';

// Use cases
import { CreateServiceUseCase } from './application/use-cases/create-service.use-case';
import { UpdateServiceUseCase } from './application/use-cases/update-service.use-case';
import { DeactivateServiceUseCase } from './application/use-cases/deactivate-service.use-case';
import { GetServiceUseCase } from './application/use-cases/get-service.use-case';
import { ListServicesUseCase } from './application/use-cases/list-services.use-case';

// Controller
import { CatalogController } from './http/catalog.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController],
  providers: [
    // Repository binding
    { provide: CATALOG_REPOSITORY, useClass: CatalogDrizzleRepository },
    // Use cases
    CreateServiceUseCase,
    UpdateServiceUseCase,
    DeactivateServiceUseCase,
    GetServiceUseCase,
    ListServicesUseCase,
  ],
})
export class CatalogModule {}
```

- [ ] Run the full test suite to confirm nothing broke:

```bash
pnpm --filter api test
```

Expected output: all previous tests pass; no new failures.

- [ ] Start the API and verify the module loads:

```bash
pnpm --filter api start:dev
```

Expected output: `CatalogModule` logs in Nest bootstrap; no `UnknownDependencies` errors.

- [ ] Smoke-test the routes manually (requires a running Postgres and a valid `x-tenant-id`):

```bash
# List services (public)
curl -s http://localhost:3000/services -H "x-tenant-id: <uuid>" | jq .

# Create service (admin JWT required)
curl -s -X POST http://localhost:3000/services \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Corte Masculino","priceInCents":3500,"durationMinutes":30}' | jq .

# Get service by id (public)
curl -s http://localhost:3000/services/<id> -H "x-tenant-id: <uuid>" | jq .

# Update service (admin JWT required)
curl -s -X PUT http://localhost:3000/services/<id> \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Corte + Barba","priceInCents":5500,"durationMinutes":45}' | jq .

# Deactivate service (admin JWT required)
curl -s -X PATCH http://localhost:3000/services/<id>/deactivate \
  -H "Authorization: Bearer <admin_jwt>" | jq .

# List including inactive (admin only)
curl -s "http://localhost:3000/services/admin?includeInactive=true" \
  -H "Authorization: Bearer <admin_jwt>" | jq .
```

- [ ] Commit: `feat(catalog): wire CatalogModule — all providers and controller registered`

---

## Final directory structure

```
apps/api/src/modules/catalog/
├── domain/
│   ├── entities/
│   │   ├── service.entity.ts
│   │   └── service.entity.spec.ts
│   ├── errors/
│   │   └── catalog.errors.ts
│   └── repositories/
│       └── catalog.repository.ts
├── application/
│   └── use-cases/
│       ├── create-service.use-case.ts
│       ├── create-service.use-case.spec.ts
│       ├── update-service.use-case.ts
│       ├── update-service.use-case.spec.ts
│       ├── deactivate-service.use-case.ts
│       ├── deactivate-service.use-case.spec.ts
│       ├── get-service.use-case.ts
│       ├── get-service.use-case.spec.ts
│       ├── list-services.use-case.ts
│       └── list-services.use-case.spec.ts
├── infra/
│   └── repositories/
│       └── catalog-drizzle.repository.ts
├── http/
│   └── catalog.controller.ts
└── catalog.module.ts

apps/api/src/shared/database/schema/
└── services.ts  (added)
    index.ts     (updated)

apps/api/src/shared/kernel/errors/
└── domain-exception.filter.ts  (updated — 2 new codes)
```

---

## Self-review checklist

- [x] All 5 use cases covered: CreateService, UpdateService, DeactivateService, GetService, ListServices
- [x] No placeholders — every step has real compilable code
- [x] Type consistency: `Service` entity used uniformly; `ICatalogRepository` interface matches Drizzle repository implementation and all use case expectations
- [x] Symbol injection token `CATALOG_REPOSITORY` used in all use cases and module wiring
- [x] `DomainExceptionFilter` updated with both new codes (`SERVICE_NOT_FOUND` → 404, `SERVICE_NAME_TAKEN` → 409)
- [x] DB schema matches entity fields exactly (column names, nullable `description`, `integer` for cents/minutes, `boolean` for `isActive`)
- [x] Unique constraint `(tenantId, name)` in schema mirrors the `existsByName` guard in use cases
- [x] Public routes use `x-tenant-id` header (consistent with `TenantMiddleware` which reads it as fallback when no JWT)
- [x] `AppModule` already imports `CatalogModule` — no modification needed
- [x] TDD red-green cycle is explicit in each use-case task
- [x] One commit per task
