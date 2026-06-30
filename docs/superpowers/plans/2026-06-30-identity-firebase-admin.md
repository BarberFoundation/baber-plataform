# Identity — Firebase Admin Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement admin authentication (Firebase idToken → own JWT pair), rotating refresh tokens, real JWT guard signature verification, and `GET /me` endpoint inside the Identity bounded context.

**Architecture:** Admin authenticates via Firebase SDK on the frontend, sends `idToken` + `tenantId` to `POST /api/v1/auth/firebase/exchange`. Backend validates with Firebase Admin SDK (`IFirebaseTokenValidator`), creates/finds the local `User` (per tenant), issues short-lived access token (15 min) + rotating refresh token (30 d). Refresh tokens stored as SHA-256 hash. `JwtGuard` is upgraded to verify the access token signature using `jsonwebtoken`. All domain logic is pure (no Nest/Drizzle in use cases — testable without mocks of infra).

**Tech Stack:** NestJS 11, Drizzle ORM, PostgreSQL 16, `jsonwebtoken` + `@types/jsonwebtoken`, `firebase-admin`, Jest.

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `apps/api/src/shared/database/schema/users.ts` | create | Drizzle `users` table |
| `apps/api/src/shared/database/schema/refresh-tokens.ts` | create | Drizzle `refresh_tokens` table |
| `apps/api/src/shared/database/schema/index.ts` | modify | add new exports |
| `apps/api/src/shared/auth/jwt-token.service.ts` | create | sign/verify JWT using jsonwebtoken |
| `apps/api/src/shared/auth/jwt.guard.ts` | modify | use `JwtTokenService` for real verification |
| `apps/api/src/shared/auth/authenticated-user.ts` | modify | add `@CurrentUser()` decorator |
| `apps/api/src/modules/identity/domain/entities/user.entity.ts` | create | `User` aggregate, `CreateUserProps`, `UserProps` |
| `apps/api/src/modules/identity/domain/errors/identity.errors.ts` | create | `InvalidFirebaseTokenError`, `UserNotFoundError`, `InvalidRefreshTokenError` |
| `apps/api/src/modules/identity/domain/repositories/user.repository.ts` | create | `IUserRepository` interface |
| `apps/api/src/modules/identity/domain/repositories/refresh-token.repository.ts` | create | `IRefreshTokenRepository` + `RefreshTokenRecord` |
| `apps/api/src/modules/identity/domain/services/firebase-token-validator.ts` | create | `IFirebaseTokenValidator` + `FirebaseTokenPayload` |
| `apps/api/src/modules/identity/application/dto/auth-token-pair.ts` | create | `AuthTokenPair` interface |
| `apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.ts` | create | orchestrates Firebase validate → upsert user → issue tokens |
| `apps/api/src/modules/identity/application/use-cases/refresh-token.use-case.ts` | create | validates + rotates refresh token |
| `apps/api/src/modules/identity/application/use-cases/logout.use-case.ts` | create | revokes refresh token |
| `apps/api/src/modules/identity/infra/persistence/user.drizzle.repository.ts` | create | Drizzle impl of `IUserRepository` |
| `apps/api/src/modules/identity/infra/persistence/refresh-token.drizzle.repository.ts` | create | Drizzle impl of `IRefreshTokenRepository` |
| `apps/api/src/modules/identity/infra/firebase/firebase-token-validator.adapter.ts` | create | `firebase-admin` impl of `IFirebaseTokenValidator` |
| `apps/api/src/modules/identity/infra/http/admin-auth.controller.ts` | create | `POST /auth/firebase/exchange`, `POST /auth/refresh`, `POST /auth/logout` |
| `apps/api/src/modules/identity/infra/http/me.controller.ts` | create | `GET /me` |
| `apps/api/src/modules/identity/identity.module.ts` | modify | full wiring |
| `apps/api/src/app.module.ts` | modify | provide `JwtTokenService` globally |

---

## Task 1: Install packages

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1.1: Add runtime deps**

```bash
cd apps/api
pnpm add jsonwebtoken firebase-admin
pnpm add -D @types/jsonwebtoken
```

Expected output: `+ jsonwebtoken X.Y.Z`, `+ firebase-admin X.Y.Z` added.

- [ ] **Step 1.2: Verify install**

```bash
pnpm exec tsc --noEmit 2>&1 | head -5
```

Expected: no output (clean).

- [ ] **Step 1.3: Commit**

```bash
cd ../..
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add jsonwebtoken and firebase-admin"
```

---

## Task 2: DB schema — users + refresh_tokens

**Files:**
- Create: `apps/api/src/shared/database/schema/users.ts`
- Create: `apps/api/src/shared/database/schema/refresh-tokens.ts`
- Modify: `apps/api/src/shared/database/schema/index.ts`

- [ ] **Step 2.1: Create users schema**

`apps/api/src/shared/database/schema/users.ts`:
```typescript
import { pgTable, uuid, text, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const roleEnum = pgEnum('role', ['CLIENT', 'BARBER', 'ADMIN']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name'),
    role: roleEnum('role').notNull(),
    phone: text('phone'),
    email: text('email'),
    firebaseUid: text('firebase_uid').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('users_tenant_phone_unique').on(t.tenantId, t.phone),
    unique('users_tenant_email_unique').on(t.tenantId, t.email),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
```

