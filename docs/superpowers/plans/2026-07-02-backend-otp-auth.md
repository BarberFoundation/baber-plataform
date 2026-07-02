# Backend OTP Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the client-facing OTP auth contract (`Handoff.md` §2.8) in `apps/api`'s Identity module: request/verify OTP over WhatsApp, name update on first login, and public tenant listing for the mobile app's tenant-selection screen.

**Architecture:** Extends the existing Identity bounded context (DDD: `domain/` → `application/` → `infra/` → `http/`), following the same use-case/repository patterns as the Firebase admin flow already in the codebase. Extracts a shared `TokenPairIssuer` so token issuance isn't duplicated a third time. Reuses `NotificationsModule`'s `WHATSAPP_GATEWAY` port for sending codes and the global `REDIS` provider for rate limiting.

**Tech Stack:** NestJS 11, Drizzle ORM, PostgreSQL, ioredis (via existing `REDIS` provider), Jest (plain mocks, no mocking library — matches existing test style).

**Spec:** `docs/superpowers/specs/2026-07-02-backend-otp-auth-design.md`

**Working directory for all commands in this plan:** `apps/api/`

---

### Task 1: Add `findByPhone` to `IUserRepository`

**Files:**
- Modify: `src/modules/identity/domain/repositories/user.repository.ts`
- Modify: `src/modules/identity/infra/repositories/user-drizzle.repository.ts`
- Modify: `src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts:19-25`
- Modify: `src/modules/identity/application/use-cases/refresh-token.use-case.spec.ts:52-58`

- [ ] **Step 1: Add the method to the interface**

Edit `src/modules/identity/domain/repositories/user.repository.ts`:

```ts
import { User } from '../entities/user.entity';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface IUserRepository {
  findByFirebaseUid(firebaseUid: string, tenantId: string): Promise<User | null>;
  findByPhone(phone: string, tenantId: string): Promise<User | null>;
  findById(id: string, tenantId: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
```

- [ ] **Step 2: Implement it in the Drizzle repository**

Edit `src/modules/identity/infra/repositories/user-drizzle.repository.ts`, add this method after `findByFirebaseUid` (after line 24):

```ts
  async findByPhone(phone: string, tenantId: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.phone, phone), eq(schema.users.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }
```

- [ ] **Step 3: Update existing test mock factories so they still satisfy the interface**

Edit `src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts`, replace the `makeUserRepo` function (lines 19-25):

```ts
function makeUserRepo(existingUser?: User): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(existingUser ?? null),
    findByPhone: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (u: User) => u),
    findById: jest.fn().mockResolvedValue(null),
  };
}
```

Edit `src/modules/identity/application/use-cases/refresh-token.use-case.spec.ts`, replace the `makeUserRepo` function (lines 52-58):

```ts
function makeUserRepo(user?: User | null): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(user ?? null),
    save: jest.fn().mockResolvedValue(null),
  };
}
```

- [ ] **Step 4: Run the existing identity test suite to confirm nothing broke**