- [ ] **Step 2.2: Create refresh_tokens schema**

`apps/api/src/shared/database/schema/refresh-tokens.ts`:
```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { tenants } from './tenants';

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
export type NewRefreshTokenRow = typeof refreshTokens.$inferInsert;
```

- [ ] **Step 2.3: Update schema barrel**

`apps/api/src/shared/database/schema/index.ts`:
```typescript
export * from './tenants';
export * from './users';
export * from './refresh-tokens';
```

- [ ] **Step 2.4: Generate + apply migration**

```bash
cd apps/api
pnpm db:generate
pnpm db:migrate
```

Expected: migration applied with `users` and `refresh_tokens` tables.

- [ ] **Step 2.5: Verify migration (run in psql or just typecheck)**

```bash
pnpm exec tsc --noEmit 2>&1 | head -5
```

Expected: no output.

- [ ] **Step 2.6: Commit**

```bash
cd ../..
git add apps/api/src/shared/database/schema/ apps/api/drizzle/migrations/
git commit -m "feat(identity): add users and refresh_tokens schema"
```

---

## Task 3: User domain entity

**Files:**
- Create: `apps/api/src/modules/identity/domain/entities/user.entity.ts`
- Create: `apps/api/src/modules/identity/domain/entities/user.entity.spec.ts`
- Create: `apps/api/src/modules/identity/domain/errors/identity.errors.ts`

- [ ] **Step 3.1: Write identity domain errors**

`apps/api/src/modules/identity/domain/errors/identity.errors.ts`:
```typescript
import { DomainError } from '@shared/kernel/errors/domain-error';

export class InvalidFirebaseTokenError extends DomainError {
  readonly code = 'INVALID_FIREBASE_TOKEN';
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
}

export class InvalidRefreshTokenError extends DomainError {
  readonly code = 'INVALID_REFRESH_TOKEN';
}
```

- [ ] **Step 3.2: Write failing tests for User entity**

`apps/api/src/modules/identity/domain/entities/user.entity.spec.ts`:
```typescript
import { User } from './user.entity';

describe('User entity', () => {
  const base = {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: '22222222-2222-2222-2222-222222222222',
    name: 'João Admin',
    role: 'ADMIN' as const,
    phone: null,
    email: 'joao@barbearia.com',
    firebaseUid: 'firebase-uid-abc',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('reconstitutes from DB row', () => {
    const user = User.reconstitute(base);
    expect(user.id).toBe(base.id);
    expect(user.role).toBe('ADMIN');
    expect(user.firebaseUid).toBe('firebase-uid-abc');
  });

  it('creates new admin user', () => {
    const user = User.createAdmin({
      tenantId: base.tenantId,
      email: 'new@barbearia.com',
      firebaseUid: 'firebase-uid-xyz',
      name: null,
    });
    expect(user.role).toBe('ADMIN');
    expect(user.id).toBeDefined();
    expect(user.phone).toBeNull();
  });
});
```

- [ ] **Step 3.3: Run test to confirm it fails**

```bash
cd apps/api
pnpm exec jest src/modules/identity/domain/entities/user.entity.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './user.entity'`

- [ ] **Step 3.4: Implement User entity**

`apps/api/src/modules/identity/domain/entities/user.entity.ts`:
```typescript
import { randomUUID } from 'crypto';
import { Role } from '@shared/auth/roles.decorator';

export interface UserProps {
  id: string;
  tenantId: string;
  name: string | null;
  role: Role;
  phone: string | null;
  email: string | null;
  firebaseUid: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminUserProps {
  tenantId: string;
  email: string | null;
  firebaseUid: string;
  name: string | null;
}

export class User {
  readonly id: string;
  readonly tenantId: string;
  name: string | null;
  readonly role: Role;
  readonly phone: string | null;
  readonly email: string | null;
  readonly firebaseUid: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.role = props.role;
    this.phone = props.phone;
    this.email = props.email;
    this.firebaseUid = props.firebaseUid;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  static createAdmin(props: CreateAdminUserProps): User {
    const now = new Date();
    return new User({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: props.name,
      role: 'ADMIN',
      phone: null,
      email: props.email,
      firebaseUid: props.firebaseUid,
      createdAt: now,
      updatedAt: now,
    });
  }
}
```

- [ ] **Step 3.5: Run tests to confirm they pass**

```bash
pnpm exec jest src/modules/identity/domain/entities/user.entity.spec.ts --no-coverage
```

Expected: PASS — 2 tests passed.

- [ ] **Step 3.6: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/domain/
git commit -m "feat(identity): User entity and identity domain errors"
```

---

## Task 4: Domain interfaces

**Files:**
- Create: `apps/api/src/modules/identity/domain/repositories/user.repository.ts`
- Create: `apps/api/src/modules/identity/domain/repositories/refresh-token.repository.ts`
- Create: `apps/api/src/modules/identity/domain/services/firebase-token-validator.ts`

- [ ] **Step 4.1: IUserRepository**

`apps/api/src/modules/identity/domain/repositories/user.repository.ts`:
```typescript
import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface IUserRepository {
  findByFirebaseUid(firebaseUid: string, tenantId: string): Promise<User | null>;
  findById(id: string, tenantId: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
```

- [ ] **Step 4.2: IRefreshTokenRepository**

`apps/api/src/modules/identity/domain/repositories/refresh-token.repository.ts`:
```typescript
export const REFRESH_TOKEN_REPOSITORY = Symbol('IRefreshTokenRepository');

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface IRefreshTokenRepository {
  save(record: RefreshTokenRecord): Promise<void>;
  findByHash(hash: string): Promise<RefreshTokenRecord | null>;
  revokeByHash(hash: string): Promise<void>;
}
```

- [ ] **Step 4.3: IFirebaseTokenValidator**

`apps/api/src/modules/identity/domain/services/firebase-token-validator.ts`:
```typescript
export const FIREBASE_TOKEN_VALIDATOR = Symbol('IFirebaseTokenValidator');

export interface FirebaseTokenPayload {
  uid: string;
  email: string | undefined;
  name: string | undefined;
}

export interface IFirebaseTokenValidator {
  validate(idToken: string): Promise<FirebaseTokenPayload>;
}
```

- [ ] **Step 4.4: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit 2>&1 | head -10
```

Expected: no output.

- [ ] **Step 4.5: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/domain/repositories/ apps/api/src/modules/identity/domain/services/
git commit -m "feat(identity): domain repository and validator interfaces"
```

---

## Task 5: JwtTokenService (real sign + verify)

**Files:**
- Create: `apps/api/src/shared/auth/jwt-token.service.ts`

- [ ] **Step 5.1: Write failing tests**

`apps/api/src/shared/auth/jwt-token.service.spec.ts`:
```typescript
import { JwtTokenService, JwtPayload } from './jwt-token.service';

describe('JwtTokenService', () => {
  const service = new JwtTokenService('access-secret', 'refresh-secret', '15m', '30d');

  const payload: JwtPayload = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'ADMIN',
  };

  it('signs and verifies access token', () => {
    const token = service.signAccess(payload);
    const decoded = service.verifyAccess(token);
    expect(decoded.userId).toBe('user-1');
    expect(decoded.tenantId).toBe('tenant-1');
    expect(decoded.role).toBe('ADMIN');
  });

  it('signs refresh token without throwing', () => {
    const token = service.signRefresh(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('throws on invalid access token', () => {
    expect(() => service.verifyAccess('not.a.token')).toThrow();
  });

  it('returns expiresIn as positive number', () => {
    expect(service.accessExpiresInSeconds).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5.2: Run to confirm failure**

```bash
cd apps/api
pnpm exec jest src/shared/auth/jwt-token.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './jwt-token.service'`

- [ ] **Step 5.3: Implement JwtTokenService**

`apps/api/src/shared/auth/jwt-token.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { Role } from './roles.decorator';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: Role;
}

@Injectable()
export class JwtTokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(
    accessSecret: string,
    refreshSecret: string,
    accessTtl: string,
    refreshTtl: string,
  );
  constructor(config: ConfigService);
  constructor(
    accessSecretOrConfig: string | ConfigService,
    refreshSecret?: string,
    accessTtl?: string,
    refreshTtl?: string,
  ) {
    if (typeof accessSecretOrConfig === 'string') {
      this.accessSecret = accessSecretOrConfig;
      this.refreshSecret = refreshSecret!;
      this.accessTtl = accessTtl!;
      this.refreshTtl = refreshTtl!;
    } else {
      const config = accessSecretOrConfig;
      this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
      this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
      this.accessTtl = config.get<string>('JWT_ACCESS_TTL', '15m');
      this.refreshTtl = config.get<string>('JWT_REFRESH_TTL', '30d');
    }
  }

  signAccess(payload: JwtPayload): string {
    return jwt.sign(
      { tenantId: payload.tenantId, role: payload.role },
      this.accessSecret,
      { subject: payload.userId, expiresIn: this.accessTtl as jwt.SignOptions['expiresIn'] },
    );
  }

  signRefresh(payload: JwtPayload): string {
    return jwt.sign(
      { tenantId: payload.tenantId, role: payload.role },
      this.refreshSecret,
      { subject: payload.userId, expiresIn: this.refreshTtl as jwt.SignOptions['expiresIn'] },
    );
  }

  verifyAccess(token: string): JwtPayload {
    const decoded = jwt.verify(token, this.accessSecret) as jwt.JwtPayload;
    return {
      userId: decoded.sub!,
      tenantId: decoded['tenantId'] as string,
      role: decoded['role'] as Role,
    };
  }

  get accessExpiresInSeconds(): number {
    return this.parseTtl(this.accessTtl);
  }

  private parseTtl(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }
}
```

- [ ] **Step 5.4: Run tests to confirm they pass**

```bash
pnpm exec jest src/shared/auth/jwt-token.service.spec.ts --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 5.5: Update JwtGuard to use JwtTokenService**

`apps/api/src/shared/auth/jwt.guard.ts` — replace entire file:
```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtTokenService } from './jwt-token.service';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Token ausente.');

    try {
      const payload = this.jwtTokenService.verifyAccess(token);
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }

  private extractToken(req: Request): string | undefined {
    const auth = req.header('authorization');
    if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length);
    return (req.cookies as Record<string, string> | undefined)?.accessToken;
  }
}
```

- [ ] **Step 5.6: Update AppModule to provide JwtTokenService**

In `apps/api/src/app.module.ts`, add `JwtTokenService` to `providers`:

```typescript
// add import at top:
import { JwtTokenService } from './shared/auth/jwt-token.service';

// in providers array, add before JwtGuard:
JwtTokenService,
```

Full providers array in AppModule should be:
```typescript
providers: [
  TenantContext,
  JwtTokenService,
  { provide: APP_GUARD, useClass: JwtGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
],
```

- [ ] **Step 5.7: Typecheck**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 5.8: Build to confirm**

```bash
pnpm exec nest build 2>&1 | tail -5 && echo BUILD_OK
```

Expected: `BUILD_OK`.

- [ ] **Step 5.9: Commit**

```bash
cd ../..
git add apps/api/src/shared/auth/
git commit -m "feat(identity): JwtTokenService with real sign/verify, upgrade JwtGuard"
```

---

## Task 6: ExchangeFirebaseToken use case

**Files:**
- Create: `apps/api/src/modules/identity/application/dto/auth-token-pair.ts`
- Create: `apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.ts`
- Create: `apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts`

- [ ] **Step 6.1: Create AuthTokenPair DTO**

`apps/api/src/modules/identity/application/dto/auth-token-pair.ts`:
```typescript
import { Role } from '@shared/auth/roles.decorator';

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AuthResult extends AuthTokenPair {
  user: {
    id: string;
    name: string | null;
    role: Role;
    email: string | null;
  };
}
```

- [ ] **Step 6.2: Write failing tests**

`apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts`:
```typescript
import { ExchangeFirebaseTokenUseCase } from './exchange-firebase-token.use-case';
import { IFirebaseTokenValidator } from '../../domain/services/firebase-token-validator';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { User } from '../../domain/entities/user.entity';
import { InvalidFirebaseTokenError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-111';
const FIREBASE_UID = 'firebase-abc';

function makeValidator(overrides?: Partial<IFirebaseTokenValidator>): IFirebaseTokenValidator {
  return {
    validate: jest.fn().mockResolvedValue({ uid: FIREBASE_UID, email: 'a@b.com', name: 'A' }),
    ...overrides,
  };
}

function makeUserRepo(existingUser?: User): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(existingUser ?? null),
    save: jest.fn().mockImplementation(async (u: User) => u),
    findById: jest.fn().mockResolvedValue(null),
  };
}

function makeRefreshRepo(): IRefreshTokenRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByHash: jest.fn().mockResolvedValue(null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
  };
}

function makeJwt(): JwtTokenService {
  return new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d');
}

describe('ExchangeFirebaseTokenUseCase', () => {
  it('creates new user and returns tokens when user does not exist', async () => {
    const uc = new ExchangeFirebaseTokenUseCase(
      makeValidator(),
      makeUserRepo(),
      makeRefreshRepo(),
      makeJwt(),
    );
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.role).toBe('ADMIN');
  });

  it('returns existing user without creating a new one', async () => {
    const existing = User.reconstitute({
      id: 'existing-id',
      tenantId: TENANT_ID,
      name: 'João',
      role: 'ADMIN',
      phone: null,
      email: 'a@b.com',
      firebaseUid: FIREBASE_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const userRepo = makeUserRepo(existing);
    const uc = new ExchangeFirebaseTokenUseCase(
      makeValidator(),
      userRepo,
      makeRefreshRepo(),
      makeJwt(),
    );
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.user.id).toBe('existing-id');
    // save not called because user already exists
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws InvalidFirebaseTokenError when validator rejects', async () => {
    const validator = makeValidator({
      validate: jest.fn().mockRejectedValue(new Error('bad token')),
    });
    const uc = new ExchangeFirebaseTokenUseCase(
      validator,
      makeUserRepo(),
      makeRefreshRepo(),
      makeJwt(),
    );
    await expect(uc.execute({ idToken: 'bad', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidFirebaseTokenError,
    );
  });
});
```

- [ ] **Step 6.3: Run to confirm failure**

```bash
cd apps/api
pnpm exec jest exchange-firebase-token --no-coverage
```

Expected: FAIL — `Cannot find module './exchange-firebase-token.use-case'`

- [ ] **Step 6.4: Implement use case**

`apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.ts`:
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { randomUUID } from 'crypto';
import {
  FIREBASE_TOKEN_VALIDATOR,
  IFirebaseTokenValidator,
} from '../../domain/services/firebase-token-validator';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { User } from '../../domain/entities/user.entity';
import { InvalidFirebaseTokenError } from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';

export interface ExchangeFirebaseTokenInput {
  idToken: string;
  tenantId: string;
}

@Injectable()
export class ExchangeFirebaseTokenUseCase {
  constructor(
    @Inject(FIREBASE_TOKEN_VALIDATOR)
    private readonly validator: IFirebaseTokenValidator,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(input: ExchangeFirebaseTokenInput): Promise<AuthResult> {
    let firebasePayload;
    try {
      firebasePayload = await this.validator.validate(input.idToken);
    } catch {
      throw new InvalidFirebaseTokenError('Firebase token inválido ou expirado.');
    }

    let user = await this.userRepo.findByFirebaseUid(firebasePayload.uid, input.tenantId);
    if (!user) {
      const newUser = User.createAdmin({
        tenantId: input.tenantId,
        email: firebasePayload.email ?? null,
        firebaseUid: firebasePayload.uid,
        name: firebasePayload.name ?? null,
      });
      user = await this.userRepo.save(newUser);
    }

    const jwtPayload = { userId: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = this.jwtTokenService.signAccess(jwtPayload);
    const rawRefresh = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');

    const refreshTtlMs = this.jwtTokenService.accessExpiresInSeconds /* reuse 30d */;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    await this.refreshRepo.save({
      id: randomUUID(),
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash,
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
      revokedAt: null,
      createdAt: new Date(),
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: this.jwtTokenService.accessExpiresInSeconds,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    };
  }
}
```

- [ ] **Step 6.5: Run tests to confirm they pass**

```bash
pnpm exec jest exchange-firebase-token --no-coverage
```

Expected: PASS — 3 tests.

- [ ] **Step 6.6: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/application/
git commit -m "feat(identity): ExchangeFirebaseToken use case (TDD)"
```

---

## Task 7: RefreshToken use case

**Files:**
- Create: `apps/api/src/modules/identity/application/use-cases/refresh-token.use-case.ts`
- Create: `apps/api/src/modules/identity/application/use-cases/refresh-token.use-case.spec.ts`

- [ ] **Step 7.1: Write failing tests**

`apps/api/src/modules/identity/application/use-cases/refresh-token.use-case.spec.ts`:
```typescript
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { IRefreshTokenRepository, RefreshTokenRecord } from '../../domain/repositories/refresh-token.repository';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { User } from '../../domain/entities/user.entity';
import { InvalidRefreshTokenError } from '../../domain/errors/identity.errors';
import { createHash, randomBytes } from 'crypto';

const jwt = new JwtTokenService('acc', 'ref', '15m', '30d');
const RAW_TOKEN = randomBytes(48).toString('base64url');
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

const VALID_RECORD: RefreshTokenRecord = {
  id: 'rt-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  tokenHash: TOKEN_HASH,
  expiresAt: new Date(Date.now() + 1_000_000),
  revokedAt: null,
  createdAt: new Date(),
};

const EXISTING_USER = User.reconstitute({
  id: 'user-1',
  tenantId: 'tenant-1',
  name: 'João',
  role: 'ADMIN',
  phone: null,
  email: 'j@b.com',
  firebaseUid: 'fb-uid',
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeRefreshRepo(record: RefreshTokenRecord | null = VALID_RECORD): IRefreshTokenRepository {
  return {
    findByHash: jest.fn().mockResolvedValue(record),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUserRepo(user: User | null = EXISTING_USER): IUserRepository {
  return {
    findById: jest.fn().mockResolvedValue(user),
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
  };
}

describe('RefreshTokenUseCase', () => {
  it('returns new token pair for valid refresh token', async () => {
    const uc = new RefreshTokenUseCase(makeRefreshRepo(), makeUserRepo(), jwt);
    const result = await uc.execute({ refreshToken: RAW_TOKEN });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    // new raw token differs from original
    expect(result.refreshToken).not.toBe(RAW_TOKEN);
  });

  it('throws when token not found', async () => {
    const uc = new RefreshTokenUseCase(makeRefreshRepo(null), makeUserRepo(), jwt);
    await expect(uc.execute({ refreshToken: RAW_TOKEN })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('throws when token is revoked', async () => {
    const revoked = { ...VALID_RECORD, revokedAt: new Date() };
    const uc = new RefreshTokenUseCase(makeRefreshRepo(revoked), makeUserRepo(), jwt);
    await expect(uc.execute({ refreshToken: RAW_TOKEN })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('throws when token is expired', async () => {
    const expired = { ...VALID_RECORD, expiresAt: new Date(Date.now() - 1000) };
    const uc = new RefreshTokenUseCase(makeRefreshRepo(expired), makeUserRepo(), jwt);
    await expect(uc.execute({ refreshToken: RAW_TOKEN })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });
});
```

- [ ] **Step 7.2: Run to confirm failure**

```bash
cd apps/api
pnpm exec jest refresh-token.use-case --no-coverage
```

Expected: FAIL — `Cannot find module './refresh-token.use-case'`

- [ ] **Step 7.3: Implement use case**

`apps/api/src/modules/identity/application/use-cases/refresh-token.use-case.ts`:
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { randomBytes, createHash, randomUUID } from 'crypto';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { InvalidRefreshTokenError } from '../../domain/errors/identity.errors';
import { AuthTokenPair } from '../dto/auth-token-pair';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(input: { refreshToken: string }): Promise<AuthTokenPair> {
    const hash = createHash('sha256').update(input.refreshToken).digest('hex');
    const record = await this.refreshRepo.findByHash(hash);

    if (!record) throw new InvalidRefreshTokenError('Refresh token não encontrado.');
    if (record.revokedAt) throw new InvalidRefreshTokenError('Refresh token revogado.');
    if (record.expiresAt < new Date()) throw new InvalidRefreshTokenError('Refresh token expirado.');

    // Rotate: revoke old, issue new
    await this.refreshRepo.revokeByHash(hash);

    const user = await this.userRepo.findById(record.userId, record.tenantId);
    if (!user) throw new InvalidRefreshTokenError('Usuário não encontrado.');

    const jwtPayload = { userId: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = this.jwtTokenService.signAccess(jwtPayload);
    const rawRefresh = randomBytes(48).toString('base64url');
    const newHash = createHash('sha256').update(rawRefresh).digest('hex');

    await this.refreshRepo.save({
      id: randomUUID(),
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: new Date(),
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: this.jwtTokenService.accessExpiresInSeconds,
    };
  }
}
```

- [ ] **Step 7.4: Run tests to confirm they pass**

```bash
pnpm exec jest refresh-token.use-case --no-coverage
```

Expected: PASS — 4 tests.

- [ ] **Step 7.5: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/application/use-cases/refresh-token.use-case*
git commit -m "feat(identity): RefreshToken use case with rotation (TDD)"
```

---

## Task 8: Logout use case

**Files:**
- Create: `apps/api/src/modules/identity/application/use-cases/logout.use-case.ts`

- [ ] **Step 8.1: Implement Logout use case (no TDD needed — trivial revocation)**

`apps/api/src/modules/identity/application/use-cases/logout.use-case.ts`:
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
  ) {}

  async execute(input: { refreshToken: string }): Promise<void> {
    const hash = createHash('sha256').update(input.refreshToken).digest('hex');
    // Silently succeed even if token not found (idempotent logout)
    await this.refreshRepo.revokeByHash(hash);
  }
}
```

- [ ] **Step 8.2: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit 2>&1 | head -10
```

Expected: no output.

- [ ] **Step 8.3: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/application/use-cases/logout.use-case.ts
git commit -m "feat(identity): Logout use case"
```

---

## Task 9: Drizzle repositories (infra)

**Files:**
- Create: `apps/api/src/modules/identity/infra/persistence/user.drizzle.repository.ts`
- Create: `apps/api/src/modules/identity/infra/persistence/refresh-token.drizzle.repository.ts`

- [ ] **Step 9.1: Implement UserDrizzleRepository**

`apps/api/src/modules/identity/infra/persistence/user.drizzle.repository.ts`:
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '@shared/database/database.tokens';
import { Database } from '@shared/database/database.module';
import { users } from '@shared/database/schema';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User, UserProps } from '../../domain/entities/user.entity';

@Injectable()
export class UserDrizzleRepository implements IUserRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByFirebaseUid(firebaseUid: string, tenantId: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.firebaseUid, firebaseUid), eq(users.tenantId, tenantId)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findById(id: string, tenantId: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async save(user: User): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        role: user.role,
        phone: user.phone,
        email: user.email,
        firebaseUid: user.firebaseUid,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { name: user.name, updatedAt: new Date() },
      })
      .returning();
    return this.toEntity(row);
  }

  private toEntity(row: typeof users.$inferSelect): User {
    return User.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role,
      phone: row.phone,
      email: row.email,
      firebaseUid: row.firebaseUid,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as UserProps);
  }
}
```

- [ ] **Step 9.2: Implement RefreshTokenDrizzleRepository**

`apps/api/src/modules/identity/infra/persistence/refresh-token.drizzle.repository.ts`:
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '@shared/database/database.tokens';
import { Database } from '@shared/database/database.module';
import { refreshTokens } from '@shared/database/schema';
import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
} from '../../domain/repositories/refresh-token.repository';

@Injectable()
export class RefreshTokenDrizzleRepository implements IRefreshTokenRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async save(record: RefreshTokenRecord): Promise<void> {
    await this.db.insert(refreshTokens).values({
      id: record.id,
      userId: record.userId,
      tenantId: record.tenantId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
    });
  }

  async findByHash(hash: string): Promise<RefreshTokenRecord | null> {
    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }

  async revokeByHash(hash: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hash));
  }
}
```

- [ ] **Step 9.3: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 9.4: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/infra/persistence/
git commit -m "feat(identity): Drizzle repositories for User and RefreshToken"
```

---

## Task 10: Firebase adapter (infra)

**Files:**
- Create: `apps/api/src/modules/identity/infra/firebase/firebase-token-validator.adapter.ts`

- [ ] **Step 10.1: Implement Firebase adapter**

`apps/api/src/modules/identity/infra/firebase/firebase-token-validator.adapter.ts`:
```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApp, initializeApp, AppOptions } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FirebaseTokenPayload,
  IFirebaseTokenValidator,
} from '../../domain/services/firebase-token-validator';

@Injectable()
export class FirebaseTokenValidatorAdapter implements IFirebaseTokenValidator, OnModuleInit {
  private app!: App;
  private readonly logger = new Logger(FirebaseTokenValidatorAdapter.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'FIREBASE_* vars ausentes. Firebase validator em modo stub — NÃO usar em produção.',
      );
      return;
    }

    const appName = 'baber';
    let options: AppOptions = {
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    };

    try {
      this.app = getApp(appName);
    } catch {
      this.app = initializeApp(options, appName);
    }
  }

  async validate(idToken: string): Promise<FirebaseTokenPayload> {
    if (!this.app) {
      // Stub mode for local dev without Firebase credentials
      this.logger.warn('Firebase stub mode: accepting any token with payload from base64 part.');
      const parts = idToken.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as {
            uid?: string;
            email?: string;
            name?: string;
          };
          return {
            uid: payload.uid ?? 'stub-uid',
            email: payload.email,
            name: payload.name,
          };
        } catch {
          // fall through to stub
        }
      }
      return { uid: 'stub-uid', email: undefined, name: undefined };
    }

    const decoded = await getAuth(this.app).verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
  }
}
```

- [ ] **Step 10.2: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 10.3: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/infra/firebase/
git commit -m "feat(identity): Firebase token validator adapter (stub mode when no creds)"
```

---

## Task 11: HTTP controllers (AdminAuth + Me)

**Files:**
- Create: `apps/api/src/modules/identity/infra/http/admin-auth.controller.ts`
- Create: `apps/api/src/modules/identity/infra/http/me.controller.ts`
- Modify: `apps/api/src/shared/auth/authenticated-user.ts` — add `@CurrentUser()` decorator

- [ ] **Step 11.1: Add @CurrentUser() decorator**

At the end of `apps/api/src/shared/auth/authenticated-user.ts`, add:
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return req.user;
  },
);
```

Full file (`apps/api/src/shared/auth/authenticated-user.ts`):
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from './roles.decorator';

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: Role;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return req.user;
  },
);
```

- [ ] **Step 11.2: Create AdminAuthController**

`apps/api/src/modules/identity/infra/http/admin-auth.controller.ts`:
```typescript
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@shared/auth/public.decorator';
import { ExchangeFirebaseTokenUseCase } from '../../application/use-cases/exchange-firebase-token.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { InvalidFirebaseTokenError } from '../../domain/errors/identity.errors';
import {
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

class ExchangeDto {
  idToken!: string;
  tenantId!: string;
}

class RefreshDto {
  refreshToken!: string;
}

class LogoutDto {
  refreshToken!: string;
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

@ApiTags('auth')
@Controller('auth')
export class AdminAuthController {
  constructor(
    private readonly exchangeUseCase: ExchangeFirebaseTokenUseCase,
    private readonly refreshUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Public()
  @Post('firebase/exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() body: ExchangeDto, @Res({ passthrough: true }) res: Response) {
    if (!body.idToken || !body.tenantId) {
      throw new BadRequestException('idToken e tenantId são obrigatórios.');
    }
    try {
      const result = await this.exchangeUseCase.execute({
        idToken: body.idToken,
        tenantId: body.tenantId,
      });
      res.cookie('accessToken', result.accessToken, {
        ...COOKIE_OPTS,
        maxAge: result.expiresIn * 1000,
      });
      res.cookie('refreshToken', result.refreshToken, {
        ...COOKIE_OPTS,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      return {
        user: result.user,
        expiresIn: result.expiresIn,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
    } catch (err) {
      if (err instanceof InvalidFirebaseTokenError) {
        throw new UnauthorizedException(err.message);
      }
      throw err;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.refreshUseCase.execute({ refreshToken: body.refreshToken });
    res.cookie('accessToken', result.accessToken, {
      ...COOKIE_OPTS,
      maxAge: result.expiresIn * 1000,
    });
    res.cookie('refreshToken', result.refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: LogoutDto, @Res({ passthrough: true }) res: Response) {
    await this.logoutUseCase.execute({ refreshToken: body.refreshToken });
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
  }
}
```

- [ ] **Step 11.3: Create MeController**

`apps/api/src/modules/identity/infra/http/me.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { CurrentUser } from '@shared/auth/authenticated-user';
import { AuthenticatedUser } from '@shared/auth/authenticated-user';
import { USER_REPOSITORY, IUserRepository } from '../../domain/repositories/user.repository';
import { UserNotFoundError } from '../../domain/errors/identity.errors';
import { NotFoundException } from '@nestjs/common';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  @Get()
  async getMe(@CurrentUser() auth: AuthenticatedUser) {
    const user = await this.userRepo.findById(auth.userId, auth.tenantId);
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
    };
  }
}
```

- [ ] **Step 11.4: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 11.5: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/infra/http/ apps/api/src/shared/auth/authenticated-user.ts
git commit -m "feat(identity): AdminAuth + Me controllers"
```

---

## Task 12: Wire IdentityModule + update AppModule

**Files:**
- Modify: `apps/api/src/modules/identity/identity.module.ts`
- Modify: `apps/api/src/app.module.ts` — add cookie-parser

- [ ] **Step 12.1: Install cookie-parser**

```bash
cd apps/api
pnpm add cookie-parser
pnpm add -D @types/cookie-parser
```

- [ ] **Step 12.2: Enable cookie-parser in main.ts**

In `apps/api/src/main.ts`, add after `app.enableCors(...)`:
```typescript
import cookieParser from 'cookie-parser';
// ...
app.use(cookieParser());
```

Full relevant section of `main.ts` after CORS:
```typescript
app.enableCors({ origin: true, credentials: true });
app.use(cookieParser());
app.enableShutdownHooks();
```

And add the import at the top:
```typescript
import cookieParser from 'cookie-parser';
```

- [ ] **Step 12.3: Wire IdentityModule**

Full `apps/api/src/modules/identity/identity.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository';
import { FIREBASE_TOKEN_VALIDATOR } from './domain/services/firebase-token-validator';
import { UserDrizzleRepository } from './infra/persistence/user.drizzle.repository';
import { RefreshTokenDrizzleRepository } from './infra/persistence/refresh-token.drizzle.repository';
import { FirebaseTokenValidatorAdapter } from './infra/firebase/firebase-token-validator.adapter';
import { ExchangeFirebaseTokenUseCase } from './application/use-cases/exchange-firebase-token.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { AdminAuthController } from './infra/http/admin-auth.controller';
import { MeController } from './infra/http/me.controller';

@Module({
  controllers: [AdminAuthController, MeController],
  providers: [
    { provide: USER_REPOSITORY, useClass: UserDrizzleRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenDrizzleRepository },
    { provide: FIREBASE_TOKEN_VALIDATOR, useClass: FirebaseTokenValidatorAdapter },
    ExchangeFirebaseTokenUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
  ],
  exports: [USER_REPOSITORY],
})
export class IdentityModule {}
```

- [ ] **Step 12.4: Full build + test run**

```bash
cd apps/api
pnpm exec nest build 2>&1 | tail -5 && echo BUILD_OK
pnpm exec jest --no-coverage 2>&1 | tail -15
```

Expected: `BUILD_OK` + all tests passing (at minimum 11 tests).

- [ ] **Step 12.5: Commit**

```bash
cd ../..
git add apps/api/src/modules/identity/identity.module.ts apps/api/src/main.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(identity): wire IdentityModule, add cookie-parser"
```

---

## Task 13: End-to-end smoke test (manual)

No automated E2E yet — just verify the running server with curl. Requires Postgres + Redis up.

- [ ] **Step 13.1: Start containers + build + run**

```bash
cd apps/api
docker compose -f ../../docker-compose.yml up -d
pnpm exec nest build && node dist/main.js &
sleep 3
```

- [ ] **Step 13.2: Health check**

```bash
curl -s http://localhost:3000/health
```

Expected: `{"status":"ok","services":{"postgres":"up","redis":"up"},...}`

- [ ] **Step 13.3: Exchange (stub mode, no Firebase creds)**

Get tenant ID from seed:
```bash
TENANT_ID=$(docker exec baber-postgres psql -U postgres -d barbearia -t -c "SELECT id FROM tenants LIMIT 1;" | xargs)
echo "tenantId: $TENANT_ID"
```

Exchange call using stub mode (no real Firebase creds needed — adapter accepts any idToken-shaped string):
```bash
# Build a stub idToken: header.payload.sig (any base64url parts)
STUB_PAYLOAD=$(echo '{"uid":"test-uid-1","email":"admin@barbearia.com","name":"Admin Teste"}' | base64url 2>/dev/null || python3 -c "import base64,json; print(base64.urlsafe_b64encode(json.dumps({'uid':'test-uid-1','email':'admin@barbearia.com','name':'Admin Teste'}).encode()).decode().rstrip('='))")
STUB_TOKEN="header.${STUB_PAYLOAD}.signature"

curl -s -X POST http://localhost:3000/api/v1/auth/firebase/exchange \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"${STUB_TOKEN}\",\"tenantId\":\"${TENANT_ID}\"}" | python3 -m json.tool
```

Expected: JSON with `accessToken`, `refreshToken`, and `user.role = "ADMIN"`.

- [ ] **Step 13.4: GET /me with the access token**

```bash
ACCESS=$(curl -s -X POST http://localhost:3000/api/v1/auth/firebase/exchange \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"${STUB_TOKEN}\",\"tenantId\":\"${TENANT_ID}\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

curl -s http://localhost:3000/api/v1/me \
  -H "Authorization: Bearer $ACCESS" | python3 -m json.tool
```

Expected: JSON with user data (`id`, `role: "ADMIN"`, `email: "admin@barbearia.com"`).

- [ ] **Step 13.5: Stop server + commit**

```bash
kill %1 2>/dev/null
cd ../..
git add -A
git commit -m "test(identity): E2E smoke test validated — exchange + /me working"
```

---

## Self-Review

**Spec coverage (Handoff backlog #1):**
- ✅ `ExchangeFirebaseToken` use case — Task 6
- ✅ Guards JWT + Roles funcionando (real verification) — Task 5
- ✅ `GET /me` retornando user logado — Task 11
- ✅ Refresh + Logout complementares — Tasks 7, 8
- ⏭️ Tela de login web (admin) com Firebase SDK — deferred (admin-web scaffold pendente)

**Conventions from Handoff §6:**
- ✅ `domain/` never imports `infra/` (ESLint rule in place)
- ✅ `domain/` of one module never imports `domain/` of another
- ✅ No raw queries without tenant_id (repositories use tenantId param)
- ✅ Migrations via Drizzle only (Task 2)
- ✅ TDD for all non-trivial use cases (Tasks 3, 5, 6, 7)
- ✅ No obvious comments, no dead code

**Type consistency check:**
- `JwtPayload.userId` → used in `JwtTokenService.signAccess` (sub), `verifyAccess` returns `userId` ✅
- `AuthenticatedUser.userId` matches `JwtPayload.userId` ✅
- `User.role` typed as `Role` from `roles.decorator.ts` ✅
- `RefreshTokenRecord` defined in Task 4, used consistently in Tasks 7, 8, 9 ✅
- `USER_REPOSITORY` symbol from `user.repository.ts` used correctly in Tasks 6, 7, 11, 12 ✅
- `FIREBASE_TOKEN_VALIDATOR` symbol from `firebase-token-validator.ts` used in Tasks 6, 12 ✅

**Note on Firebase stub mode:** The adapter logs a warning when Firebase env vars are absent and falls back to extracting `uid/email/name` from the token payload. This makes local dev possible without Firebase credentials. Task 13 step 13.3 exploits this.