Run: `pnpm --filter api test -- identity`
Expected: PASS — all existing identity tests still pass (they now compile against the wider interface).

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/domain/repositories/user.repository.ts src/modules/identity/infra/repositories/user-drizzle.repository.ts src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts src/modules/identity/application/use-cases/refresh-token.use-case.spec.ts
git commit -m "feat(identity): add findByPhone to IUserRepository"
```

---

### Task 2: Add `User.createClient` factory

**Files:**
- Modify: `src/modules/identity/domain/entities/user.entity.ts`
- Modify: `src/modules/identity/domain/entities/user.entity.spec.ts`

- [ ] **Step 1: Write the failing test**

Read the existing `src/modules/identity/domain/entities/user.entity.spec.ts` first to match its style, then add this test at the end of the file (inside the existing top-level `describe` block, or as a new one if the file uses multiple):

```ts
describe('User.createClient', () => {
  it('creates a CLIENT user with phone and no name', () => {
    const user = User.createClient({ tenantId: 'tenant-1', phone: '+5511999999999' });

    expect(user.role).toBe('CLIENT');
    expect(user.phone).toBe('+5511999999999');
    expect(user.tenantId).toBe('tenant-1');
    expect(user.name).toBeNull();
    expect(user.email).toBeNull();
    expect(user.firebaseUid).toBeNull();
    expect(user.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- user.entity`
Expected: FAIL — `User.createClient` doesn't exist.

- [ ] **Step 3: Add the factory method**

Edit `src/modules/identity/domain/entities/user.entity.ts`, add this interface after `CreateAdminUserProps` (after line 21):

```ts
export interface CreateClientUserProps {
  tenantId: string;
  phone: string;
}
```

Add this static method after `createAdmin` (after line 71, before the closing `}` of the class):

```ts
  static createClient(props: CreateClientUserProps): User {
    const now = new Date();
    return new User({
      id: randomUUID(),
      tenantId: props.tenantId,
      name: null,
      role: 'CLIENT',
      phone: props.phone,
      email: null,
      firebaseUid: null,
      createdAt: now,
      updatedAt: now,
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- user.entity`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/domain/entities/user.entity.ts src/modules/identity/domain/entities/user.entity.spec.ts
git commit -m "feat(identity): add User.createClient factory"
```

---

### Task 3: Extract `TokenPairIssuer` and refactor existing use cases onto it

**Files:**
- Create: `src/modules/identity/application/services/token-pair-issuer.ts`
- Create: `src/modules/identity/application/services/token-pair-issuer.spec.ts`
- Modify: `src/modules/identity/application/dto/auth-token-pair.ts`
- Modify: `src/modules/identity/application/use-cases/exchange-firebase-token.use-case.ts`
- Modify: `src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts`
- Modify: `src/modules/identity/application/use-cases/refresh-token.use-case.ts`
- Modify: `src/modules/identity/application/use-cases/refresh-token.use-case.spec.ts`

- [ ] **Step 1: Add `phone` to `AuthResult`**

Edit `src/modules/identity/application/dto/auth-token-pair.ts`:

```ts
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
    phone: string | null;
  };
}
```

- [ ] **Step 2: Write the failing test for `TokenPairIssuer`**

```ts
// src/modules/identity/application/services/token-pair-issuer.spec.ts
import { createHash } from 'crypto';
import { TokenPairIssuer } from './token-pair-issuer';
import { IRefreshTokenRepository, RefreshTokenRecord } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { User } from '../../domain/entities/user.entity';

const TENANT_ID = 'tenant-999';

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

function makeUser(overrides?: Partial<Parameters<typeof User.reconstitute>[0]>): User {
  return User.reconstitute({
    id: 'user-1',
    tenantId: TENANT_ID,
    name: 'Test',
    role: 'ADMIN',
    phone: null,
    email: 'a@b.com',
    firebaseUid: 'fb-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('TokenPairIssuer', () => {
  it('issues access + refresh token and saves the hashed refresh token', async () => {
    const refreshRepo = makeRefreshRepo();
    const issuer = new TokenPairIssuer(refreshRepo, makeJwt());

    const result = await issuer.issue(makeUser());

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBe(900);
    expect(result.user).toEqual({
      id: 'user-1',
      name: 'Test',
      role: 'ADMIN',
      email: 'a@b.com',
      phone: null,
    });
    const savedRecord = (refreshRepo.save as jest.Mock).mock.calls[0][0] as RefreshTokenRecord;
    expect(savedRecord.tokenHash).toBe(createHash('sha256').update(result.refreshToken).digest('hex'));
    expect(savedRecord.userId).toBe('user-1');
    expect(savedRecord.tenantId).toBe(TENANT_ID);
  });

  it('includes phone for CLIENT users', async () => {
    const issuer = new TokenPairIssuer(makeRefreshRepo(), makeJwt());

    const result = await issuer.issue(
      makeUser({ role: 'CLIENT', phone: '+5511999999999', email: null, firebaseUid: null, name: null }),
    );

    expect(result.user.phone).toBe('+5511999999999');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter api test -- token-pair-issuer`
Expected: FAIL — `token-pair-issuer.ts` doesn't exist.

- [ ] **Step 4: Implement `TokenPairIssuer`**

```ts
// src/modules/identity/application/services/token-pair-issuer.ts
import { randomBytes, createHash, randomUUID } from 'crypto';
import { Injectable, Inject } from '@nestjs/common';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { User } from '../../domain/entities/user.entity';
import { AuthResult } from '../dto/auth-token-pair';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TokenPairIssuer {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async issue(user: User): Promise<AuthResult> {
    const jwtPayload = { userId: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = this.jwtTokenService.signAccess(jwtPayload);
    const rawRefresh = randomBytes(48).toString('base64url');
    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');

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
        phone: user.phone,
      },
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter api test -- token-pair-issuer`
Expected: PASS (2 tests).

- [ ] **Step 6: Refactor `ExchangeFirebaseTokenUseCase` to use `TokenPairIssuer`**

Replace `src/modules/identity/application/use-cases/exchange-firebase-token.use-case.ts` entirely with:

```ts
import { Injectable, Inject } from '@nestjs/common';
import {
  FIREBASE_TOKEN_VALIDATOR,
  IFirebaseTokenValidator,
  FirebaseTokenPayload,
} from '../../domain/services/firebase-token-validator';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { InvalidFirebaseTokenError } from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';

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
    private readonly tokenPairIssuer: TokenPairIssuer,
  ) {}

  async execute(input: ExchangeFirebaseTokenInput): Promise<AuthResult> {
    const firebasePayload: FirebaseTokenPayload = await this.validator.validate(input.idToken).catch(() => {
      throw new InvalidFirebaseTokenError();
    });

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

    return this.tokenPairIssuer.issue(user);
  }
}
```

- [ ] **Step 7: Update `exchange-firebase-token.use-case.spec.ts` for the new constructor**

Replace the file entirely:

```ts
// src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts
import { ExchangeFirebaseTokenUseCase } from './exchange-firebase-token.use-case';
import { IFirebaseTokenValidator } from '../../domain/services/firebase-token-validator';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository, RefreshTokenRecord } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { TokenPairIssuer } from '../services/token-pair-issuer';
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
    findByPhone: jest.fn().mockResolvedValue(null),
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

function makeIssuer(refreshRepo: IRefreshTokenRepository): TokenPairIssuer {
  return new TokenPairIssuer(refreshRepo, new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d'));
}

describe('ExchangeFirebaseTokenUseCase', () => {
  it('creates new user and returns tokens when user does not exist', async () => {
    const userRepo = makeUserRepo();
    const refreshRepo = makeRefreshRepo();
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(refreshRepo));
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.role).toBe('ADMIN');
    expect(userRepo.save).toHaveBeenCalled();
    expect(result.expiresIn).toBe(900); // 15m = 900s
    const savedRecord = (refreshRepo.save as jest.Mock).mock.calls[0][0] as RefreshTokenRecord;
    expect(savedRecord.tokenHash).not.toBe(result.refreshToken);
    expect(savedRecord.tokenHash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
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
    const refreshRepo = makeRefreshRepo();
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(refreshRepo));
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.user.id).toBe('existing-id');
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(refreshRepo.save).toHaveBeenCalled();
  });

  it('throws InvalidFirebaseTokenError when validator rejects', async () => {
    const validator = makeValidator({
      validate: jest.fn().mockRejectedValue(new Error('bad token')),
    });
    const uc = new ExchangeFirebaseTokenUseCase(validator, makeUserRepo(), makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'bad', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidFirebaseTokenError,
    );
  });
});
```

- [ ] **Step 8: Refactor `RefreshTokenUseCase` to use `TokenPairIssuer`**

Replace `src/modules/identity/application/use-cases/refresh-token.use-case.ts` entirely with:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  REFRESH_TOKEN_REPOSITORY,
  IRefreshTokenRepository,
} from '../../domain/repositories/refresh-token.repository';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { InvalidRefreshTokenError } from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';

export interface RefreshTokenInput {
  rawRefreshToken: string;
  tenantId?: string; // optional — when absent, tenant guard is skipped (HTTP refresh flow)
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: IRefreshTokenRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
  ) {}

  async execute(input: RefreshTokenInput): Promise<AuthResult> {
    const hash = createHash('sha256').update(input.rawRefreshToken).digest('hex');

    const record = await this.refreshRepo.findByHash(hash);

    if (!record || record.revokedAt !== null || record.expiresAt <= new Date()) {
      throw new InvalidRefreshTokenError();
    }

    if (input.tenantId && record.tenantId !== input.tenantId) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.userRepo.findById(record.userId, record.tenantId);
    if (!user) {
      throw new InvalidRefreshTokenError();
    }

    // Fail-closed: revoke first. If save throws, client loses session but no duplicate tokens exist.
    await this.refreshRepo.revokeByHash(hash);

    return this.tokenPairIssuer.issue(user);
  }
}
```

- [ ] **Step 9: Update `refresh-token.use-case.spec.ts` for the new constructor**

Replace the file entirely:

```ts
// src/modules/identity/application/use-cases/refresh-token.use-case.spec.ts
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository, RefreshTokenRecord } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { TokenPairIssuer } from '../services/token-pair-issuer';
import { User } from '../../domain/entities/user.entity';
import { InvalidRefreshTokenError } from '../../domain/errors/identity.errors';
import { createHash } from 'crypto';

const TENANT_ID = 'tenant-222';
const USER_ID = 'user-333';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function makeRecord(overrides?: Partial<RefreshTokenRecord>): RefreshTokenRecord {
  return {
    id: 'rec-001',
    userId: USER_ID,
    tenantId: TENANT_ID,
    tokenHash: sha256('valid-token'),
    expiresAt: new Date(Date.now() + ONE_DAY_MS),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeUser(): User {
  return User.reconstitute({
    id: USER_ID,
    tenantId: TENANT_ID,
    name: 'Test User',
    role: 'ADMIN',
    phone: null,
    email: 'test@example.com',
    firebaseUid: 'fb-uid',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRefreshRepo(record?: RefreshTokenRecord | null): IRefreshTokenRepository {
  return {
    findByHash: jest.fn().mockResolvedValue(record ?? null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUserRepo(user?: User | null): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(user ?? null),
    save: jest.fn().mockResolvedValue(null),
  };
}

function makeIssuer(refreshRepo: IRefreshTokenRepository): TokenPairIssuer {
  return new TokenPairIssuer(refreshRepo, new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d'));
}

describe('RefreshTokenUseCase', () => {
  it('rotates tokens: revokes old, saves new, returns new pair', async () => {
    const record = makeRecord();
    const refreshRepo = makeRefreshRepo(record);
    const userRepo = makeUserRepo(makeUser());
    const uc = new RefreshTokenUseCase(refreshRepo, userRepo, makeIssuer(refreshRepo));

    const result = await uc.execute({ rawRefreshToken: 'valid-token', tenantId: TENANT_ID });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.refreshToken).not.toBe('valid-token'); // rotated
    expect(refreshRepo.revokeByHash).toHaveBeenCalledWith(sha256('valid-token'));
    expect(refreshRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: sha256(result.refreshToken) }),
    );
  });

  it('throws InvalidRefreshTokenError when token hash not found', async () => {
    const refreshRepo = makeRefreshRepo(null);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(makeUser()), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'unknown-token', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when token is revoked', async () => {
    const revokedRecord = makeRecord({ revokedAt: new Date(Date.now() - 1000) });
    const refreshRepo = makeRefreshRepo(revokedRecord);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(makeUser()), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'valid-token', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when token is expired', async () => {
    const expiredRecord = makeRecord({ expiresAt: new Date(Date.now() - 1000) });
    const refreshRepo = makeRefreshRepo(expiredRecord);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(makeUser()), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'valid-token', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when user no longer exists', async () => {
    const record = makeRecord();
    const refreshRepo = makeRefreshRepo(record);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(null), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'valid-token', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('throws InvalidRefreshTokenError when token belongs to different tenant', async () => {
    const record = makeRecord(); // record.tenantId = TENANT_ID
    const refreshRepo = makeRefreshRepo(record);
    const uc = new RefreshTokenUseCase(refreshRepo, makeUserRepo(makeUser()), makeIssuer(refreshRepo));
    await expect(
      uc.execute({ rawRefreshToken: 'valid-token', tenantId: 'other-tenant' }),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });
});
```

- [ ] **Step 10: Run the full identity test suite**

Run: `pnpm --filter api test -- identity`
Expected: PASS — all tests including the two refactored use cases and the new `TokenPairIssuer` tests.

- [ ] **Step 11: Commit**

```bash
git add src/modules/identity/application
git commit -m "refactor(identity): extract TokenPairIssuer, dedupe token issuance"
```

---

### Task 4: `otp_codes` schema

**Files:**
- Create: `src/shared/database/schema/otp-codes.ts`
- Modify: `src/shared/database/schema/index.ts`

- [ ] **Step 1: Add the schema file**

```ts
// src/shared/database/schema/otp-codes.ts
import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type OtpCodeRow = typeof otpCodes.$inferSelect;
export type NewOtpCodeRow = typeof otpCodes.$inferInsert;
```

- [ ] **Step 2: Export it from the schema barrel**

Edit `src/shared/database/schema/index.ts`:

```ts
// Barrel das tabelas. Cada bounded context adiciona seu schema aqui
// conforme for implementado (catalog, team, scheduling, identity, notifications).
export * from './tenants';
export * from './users';
export * from './refresh-tokens';
export * from './otp-codes';
export * from './services';
export * from './barbers';
export * from './appointments';
export * from './notification-logs';
```

- [ ] **Step 3: Generate and review the migration**

Run: `pnpm --filter api db:generate`
Expected: a new file appears under `apps/api/drizzle/` creating table `otp_codes` with columns matching the schema above. Open the generated SQL file and confirm the `CREATE TABLE otp_codes` statement looks correct before proceeding.

- [ ] **Step 4: Apply the migration to the local dev database**

Run: `pnpm --filter api db:migrate`
Expected: migration applies without error (requires `docker compose up -d` running Postgres locally).

- [ ] **Step 5: Commit**

```bash
git add src/shared/database/schema/otp-codes.ts src/shared/database/schema/index.ts drizzle/
git commit -m "feat(db): add otp_codes table"
```

---

### Task 5: `IOtpCodeRepository` + Drizzle implementation

**Files:**
- Create: `src/modules/identity/domain/repositories/otp-code.repository.ts`
- Create: `src/modules/identity/infra/repositories/otp-code-drizzle.repository.ts`
- Test: `src/modules/identity/infra/repositories/otp-code-drizzle.repository.spec.ts`

This repository talks to the database, so it's tested the same way the codebase tests other Drizzle repositories — check whether `user-drizzle.repository.ts` or `refresh-token-drizzle.repository.ts` have existing `.spec.ts` files before writing one:

- [ ] **Step 1: Check for an existing Drizzle-repository test pattern**

Run: `ls src/modules/identity/infra/repositories/*.spec.ts 2>&1 || echo "none found"`

If none found (expected, based on current repo state), this repository is covered indirectly through the use-case tests in Tasks 6-7 (which mock `IOtpCodeRepository`), matching how `UserDrizzleRepository` and `RefreshTokenDrizzleRepository` have no dedicated spec files today. Skip Steps 2-4 below and go straight to Step 5 (implementation) if that's the case. If a pattern **does** exist, follow it instead of skipping.

- [ ] **Step 2: Define the domain interface**

```ts
// src/modules/identity/domain/repositories/otp-code.repository.ts
export const OTP_CODE_REPOSITORY = Symbol('IOtpCodeRepository');

export interface OtpCodeRecord {
  id: string;
  tenantId: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IOtpCodeRepository {
  save(record: OtpCodeRecord): Promise<void>;
  findActiveByPhone(tenantId: string, phone: string): Promise<OtpCodeRecord | null>;
  incrementAttempts(id: string): Promise<void>;
  markUsed(id: string): Promise<void>;
}
```

- [ ] **Step 3: Implement the Drizzle repository**

```ts
// src/modules/identity/infra/repositories/otp-code-drizzle.repository.ts
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import {
  IOtpCodeRepository,
  OtpCodeRecord,
} from '../../domain/repositories/otp-code.repository';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class OtpCodeDrizzleRepository implements IOtpCodeRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async save(record: OtpCodeRecord): Promise<void> {
    await this.db.insert(schema.otpCodes).values({
      id: record.id,
      tenantId: record.tenantId,
      phone: record.phone,
      codeHash: record.codeHash,
      expiresAt: record.expiresAt,
      attempts: record.attempts,
      usedAt: record.usedAt,
      createdAt: record.createdAt,
    });
  }

  async findActiveByPhone(tenantId: string, phone: string): Promise<OtpCodeRecord | null> {
    const rows = await this.db
      .select()
      .from(schema.otpCodes)
      .where(
        and(
          eq(schema.otpCodes.tenantId, tenantId),
          eq(schema.otpCodes.phone, phone),
          isNull(schema.otpCodes.usedAt),
          gt(schema.otpCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(schema.otpCodes.createdAt))
      .limit(1);
    return rows[0] ? this.toRecord(rows[0]) : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const [row] = await this.db
      .select({ attempts: schema.otpCodes.attempts })
      .from(schema.otpCodes)
      .where(eq(schema.otpCodes.id, id))
      .limit(1);
    if (!row) return;
    await this.db
      .update(schema.otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(schema.otpCodes.id, id));
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .update(schema.otpCodes)
      .set({ usedAt: new Date() })
      .where(eq(schema.otpCodes.id, id));
  }

  private toRecord(row: typeof schema.otpCodes.$inferSelect): OtpCodeRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      phone: row.phone,
      codeHash: row.codeHash,
      expiresAt: row.expiresAt,
      attempts: row.attempts,
      usedAt: row.usedAt,
      createdAt: row.createdAt,
    };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter api typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/domain/repositories/otp-code.repository.ts src/modules/identity/infra/repositories/otp-code-drizzle.repository.ts
git commit -m "feat(identity): add OtpCodeRepository (domain + Drizzle impl)"
```

---

### Task 6: OTP domain errors + exception filter mapping

**Files:**
- Modify: `src/modules/identity/domain/errors/identity.errors.ts`
- Modify: `src/shared/kernel/errors/domain-exception.filter.ts`

- [ ] **Step 1: Add the new error classes**

Edit `src/modules/identity/domain/errors/identity.errors.ts`, add at the end:

```ts
export class OtpRateLimitedError extends DomainError {
  readonly code = 'OTP_RATE_LIMITED';
  constructor(message = 'Muitas tentativas. Tente novamente mais tarde.') {
    super(message);
  }
}

export class InvalidOtpError extends DomainError {
  readonly code = 'INVALID_OTP';
  constructor(message = 'Código inválido ou expirado.') {
    super(message);
  }
}
```

- [ ] **Step 2: Map them to HTTP status codes**

Edit `src/shared/kernel/errors/domain-exception.filter.ts`, add two entries to `ERROR_CODE_TO_STATUS`:

```ts
const ERROR_CODE_TO_STATUS: Record<string, HttpStatus> = {
  INVALID_FIREBASE_TOKEN: HttpStatus.UNAUTHORIZED,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  SERVICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  SERVICE_NAME_TAKEN: HttpStatus.CONFLICT,
  BARBER_NOT_FOUND: HttpStatus.NOT_FOUND,
  APPOINTMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  APPOINTMENT_CONFLICT: HttpStatus.CONFLICT,
  INVALID_APPOINTMENT_TIME: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_STATUS_TRANSITION: HttpStatus.UNPROCESSABLE_ENTITY,
  NOTIFICATION_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
  OTP_RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  INVALID_OTP: HttpStatus.BAD_REQUEST,
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter api typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/identity/domain/errors/identity.errors.ts src/shared/kernel/errors/domain-exception.filter.ts
git commit -m "feat(identity): add OTP domain errors and HTTP status mapping"
```

---

### Task 7: `NotificationsModule` exports `WHATSAPP_GATEWAY`

**Files:**
- Modify: `src/modules/notifications/notifications.module.ts`

- [ ] **Step 1: Add the exports array**

Edit `src/modules/notifications/notifications.module.ts`, the `@Module` decorator currently has no `exports` key. Add one after `providers`:

```ts
@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationDrizzleRepository },
    {
      provide:    WHATSAPP_GATEWAY,
      useFactory: (config: ConfigService) =>
        config.get('EVOLUTION_API_URL')
          ? new EvolutionApiWhatsAppGateway(config)
          : new StubWhatsAppGateway(),
      inject: [ConfigService],
    },
    SendConfirmationNotificationUseCase,
    SendCancellationNotificationUseCase,
    SendReminderNotificationUseCase,
    AppointmentBookedListener,
    AppointmentConfirmedListener,
    AppointmentCancelledListener,
    ReminderProcessor,
  ],
  exports: [WHATSAPP_GATEWAY],
})
export class NotificationsModule {}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter api typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/notifications/notifications.module.ts
git commit -m "feat(notifications): export WHATSAPP_GATEWAY for cross-module use"
```

---

### Task 8: `RequestOtpUseCase`

**Files:**
- Create: `src/modules/identity/application/use-cases/request-otp.use-case.ts`
- Test: `src/modules/identity/application/use-cases/request-otp.use-case.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/identity/application/use-cases/request-otp.use-case.spec.ts
import { RequestOtpUseCase } from './request-otp.use-case';
import { IOtpCodeRepository, OtpCodeRecord } from '../../domain/repositories/otp-code.repository';
import { IWhatsAppGateway } from '../../../notifications/domain/ports/whatsapp-gateway.port';
import { OtpRateLimitedError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-1';
const PHONE = '+5511999999999';

function makeOtpRepo(): IOtpCodeRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findActiveByPhone: jest.fn().mockResolvedValue(null),
    incrementAttempts: jest.fn().mockResolvedValue(undefined),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };
}

function makeGateway(): IWhatsAppGateway {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

function makeRedis(overrides?: { setResult?: string | null; incrResult?: number }) {
  return {
    set: jest.fn().mockResolvedValue(overrides?.setResult ?? 'OK'),
    incr: jest.fn().mockResolvedValue(overrides?.incrResult ?? 1),
    expire: jest.fn().mockResolvedValue(1),
  };
}

describe('RequestOtpUseCase', () => {
  it('generates a code, saves it hashed, and sends it via WhatsApp', async () => {
    const otpRepo = makeOtpRepo();
    const gateway = makeGateway();
    const redis = makeRedis();
    const uc = new RequestOtpUseCase(otpRepo, gateway, redis as never);

    await uc.execute({ phone: PHONE, tenantId: TENANT_ID });

    expect(otpRepo.save).toHaveBeenCalledTimes(1);
    const saved = (otpRepo.save as jest.Mock).mock.calls[0][0] as OtpCodeRecord;
    expect(saved.tenantId).toBe(TENANT_ID);
    expect(saved.phone).toBe(PHONE);
    expect(saved.attempts).toBe(0);
    expect(saved.codeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(gateway.send).toHaveBeenCalledTimes(1);
    expect((gateway.send as jest.Mock).mock.calls[0][0]).toBe(PHONE);
  });

  it('throws OtpRateLimitedError when cooldown key already exists', async () => {
    const redis = makeRedis({ setResult: null }); // NX failed = key already set
    const uc = new RequestOtpUseCase(makeOtpRepo(), makeGateway(), redis as never);

    await expect(uc.execute({ phone: PHONE, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      OtpRateLimitedError,
    );
  });

  it('throws OtpRateLimitedError when hourly limit exceeded', async () => {
    const redis = makeRedis({ incrResult: 6 });
    const uc = new RequestOtpUseCase(makeOtpRepo(), makeGateway(), redis as never);

    await expect(uc.execute({ phone: PHONE, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      OtpRateLimitedError,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- request-otp`
Expected: FAIL — `request-otp.use-case.ts` doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/modules/identity/application/use-cases/request-otp.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { randomInt, createHash, randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS } from '@shared/database/database.tokens';
import {
  OTP_CODE_REPOSITORY,
  IOtpCodeRepository,
} from '../../domain/repositories/otp-code.repository';
import {
  WHATSAPP_GATEWAY,
  IWhatsAppGateway,
} from '../../../notifications/domain/ports/whatsapp-gateway.port';
import { OtpRateLimitedError } from '../../domain/errors/identity.errors';

export interface RequestOtpInput {
  phone: string;
  tenantId: string;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const COOLDOWN_SECONDS = 60;
const HOURLY_LIMIT = 5;
const HOURLY_WINDOW_SECONDS = 60 * 60;

@Injectable()
export class RequestOtpUseCase {
  constructor(
    @Inject(OTP_CODE_REPOSITORY)
    private readonly otpRepo: IOtpCodeRepository,
    @Inject(WHATSAPP_GATEWAY)
    private readonly whatsapp: IWhatsAppGateway,
    @Inject(REDIS)
    private readonly redis: Redis,
  ) {}

  async execute(input: RequestOtpInput): Promise<void> {
    await this.checkRateLimit(input.tenantId, input.phone);

    const code = randomInt(100000, 1000000).toString();
    const codeHash = createHash('sha256').update(code).digest('hex');

    await this.otpRepo.save({
      id: randomUUID(),
      tenantId: input.tenantId,
      phone: input.phone,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      usedAt: null,
      createdAt: new Date(),
    });

    await this.whatsapp.send(
      input.phone,
      `Seu código de verificação Baber é: ${code}. Válido por 5 minutos.`,
    );
  }

  private async checkRateLimit(tenantId: string, phone: string): Promise<void> {
    const cooldownKey = `otp:cooldown:${tenantId}:${phone}`;
    const setResult = await this.redis.set(cooldownKey, '1', 'EX', COOLDOWN_SECONDS, 'NX');
    if (setResult !== 'OK') {
      throw new OtpRateLimitedError('Aguarde antes de solicitar um novo código.');
    }

    const hourlyKey = `otp:hourly:${tenantId}:${phone}`;
    const count = await this.redis.incr(hourlyKey);
    if (count === 1) {
      await this.redis.expire(hourlyKey, HOURLY_WINDOW_SECONDS);
    }
    if (count > HOURLY_LIMIT) {
      throw new OtpRateLimitedError('Limite de tentativas por hora atingido.');
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- request-otp`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/application/use-cases/request-otp.use-case.ts src/modules/identity/application/use-cases/request-otp.use-case.spec.ts
git commit -m "feat(identity): add RequestOtpUseCase with Redis rate limiting"
```

---

### Task 9: `VerifyOtpUseCase`

**Files:**
- Create: `src/modules/identity/application/use-cases/verify-otp.use-case.ts`
- Test: `src/modules/identity/application/use-cases/verify-otp.use-case.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/identity/application/use-cases/verify-otp.use-case.spec.ts
import { createHash } from 'crypto';
import { VerifyOtpUseCase } from './verify-otp.use-case';
import { IOtpCodeRepository, OtpCodeRecord } from '../../domain/repositories/otp-code.repository';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { JwtTokenService } from '@shared/auth/jwt-token.service';
import { TokenPairIssuer } from '../services/token-pair-issuer';
import { User } from '../../domain/entities/user.entity';
import { InvalidOtpError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-1';
const PHONE = '+5511999999999';
const CODE = '123456';

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function makeOtpRecord(overrides?: Partial<OtpCodeRecord>): OtpCodeRecord {
  return {
    id: 'otp-1',
    tenantId: TENANT_ID,
    phone: PHONE,
    codeHash: sha256(CODE),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeOtpRepo(record: OtpCodeRecord | null): IOtpCodeRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findActiveByPhone: jest.fn().mockResolvedValue(record),
    incrementAttempts: jest.fn().mockResolvedValue(undefined),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };
}

function makeUserRepo(existingUser?: User | null): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(existingUser ?? null),
    findById: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation(async (u: User) => u),
  };
}

function makeIssuer(): TokenPairIssuer {
  const refreshRepo: IRefreshTokenRepository = {
    save: jest.fn().mockResolvedValue(undefined),
    findByHash: jest.fn().mockResolvedValue(null),
    revokeByHash: jest.fn().mockResolvedValue(undefined),
  };
  return new TokenPairIssuer(refreshRepo, new JwtTokenService('acc-secret', 'ref-secret', '15m', '30d'));
}

describe('VerifyOtpUseCase', () => {
  it('creates a new CLIENT user and returns tokens on first login', async () => {
    const otpRepo = makeOtpRepo(makeOtpRecord());
    const userRepo = makeUserRepo(null);
    const uc = new VerifyOtpUseCase(otpRepo, userRepo, makeIssuer());

    const result = await uc.execute({ phone: PHONE, code: CODE, tenantId: TENANT_ID });

    expect(result.user.role).toBe('CLIENT');
    expect(result.user.phone).toBe(PHONE);
    expect(result.user.name).toBeNull();
    expect(userRepo.save).toHaveBeenCalled();
    expect(otpRepo.markUsed).toHaveBeenCalledWith('otp-1');
  });

  it('reuses existing CLIENT user without creating a new one', async () => {
    const existing = User.reconstitute({
      id: 'existing-client',
      tenantId: TENANT_ID,
      name: 'Gabryel',
      role: 'CLIENT',
      phone: PHONE,
      email: null,
      firebaseUid: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const otpRepo = makeOtpRepo(makeOtpRecord());
    const userRepo = makeUserRepo(existing);
    const uc = new VerifyOtpUseCase(otpRepo, userRepo, makeIssuer());

    const result = await uc.execute({ phone: PHONE, code: CODE, tenantId: TENANT_ID });

    expect(result.user.id).toBe('existing-client');
    expect(result.user.name).toBe('Gabryel');
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws InvalidOtpError when no active code exists', async () => {
    const uc = new VerifyOtpUseCase(makeOtpRepo(null), makeUserRepo(null), makeIssuer());

    await expect(uc.execute({ phone: PHONE, code: CODE, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
  });

  it('throws InvalidOtpError and increments attempts when code does not match', async () => {
    const otpRepo = makeOtpRepo(makeOtpRecord());
    const uc = new VerifyOtpUseCase(otpRepo, makeUserRepo(null), makeIssuer());

    await expect(
      uc.execute({ phone: PHONE, code: '000000', tenantId: TENANT_ID }),
    ).rejects.toBeInstanceOf(InvalidOtpError);
    expect(otpRepo.incrementAttempts).toHaveBeenCalledWith('otp-1');
  });

  it('throws InvalidOtpError when attempts already exhausted', async () => {
    const otpRepo = makeOtpRepo(makeOtpRecord({ attempts: 3 }));
    const uc = new VerifyOtpUseCase(otpRepo, makeUserRepo(null), makeIssuer());

    await expect(uc.execute({ phone: PHONE, code: CODE, tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- verify-otp`
Expected: FAIL — `verify-otp.use-case.ts` doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/modules/identity/application/use-cases/verify-otp.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  OTP_CODE_REPOSITORY,
  IOtpCodeRepository,
} from '../../domain/repositories/otp-code.repository';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { InvalidOtpError } from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';

export interface VerifyOtpInput {
  phone: string;
  code: string;
  tenantId: string;
}

const MAX_ATTEMPTS = 3;

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    @Inject(OTP_CODE_REPOSITORY)
    private readonly otpRepo: IOtpCodeRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    private readonly tokenPairIssuer: TokenPairIssuer,
  ) {}

  async execute(input: VerifyOtpInput): Promise<AuthResult> {
    const record = await this.otpRepo.findActiveByPhone(input.tenantId, input.phone);
    if (!record || record.attempts >= MAX_ATTEMPTS) {
      throw new InvalidOtpError();
    }

    const codeHash = createHash('sha256').update(input.code).digest('hex');
    if (codeHash !== record.codeHash) {
      await this.otpRepo.incrementAttempts(record.id);
      throw new InvalidOtpError();
    }

    await this.otpRepo.markUsed(record.id);

    let user = await this.userRepo.findByPhone(input.phone, input.tenantId);
    if (!user) {
      const newUser = User.createClient({ tenantId: input.tenantId, phone: input.phone });
      user = await this.userRepo.save(newUser);
    }

    return this.tokenPairIssuer.issue(user);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- verify-otp`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/application/use-cases/verify-otp.use-case.ts src/modules/identity/application/use-cases/verify-otp.use-case.spec.ts
git commit -m "feat(identity): add VerifyOtpUseCase"
```

---

### Task 10: `UpdateUserNameUseCase` + `PATCH /me`

**Files:**
- Create: `src/modules/identity/application/use-cases/update-user-name.use-case.ts`
- Test: `src/modules/identity/application/use-cases/update-user-name.use-case.spec.ts`
- Modify: `src/modules/identity/http/me.controller.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/identity/application/use-cases/update-user-name.use-case.spec.ts
import { UpdateUserNameUseCase } from './update-user-name.use-case';
import { IUserRepository } from '../../domain/repositories/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

function makeUser(name: string | null = null): User {
  return User.reconstitute({
    id: USER_ID,
    tenantId: TENANT_ID,
    name,
    role: 'CLIENT',
    phone: '+5511999999999',
    email: null,
    firebaseUid: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeUserRepo(user: User | null): IUserRepository {
  return {
    findByFirebaseUid: jest.fn().mockResolvedValue(null),
    findByPhone: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(user),
    save: jest.fn().mockImplementation(async (u: User) => u),
  };
}

describe('UpdateUserNameUseCase', () => {
  it('renames the user and saves it', async () => {
    const userRepo = makeUserRepo(makeUser(null));
    const uc = new UpdateUserNameUseCase(userRepo);

    const result = await uc.execute({ userId: USER_ID, tenantId: TENANT_ID, name: 'Gabryel' });

    expect(result.name).toBe('Gabryel');
    expect(userRepo.save).toHaveBeenCalled();
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    const uc = new UpdateUserNameUseCase(makeUserRepo(null));

    await expect(
      uc.execute({ userId: USER_ID, tenantId: TENANT_ID, name: 'Gabryel' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- update-user-name`
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/modules/identity/application/use-cases/update-user-name.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/repositories/user.repository';
import { UserNotFoundError } from '../../domain/errors/identity.errors';

export interface UpdateUserNameInput {
  userId: string;
  tenantId: string;
  name: string;
}

export interface UpdateUserNameOutput {
  id: string;
  name: string | null;
  role: string;
  phone: string | null;
  email: string | null;
}

@Injectable()
export class UpdateUserNameUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: UpdateUserNameInput): Promise<UpdateUserNameOutput> {
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) {
      throw new UserNotFoundError();
    }

    user.rename(input.name);
    const saved = await this.userRepo.save(user);

    return {
      id: saved.id,
      name: saved.name,
      role: saved.role,
      phone: saved.phone,
      email: saved.email,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- update-user-name`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire `PATCH /me` into the existing controller**

Replace `src/modules/identity/http/me.controller.ts` entirely:

```ts
// src/modules/identity/http/me.controller.ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { UpdateUserNameUseCase } from '../application/use-cases/update-user-name.use-case';

class UpdateNameDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

@Controller('me')
export class MeController {
  constructor(private readonly updateUserNameUseCase: UpdateUserNameUseCase) {}

  @Get()
  me(@CurrentUser() user: JwtPayload) {
    return {
      userId: user.userId,
      tenantId: user.tenantId,
      role: user.role,
    };
  }

  @Patch()
  async updateName(@CurrentUser() user: JwtPayload, @Body() dto: UpdateNameDto) {
    return this.updateUserNameUseCase.execute({
      userId: user.userId,
      tenantId: user.tenantId,
      name: dto.name,
    });
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter api typecheck`
Expected: no errors (note: `MeController` now requires `UpdateUserNameUseCase` in its constructor — this compiles fine standalone; module wiring happens in Task 12).

- [ ] **Step 7: Commit**

```bash
git add src/modules/identity/application/use-cases/update-user-name.use-case.ts src/modules/identity/application/use-cases/update-user-name.use-case.spec.ts src/modules/identity/http/me.controller.ts
git commit -m "feat(identity): add UpdateUserNameUseCase and PATCH /me"
```

---

### Task 11: Public tenant listing

**Files:**
- Create: `src/modules/identity/application/use-cases/list-tenants.use-case.ts`
- Create: `src/modules/identity/application/use-cases/find-tenant-by-slug.use-case.ts`
- Test: `src/modules/identity/application/use-cases/list-tenants.use-case.spec.ts`
- Test: `src/modules/identity/application/use-cases/find-tenant-by-slug.use-case.spec.ts`
- Create: `src/modules/identity/http/tenants.controller.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/identity/application/use-cases/list-tenants.use-case.spec.ts
import { ListTenantsUseCase } from './list-tenants.use-case';

function makeDb(rows: Array<{ id: string; slug: string; name: string }>) {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockResolvedValue(rows),
    }),
  };
}

describe('ListTenantsUseCase', () => {
  it('returns id/slug/name for all tenants', async () => {
    const db = makeDb([{ id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' }]);
    const uc = new ListTenantsUseCase(db as never);

    const result = await uc.execute();

    expect(result).toEqual([{ id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' }]);
  });
});
```

```ts
// src/modules/identity/application/use-cases/find-tenant-by-slug.use-case.spec.ts
import { FindTenantBySlugUseCase } from './find-tenant-by-slug.use-case';

function makeDb(row: { id: string; slug: string; name: string } | undefined) {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(row ? [row] : []),
        }),
      }),
    }),
  };
}

describe('FindTenantBySlugUseCase', () => {
  it('returns the tenant when the slug exists', async () => {
    const db = makeDb({ id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' });
    const uc = new FindTenantBySlugUseCase(db as never);

    const result = await uc.execute('barbearia-do-amigo');

    expect(result).toEqual({ id: 't1', slug: 'barbearia-do-amigo', name: 'Barbearia do Amigo' });
  });

  it('returns null when the slug does not exist', async () => {
    const db = makeDb(undefined);
    const uc = new FindTenantBySlugUseCase(db as never);

    const result = await uc.execute('unknown-slug');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- list-tenants find-tenant-by-slug`
Expected: FAIL — files don't exist.

- [ ] **Step 3: Implement both use cases**

```ts
// src/modules/identity/application/use-cases/list-tenants.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';

type DB = PostgresJsDatabase<typeof schema>;

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
}

@Injectable()
export class ListTenantsUseCase {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async execute(): Promise<TenantSummary[]> {
    const rows = await this.db
      .select({ id: schema.tenants.id, slug: schema.tenants.slug, name: schema.tenants.name })
      .from(schema.tenants);
    return rows;
  }
}
```

```ts
// src/modules/identity/application/use-cases/find-tenant-by-slug.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { TenantSummary } from './list-tenants.use-case';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class FindTenantBySlugUseCase {
  constructor(
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  async execute(slug: string): Promise<TenantSummary | null> {
    const rows = await this.db
      .select({ id: schema.tenants.id, slug: schema.tenants.slug, name: schema.tenants.name })
      .from(schema.tenants)
      .where(eq(schema.tenants.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- list-tenants find-tenant-by-slug`
Expected: PASS (3 tests total).

- [ ] **Step 5: Add the public controller**

```ts
// src/modules/identity/http/tenants.controller.ts
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '@shared/auth/public.decorator';
import { ListTenantsUseCase } from '../application/use-cases/list-tenants.use-case';
import { FindTenantBySlugUseCase } from '../application/use-cases/find-tenant-by-slug.use-case';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly listTenants: ListTenantsUseCase,
    private readonly findTenantBySlug: FindTenantBySlugUseCase,
  ) {}

  @Public()
  @Get()
  async list() {
    return this.listTenants.execute();
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.findTenantBySlug.execute(slug);
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }
    return tenant;
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter api typecheck`
Expected: no errors (module wiring happens in Task 12).

- [ ] **Step 7: Commit**

```bash
git add src/modules/identity/application/use-cases/list-tenants.use-case.ts src/modules/identity/application/use-cases/find-tenant-by-slug.use-case.ts src/modules/identity/application/use-cases/list-tenants.use-case.spec.ts src/modules/identity/application/use-cases/find-tenant-by-slug.use-case.spec.ts src/modules/identity/http/tenants.controller.ts
git commit -m "feat(identity): add public tenant listing endpoints"
```

---

### Task 12: `OtpAuthController` + module wiring

**Files:**
- Create: `src/modules/identity/http/otp-auth.controller.ts`
- Modify: `src/modules/identity/identity.module.ts`

- [ ] **Step 1: Add the controller**

```ts
// src/modules/identity/http/otp-auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Public } from '@shared/auth/public.decorator';
import { RequestOtpUseCase } from '../application/use-cases/request-otp.use-case';
import { VerifyOtpUseCase } from '../application/use-cases/verify-otp.use-case';

class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

@Controller('auth/otp')
export class OtpAuthController {
  constructor(
    private readonly requestOtpUseCase: RequestOtpUseCase,
    private readonly verifyOtpUseCase: VerifyOtpUseCase,
  ) {}

  @Public()
  @Post('request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async request(@Body() dto: RequestOtpDto) {
    await this.requestOtpUseCase.execute({ phone: dto.phone, tenantId: dto.tenantId });
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyOtpDto) {
    return this.verifyOtpUseCase.execute({ phone: dto.phone, code: dto.code, tenantId: dto.tenantId });
  }
}
```

- [ ] **Step 2: Wire everything into `IdentityModule`**

Replace `src/modules/identity/identity.module.ts` entirely:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Domain symbol tokens
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository';
import { OTP_CODE_REPOSITORY } from './domain/repositories/otp-code.repository';
import { FIREBASE_TOKEN_VALIDATOR } from './domain/services/firebase-token-validator';

// Infra
import { UserDrizzleRepository } from './infra/repositories/user-drizzle.repository';
import { RefreshTokenDrizzleRepository } from './infra/repositories/refresh-token-drizzle.repository';
import { OtpCodeDrizzleRepository } from './infra/repositories/otp-code-drizzle.repository';
import { FirebaseTokenValidatorAdapter } from './infra/firebase/firebase-token-validator.adapter';

// Application services
import { TokenPairIssuer } from './application/services/token-pair-issuer';

// Use cases
import { ExchangeFirebaseTokenUseCase } from './application/use-cases/exchange-firebase-token.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RequestOtpUseCase } from './application/use-cases/request-otp.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { UpdateUserNameUseCase } from './application/use-cases/update-user-name.use-case';
import { ListTenantsUseCase } from './application/use-cases/list-tenants.use-case';
import { FindTenantBySlugUseCase } from './application/use-cases/find-tenant-by-slug.use-case';

// Controllers
import { AdminAuthController } from './http/admin-auth.controller';
import { MeController } from './http/me.controller';
import { OtpAuthController } from './http/otp-auth.controller';
import { TenantsController } from './http/tenants.controller';

// Shared
import { JwtTokenService } from '@shared/auth/jwt-token.service';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [AdminAuthController, MeController, OtpAuthController, TenantsController],
  providers: [
    // JwtTokenService — provided here via factory because AppModule does not export it.
    // ConfigModule is global so ConfigService is available in every module's DI context.
    {
      provide: JwtTokenService,
      useFactory: (config: ConfigService) => new JwtTokenService(config),
      inject: [ConfigService],
    },
    // Repository bindings
    { provide: USER_REPOSITORY, useClass: UserDrizzleRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenDrizzleRepository },
    { provide: OTP_CODE_REPOSITORY, useClass: OtpCodeDrizzleRepository },
    // Firebase validator binding
    { provide: FIREBASE_TOKEN_VALIDATOR, useClass: FirebaseTokenValidatorAdapter },
    // Application services
    TokenPairIssuer,
    // Use cases
    ExchangeFirebaseTokenUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    RequestOtpUseCase,
    VerifyOtpUseCase,
    UpdateUserNameUseCase,
    ListTenantsUseCase,
    FindTenantBySlugUseCase,
  ],
})
export class IdentityModule {}
```

- [ ] **Step 3: Boot the app to confirm DI wiring resolves**

Run: `pnpm --filter api build`
Expected: compiles with no errors — this catches missing providers/circular-dependency issues that plain `tsc` alone might not surface at the right layer.

Run: `pnpm --filter api start:dev` (with `docker compose up -d` running Postgres + Redis), then in another terminal:
```bash
curl -i http://localhost:3000/api/v1/tenants
```
Expected: `200 OK` with `[]` (no tenants seeded yet, or the seeded "Barbearia do Amigo" if `db:seed` has been run) — confirms the module graph resolves and the route is reachable without auth. Stop the dev server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/modules/identity/http/otp-auth.controller.ts src/modules/identity/identity.module.ts
git commit -m "feat(identity): wire OTP controller and full module graph"
```

---

### Task 13: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full API test suite**

Run: `pnpm --filter api test`
Expected: PASS — every test in `apps/api`, including all identity tests from Tasks 1-12 and the pre-existing catalog/team/scheduling/notifications tests (unaffected by this plan).

- [ ] **Step 2: Run typecheck across the workspace**

Run: `pnpm --filter api typecheck`
Expected: no errors.

- [ ] **Step 3: Run lint**

Run: `pnpm --filter api lint`
Expected: no errors (the `no-restricted-imports` ESLint rule blocking cross-module `domain/` imports should not fire — `RequestOtpUseCase` imports `IWhatsAppGateway` from `notifications/domain/ports`, which is a port interface, not a `domain/entities` or `domain/repositories` import from another context's internals; if the rule does flag it, move `IWhatsAppGateway`'s type import to go through `NotificationsModule`'s public exports instead and adjust the import path accordingly).

- [ ] **Step 4: Manual smoke test of the full OTP flow**

With `docker compose up -d` and `pnpm --filter api start:dev` running, and `EVOLUTION_API_URL` unset (so `StubWhatsAppGateway` is used and logs the code instead of sending a real WhatsApp message):

```bash
# 1. List tenants, grab a tenantId (or run db:seed first if empty)
curl -s http://localhost:3000/api/v1/tenants

# 2. Request OTP (check server logs for the code, since StubWhatsAppGateway logs instead of sending)
curl -i -X POST http://localhost:3000/api/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","tenantId":"<paste-tenant-id>"}'

# 3. Verify with the code from the logs
curl -i -X POST http://localhost:3000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","code":"<code-from-logs>","tenantId":"<paste-tenant-id>"}'
```

Expected: step 2 returns `204`, step 3 returns `200` with `{ accessToken, refreshToken, expiresIn, user }` where `user.role === 'CLIENT'` and `user.name === null`.

```bash
# 4. Set the name using the access token from step 3
curl -i -X PATCH http://localhost:3000/api/v1/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken-from-step-3>" \
  -d '{"name":"Gabryel"}'
```

Expected: `200` with `{ id, name: "Gabryel", role: "CLIENT", phone, email: null }`.

Stop the dev server after confirming.

---

## Self-Review Notes

- **Spec coverage:** OTP request/verify (Tasks 8-9), rate limiting (Task 8), name update (Task 10), tenant listing (Task 11), `TokenPairIssuer` refactor (Task 3), error mapping (Task 6), module wiring (Task 12) — every section of the spec has a corresponding task.
- **No placeholders:** all steps show complete code; the one conditional step (Task 5, Step 1) has an explicit fallback path rather than a vague "check and adapt."
- **Type consistency:** `OtpCodeRecord`, `AuthResult` (now with `phone`), `TenantSummary` are each defined once and reused identically across use cases, tests, and controllers. `TokenPairIssuer.issue(user: User): Promise<AuthResult>` signature matches its three callers (`ExchangeFirebaseTokenUseCase`, `RefreshTokenUseCase`, `VerifyOtpUseCase`).
- **Existing tests preserved:** Task 1 and Task 3 explicitly update the two pre-existing spec files whose mocked interfaces/constructors change, so this plan doesn't silently break `pnpm --filter api test`.
