# Fix Phone-Login Review Findings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os bloqueadores (S1, S2, S3, S4, C1) e follow-ups (C2, C3, C4, C5, S5) do review `docs/reviews/2026-07-12-review-login-telefone-firebase.md`.

**Architecture:** Backend NestJS (DDD: domain/application/infra/http) — exchange de admin deixa de auto-provisionar usuário; validador Firebase falha rápido em produção; CORS allowlist; throttling nos endpoints públicos; race de primeiro login tratada com erro de domínio + re-fetch; vínculo de usuário legado por telefone. Frontend React/Vite — ciclo de vida do RecaptchaVerifier e fluxo de reenvio.

**Tech Stack:** NestJS 11, drizzle-orm/postgres-js, class-validator, `@nestjs/throttler` (novo), Jest (api), React 18 + Vitest + Testing Library (web).

**Fora de escopo (decisões registradas):**
- A2 (um firebaseUid = um tenant) — decisão de produto, não muda agora.
- A1 (duplicação dos use cases) — após S1 os dois use cases divergem de verdade; duplicação residual aceitável.
- S6 no client exchange — mensagem amigável de mismatch mantida para clientes reais; no admin, S1 passa a devolver erro genérico (cobre S6 no painel).
- Fluxo de convite de admin — provisionamento de admin continua via seed/manual; convite autenticado é feature futura.

---

## Mapa de arquivos

| Arquivo | Ação | Tarefa |
|---|---|---|
| `apps/api/src/modules/identity/domain/errors/identity.errors.ts` | + `AdminAccountNotFoundError`, `UserAlreadyExistsError` | 1, 5 |
| `apps/api/src/shared/kernel/errors/domain-exception.filter.ts` | mapear novos códigos | 1, 5 |
| `apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.ts` | remover auto-criação de ADMIN | 1 |
| `apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts` | reescrever testes | 1 |
| `apps/api/src/shared/config/env.validation.ts` | fail-fast Firebase em prod; `CORS_ORIGINS` | 2, 3 |
| `apps/api/src/shared/config/env.validation.spec.ts` | criar | 2 |
| `apps/api/src/modules/identity/infra/firebase/firebase-token-validator.adapter.ts` | bloquear stub em prod | 2 |
| `apps/api/src/main.ts` | CORS allowlist | 3 |
| `apps/api/src/app.module.ts` | ThrottlerModule + guard | 4 |
| `apps/api/src/modules/identity/http/admin-auth.controller.ts` | `@Throttle` | 4 |
| `apps/api/src/modules/identity/http/client-auth.controller.ts` | `@Throttle` | 4 |
| `apps/api/src/modules/identity/infra/repositories/user-drizzle.repository.ts` | 23505 → domain error; persistir firebaseUid no update | 5, 6 |
| `apps/api/src/modules/identity/application/use-cases/exchange-firebase-client-token.use-case.ts` | retry pós-race; vínculo legado | 5, 6 |
| `apps/api/src/modules/identity/application/use-cases/exchange-firebase-client-token.use-case.spec.ts` | testes race + vínculo | 5, 6 |
| `apps/api/src/modules/identity/domain/entities/user.entity.ts` | `linkFirebaseUid()` | 6 |
| `apps/web/src/pages/login.tsx` | recaptcha lifecycle, reenvio, fallback de erro | 7 |
| `apps/web/src/pages/__tests__/login.test.tsx` | testes novos | 7 |
| `.gitignore` | higiene | 8 |

---

### Task 1: S1 — Exchange de admin não cria mais usuário

**Files:**
- Modify: `apps/api/src/modules/identity/domain/errors/identity.errors.ts`
- Modify: `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`
- Modify: `apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.ts`
- Test: `apps/api/src/modules/identity/application/use-cases/exchange-firebase-token.use-case.spec.ts`

- [ ] **Step 1.1: Adicionar erro de domínio**

Em `identity.errors.ts`, adicionar ao final:

```ts
export class AdminAccountNotFoundError extends DomainError {
  readonly code = 'ADMIN_ACCOUNT_NOT_FOUND';
  constructor(message = 'Conta de administrador não encontrada. Solicite acesso ao responsável pela barbearia.') {
    super(message);
  }
}
```

Em `domain-exception.filter.ts`, adicionar ao mapa `ERROR_CODE_TO_STATUS`:

```ts
ADMIN_ACCOUNT_NOT_FOUND: HttpStatus.UNAUTHORIZED,
```

- [ ] **Step 1.2: Reescrever os testes do use case (falhando)**

Substituir o conteúdo do `describe` em `exchange-firebase-token.use-case.spec.ts` (manter os helpers `makeValidator`/`makeUserRepo`/`makeRefreshRepo`/`makeIssuer`; remover `makeTenantLookup` e imports de `TenantNotFoundError`/`ITenantLookup`; importar `AdminAccountNotFoundError`):

```ts
describe('ExchangeFirebaseTokenUseCase', () => {
  function makeExistingUser(overrides?: Partial<Parameters<typeof User.reconstitute>[0]>): User {
    return User.reconstitute({
      id: 'existing-id',
      tenantId: TENANT_ID,
      name: 'João',
      role: 'ADMIN',
      phone: null,
      email: 'a@b.com',
      firebaseUid: FIREBASE_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
  }

  it('returns tokens for an existing ADMIN in the tenant without creating anything', async () => {
    const userRepo = makeUserRepo(makeExistingUser());
    const refreshRepo = makeRefreshRepo();
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(refreshRepo));
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.user.id).toBe('existing-id');
    expect(result.accessToken).toBeTruthy();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(refreshRepo.save).toHaveBeenCalled();
  });

  it('returns tokens for an existing BARBER in the tenant', async () => {
    const userRepo = makeUserRepo(makeExistingUser({ role: 'BARBER' }));
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));
    const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
    expect(result.user.role).toBe('BARBER');
  });

  it('throws AdminAccountNotFoundError when the firebaseUid is unknown (never auto-creates)', async () => {
    const userRepo = makeUserRepo();
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      AdminAccountNotFoundError,
    );
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('throws AdminAccountNotFoundError when the user is a CLIENT', async () => {
    const userRepo = makeUserRepo(makeExistingUser({ role: 'CLIENT' }));
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      AdminAccountNotFoundError,
    );
  });

  it('throws AdminAccountNotFoundError when the user belongs to another tenant (no enumeration)', async () => {
    const userRepo = makeUserRepo(makeExistingUser({ tenantId: 'tenant-999' }));
    const uc = new ExchangeFirebaseTokenUseCase(makeValidator(), userRepo, makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      AdminAccountNotFoundError,
    );
  });

  it('throws InvalidFirebaseTokenError when validator rejects', async () => {
    const validator = makeValidator({ validate: jest.fn().mockRejectedValue(new Error('bad token')) });
    const uc = new ExchangeFirebaseTokenUseCase(validator, makeUserRepo(), makeIssuer(makeRefreshRepo()));
    await expect(uc.execute({ idToken: 'bad', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
      InvalidFirebaseTokenError,
    );
  });
});
```

- [ ] **Step 1.3: Rodar e confirmar falha**

Run: `pnpm --filter api test -- exchange-firebase-token.use-case`
Expected: FAIL (construtor ainda exige 4 args; comportamento antigo cria usuário)

- [ ] **Step 1.4: Reescrever o use case**

Substituir `exchange-firebase-token.use-case.ts` por:

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
import {
  InvalidFirebaseTokenError,
  AdminAccountNotFoundError,
} from '../../domain/errors/identity.errors';
import { AuthResult } from '../dto/auth-token-pair';
import { TokenPairIssuer } from '../services/token-pair-issuer';

export interface ExchangeFirebaseTokenInput {
  idToken: string;
  tenantId: string;
}

/**
 * Troca um idToken Firebase por tokens da plataforma para o painel admin.
 *
 * NUNCA cria usuário: contas de admin/barbeiro são provisionadas fora deste
 * fluxo (seed/convite). Resposta genérica para uid desconhecido, role CLIENT
 * e tenant divergente — evita enumeração de contas.
 */
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

    const user = await this.userRepo.findByFirebaseUidAnyTenant(firebasePayload.uid);

    if (!user || user.role === 'CLIENT' || user.tenantId !== input.tenantId) {
      throw new AdminAccountNotFoundError();
    }

    return this.tokenPairIssuer.issue(user);
  }
}
```

- [ ] **Step 1.5: Rodar testes**

Run: `pnpm --filter api test -- exchange-firebase-token.use-case`
Expected: PASS (6 testes)

Run: `pnpm --filter api typecheck`
Expected: sem erros (o módulo Nest continua válido — o provider `TENANT_LOOKUP` segue registrado para o use case de client).

- [ ] **Step 1.6: Commit**

```bash
git add apps/api/src/modules/identity
git commit -m "fix(identity)!: admin exchange no longer auto-provisions ADMIN users"
```

---

### Task 2: S2 — Fail-fast sem credenciais Firebase em produção

**Files:**
- Modify: `apps/api/src/shared/config/env.validation.ts`
- Modify: `apps/api/src/modules/identity/infra/firebase/firebase-token-validator.adapter.ts`
- Test: `apps/api/src/shared/config/env.validation.spec.ts` (criar)

- [ ] **Step 2.1: Escrever testes (falhando)**

Criar `apps/api/src/shared/config/env.validation.spec.ts`:

```ts
import { validateEnv } from './env.validation';

const BASE = {
  DATABASE_URL: 'postgres://localhost/db',
  REDIS_URL: 'redis://localhost',
  JWT_ACCESS_SECRET: 'acc',
  JWT_REFRESH_SECRET: 'ref',
};

describe('validateEnv', () => {
  it('accepts missing Firebase vars outside production', () => {
    expect(() => validateEnv({ ...BASE })).not.toThrow();
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'development' })).not.toThrow();
  });

  it('throws in production when Firebase credentials are missing', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'production' })).toThrow(/FIREBASE_PROJECT_ID/);
    expect(() =>
      validateEnv({ ...BASE, NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'p' }),
    ).toThrow(/FIREBASE_CLIENT_EMAIL/);
  });

  it('accepts production with all Firebase credentials', () => {
    expect(() =>
      validateEnv({
        ...BASE,
        NODE_ENV: 'production',
        FIREBASE_PROJECT_ID: 'p',
        FIREBASE_CLIENT_EMAIL: 'svc@p.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: 'key',
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2.2: Rodar e confirmar falha**

Run: `pnpm --filter api test -- env.validation`
Expected: FAIL no teste de produção (hoje não lança)

- [ ] **Step 2.3: Implementar**

Em `env.validation.ts`, adicionar campo à classe `EnvVars`:

```ts
@IsOptional()
@IsString()
NODE_ENV?: string;
```

E, em `validateEnv`, após o bloco `if (errors.length > 0) { ... }` e antes do `return validated;`:

```ts
if (validated.NODE_ENV === 'production') {
  const required = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'] as const;
  const missing = required.filter((key) => !validated[key]);
  if (missing.length > 0) {
    throw new Error(
      `Firebase Admin credentials are required in production (token signature verification). Missing: ${missing.join(', ')}`,
    );
  }
}
```

- [ ] **Step 2.4: Defesa em profundidade no adapter**

Em `firebase-token-validator.adapter.ts`, no início do bloco stub dentro de `validate()` (logo após `if (this.app) { ... }`):

```ts
// Stub mode nunca pode rodar em produção — sem verificação de assinatura,
// qualquer JWT forjado autenticaria.
if (process.env.NODE_ENV === 'production') {
  throw new Error('Firebase stub mode is not allowed in production.');
}
```

- [ ] **Step 2.5: Rodar testes**

Run: `pnpm --filter api test -- env.validation`
Expected: PASS (3 testes)

Run: `pnpm --filter api test`
Expected: PASS (suite inteira — o adapter spec existente não roda em NODE_ENV=production)

- [ ] **Step 2.6: Commit**

```bash
git add apps/api/src/shared/config apps/api/src/modules/identity/infra/firebase
git commit -m "fix(api): require Firebase credentials in production, forbid stub token validation"
```

---

### Task 3: S3 — CORS allowlist

**Files:**
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/shared/config/env.validation.ts`

- [ ] **Step 3.1: Adicionar env var**

Em `env.validation.ts`, classe `EnvVars`:

```ts
/** Origens permitidas para CORS, separadas por vírgula. Obrigatória em produção para habilitar cross-origin. */
@IsOptional()
@IsString()
CORS_ORIGINS?: string;
```

- [ ] **Step 3.2: Trocar CORS no bootstrap**

Em `main.ts`: mover `const config = app.get(ConfigService);` e `const isProd = ...` para **antes** de `app.enableCors(...)` e substituir a chamada:

```ts
const corsOrigins = config
  .get<string>('CORS_ORIGINS')
  ?.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.enableCors({
  // Produção sem CORS_ORIGINS definido = nenhuma origem cross-site permitida.
  // Dev sem CORS_ORIGINS = reflete qualquer origem (localhost com portas variadas).
  origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : !isProd,
  credentials: true,
});
```

- [ ] **Step 3.3: Verificar**

Run: `pnpm --filter api typecheck && pnpm --filter api test`
Expected: sem erros / PASS

- [ ] **Step 3.4: Commit + nota operacional**

```bash
git add apps/api/src/main.ts apps/api/src/shared/config/env.validation.ts
git commit -m "fix(api): restrict CORS to explicit allowlist via CORS_ORIGINS"
```

Operação (fazer no deploy, não bloqueia o código): `fly secrets set CORS_ORIGINS=https://<dominio-admin>.vercel.app`.

---

### Task 4: S4 — Rate limit nos endpoints públicos de auth

**Files:**
- Modify: `apps/api/package.json` (dep nova)
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/identity/http/admin-auth.controller.ts`
- Modify: `apps/api/src/modules/identity/http/client-auth.controller.ts`

- [ ] **Step 4.1: Instalar**

Run: `pnpm --filter api add @nestjs/throttler`

- [ ] **Step 4.2: Registrar módulo + guard global**

Em `app.module.ts`:

```ts
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
```

Em `imports`, após `ScheduleModule.forRoot(),`:

```ts
ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
```

Em `providers`, junto aos outros `APP_GUARD`:

```ts
{ provide: APP_GUARD, useClass: ThrottlerGuard },
```

- [ ] **Step 4.3: Limite apertado nos exchanges**

Em `admin-auth.controller.ts` e `client-auth.controller.ts`, no método `exchange`:

```ts
import { Throttle } from '@nestjs/throttler';

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('exchange')
```

- [ ] **Step 4.4: Verificar**

Run: `pnpm --filter api typecheck && pnpm --filter api test`
Expected: sem erros / PASS (guard global não afeta unit tests, que instanciam use cases direto)

- [ ] **Step 4.5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/app.module.ts apps/api/src/modules/identity/http
git commit -m "feat(api): add global rate limiting with strict limits on public auth exchange"
```

---

### Task 5: C1 — Race no primeiro login do cliente vira retry, não 500

**Files:**
- Modify: `apps/api/src/modules/identity/domain/errors/identity.errors.ts`
- Modify: `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`
- Modify: `apps/api/src/modules/identity/infra/repositories/user-drizzle.repository.ts`
- Modify: `apps/api/src/modules/identity/application/use-cases/exchange-firebase-client-token.use-case.ts`
- Test: `apps/api/src/modules/identity/application/use-cases/exchange-firebase-client-token.use-case.spec.ts`

- [ ] **Step 5.1: Erro de domínio + mapeamento**

`identity.errors.ts`:

```ts
export class UserAlreadyExistsError extends DomainError {
  readonly code = 'USER_ALREADY_EXISTS';
  constructor(message = 'Já existe um usuário com estes dados nesta barbearia.') {
    super(message);
  }
}
```

`domain-exception.filter.ts`, no mapa:

```ts
USER_ALREADY_EXISTS: HttpStatus.CONFLICT,
```

- [ ] **Step 5.2: Teste do retry (falhando)**

Adicionar ao spec do client use case (`exchange-firebase-client-token.use-case.spec.ts`), dentro do `describe` existente — importar `UserAlreadyExistsError`:

```ts
it('recovers when a concurrent request already created the user (unique violation)', async () => {
  const concurrentUser = User.reconstitute({
    id: 'created-by-other-request',
    tenantId: TENANT_ID,
    name: null,
    role: 'CLIENT',
    phone: '+5511999999999',
    email: null,
    firebaseUid: FIREBASE_UID,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const userRepo = makeUserRepo();
  (userRepo.findByFirebaseUidAnyTenant as jest.Mock)
    .mockResolvedValueOnce(null) // primeira leitura: ainda não existe
    .mockResolvedValueOnce(concurrentUser); // releitura pós-conflito
  (userRepo.save as jest.Mock).mockRejectedValue(new UserAlreadyExistsError());

  const uc = new ExchangeFirebaseClientTokenUseCase(
    makeValidator(),
    userRepo,
    makeIssuer(makeRefreshRepo()),
    makeTenantLookup(),
  );
  const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
  expect(result.user.id).toBe('created-by-other-request');
});

it('rethrows UserAlreadyExistsError when the conflict is not resolvable by re-reading', async () => {
  const userRepo = makeUserRepo();
  (userRepo.save as jest.Mock).mockRejectedValue(new UserAlreadyExistsError());
  const uc = new ExchangeFirebaseClientTokenUseCase(
    makeValidator(),
    userRepo,
    makeIssuer(makeRefreshRepo()),
    makeTenantLookup(),
  );
  await expect(uc.execute({ idToken: 'tok', tenantId: TENANT_ID })).rejects.toBeInstanceOf(
    UserAlreadyExistsError,
  );
});
```

Obs.: usar os helpers existentes desse spec (mesmo formato do spec de admin). Se `makeValidator` do spec de client não devolver phone, ajustar para `phone: '+5511999999999'` no mock (o use case exige phone).

- [ ] **Step 5.3: Rodar e confirmar falha**

Run: `pnpm --filter api test -- exchange-firebase-client-token.use-case`
Expected: FAIL (hoje a exceção do save sobe direto)

- [ ] **Step 5.4: Repositório traduz 23505**

Em `user-drizzle.repository.ts`, importar `UserAlreadyExistsError` de `../../domain/errors/identity.errors` e envolver o corpo de `save`:

```ts
async save(user: User): Promise<User> {
  const now = new Date();
  try {
    const [row] = await this.db
      .insert(schema.users)
      .values({
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        role: user.role,
        phone: user.phone,
        email: user.email,
        firebaseUid: user.firebaseUid,
        createdAt: user.createdAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        // Conflict on the PK (id), not firebaseUid: firebaseUid has a unique
        // index but NULLs never collide on it, so targeting firebaseUid could
        // let a re-save of a user without one fall through to a duplicate-pkey
        // error instead of updating the existing row.
        target: schema.users.id,
        set: {
          name: user.name,
          updatedAt: now,
        },
      })
      .returning();
    return this.toEntity(row);
  } catch (err) {
    // 23505 = unique_violation (firebase_uid ou tenant+phone/email) — vira erro
    // de domínio para o use case decidir entre re-ler e propagar.
    if ((err as { code?: string })?.code === '23505') {
      throw new UserAlreadyExistsError();
    }
    throw err;
  }
}
```

- [ ] **Step 5.5: Use case re-lê após conflito**

Em `exchange-firebase-client-token.use-case.ts`, importar `UserAlreadyExistsError` e substituir o bloco `if (!user) { ... }` final:

```ts
if (!user) {
  const newUser = User.createClient({
    tenantId: input.tenantId,
    phone: firebasePayload.phone,
    firebaseUid: firebasePayload.uid,
  });
  try {
    user = await this.userRepo.save(newUser);
  } catch (err) {
    if (!(err instanceof UserAlreadyExistsError)) throw err;
    // Request concorrente criou o mesmo usuário entre a leitura e o insert.
    const winner = await this.userRepo.findByFirebaseUidAnyTenant(firebasePayload.uid);
    if (!winner) throw err; // conflito veio de outro unique (tenant+phone) — propaga 409
    if (winner.tenantId !== input.tenantId) throw new FirebaseAccountTenantMismatchError();
    user = winner;
  }
}
```

- [ ] **Step 5.6: Rodar testes**

Run: `pnpm --filter api test`
Expected: PASS

- [ ] **Step 5.7: Commit**

```bash
git add apps/api/src/modules/identity apps/api/src/shared/kernel
git commit -m "fix(identity): resolve first-login race by translating unique violation and re-reading"
```

---

### Task 6: C4 — Vincular usuário legado (mesmo telefone, sem firebaseUid)

**Files:**
- Modify: `apps/api/src/modules/identity/domain/entities/user.entity.ts`
- Modify: `apps/api/src/modules/identity/infra/repositories/user-drizzle.repository.ts`
- Modify: `apps/api/src/modules/identity/application/use-cases/exchange-firebase-client-token.use-case.ts`
- Test: `apps/api/src/modules/identity/application/use-cases/exchange-firebase-client-token.use-case.spec.ts`
- Test: `apps/api/src/modules/identity/domain/entities/user.entity.spec.ts`

- [ ] **Step 6.1: Testes da entidade (falhando)**

Adicionar em `user.entity.spec.ts`:

```ts
describe('linkFirebaseUid', () => {
  it('links a firebase uid to a user that has none', () => {
    const user = User.reconstitute({
      id: 'u1',
      tenantId: 't1',
      name: 'Legado',
      role: 'CLIENT',
      phone: '+5511999999999',
      email: null,
      firebaseUid: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    user.linkFirebaseUid('fb-123');
    expect(user.firebaseUid).toBe('fb-123');
  });

  it('refuses to overwrite an existing firebase uid', () => {
    const user = User.reconstitute({
      id: 'u1',
      tenantId: 't1',
      name: null,
      role: 'CLIENT',
      phone: '+5511999999999',
      email: null,
      firebaseUid: 'fb-original',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => user.linkFirebaseUid('fb-other')).toThrow();
  });
});
```

- [ ] **Step 6.2: Rodar e confirmar falha**

Run: `pnpm --filter api test -- user.entity`
Expected: FAIL (`linkFirebaseUid is not a function`)

- [ ] **Step 6.3: Implementar na entidade**

Em `user.entity.ts`, trocar o campo readonly por campo privado + getter + método (demais campos intactos):

```ts
// no corpo da classe User:
private _firebaseUid: string | null;

// no construtor, substituir `this.firebaseUid = props.firebaseUid;` por:
this._firebaseUid = props.firebaseUid;

get firebaseUid(): string | null {
  return this._firebaseUid;
}

/** Vincula conta Firebase a um usuário legado (criado sem login). Idempotente não é: uid existente nunca é sobrescrito. */
linkFirebaseUid(firebaseUid: string): void {
  if (this._firebaseUid) {
    throw new Error('Usuário já está vinculado a uma conta Firebase.');
  }
  this._firebaseUid = firebaseUid;
}
```

Remover `readonly firebaseUid: string | null;` da lista de propriedades.

- [ ] **Step 6.4: Persistir firebaseUid no update do save**

Em `user-drizzle.repository.ts`, no `onConflictDoUpdate.set`, adicionar:

```ts
set: {
  name: user.name,
  firebaseUid: user.firebaseUid,
  updatedAt: now,
},
```

- [ ] **Step 6.5: Teste do vínculo no use case (falhando)**

Adicionar ao spec do client use case:

```ts
it('links firebase uid to a legacy user with the same phone instead of failing', async () => {
  const legacy = User.reconstitute({
    id: 'legacy-id',
    tenantId: TENANT_ID,
    name: 'Cliente Balcão',
    role: 'CLIENT',
    phone: '+5511999999999',
    email: null,
    firebaseUid: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const userRepo = makeUserRepo();
  (userRepo.findByPhone as jest.Mock).mockResolvedValue(legacy);

  const uc = new ExchangeFirebaseClientTokenUseCase(
    makeValidator(),
    userRepo,
    makeIssuer(makeRefreshRepo()),
    makeTenantLookup(),
  );
  const result = await uc.execute({ idToken: 'tok', tenantId: TENANT_ID });
  expect(result.user.id).toBe('legacy-id');
  const saved = (userRepo.save as jest.Mock).mock.calls[0][0] as User;
  expect(saved.firebaseUid).toBe(FIREBASE_UID);
});
```

(Pré-requisito: o `makeValidator` do spec devolve `phone: '+5511999999999'` e `FIREBASE_UID` — conferir/ajustar.)

- [ ] **Step 6.6: Implementar no use case**

Em `exchange-firebase-client-token.use-case.ts`, dentro do `if (!user)` (antes do `User.createClient`):

```ts
if (!user) {
  // Usuário legado criado pelo admin (sem login) com o mesmo telefone: vincula
  // em vez de inserir e estourar o unique (tenant_id, phone).
  const legacy = await this.userRepo.findByPhone(firebasePayload.phone, input.tenantId);
  if (legacy && !legacy.firebaseUid) {
    legacy.linkFirebaseUid(firebasePayload.uid);
    user = await this.userRepo.save(legacy);
  }
}

if (!user) {
  const newUser = User.createClient({ ... }); // bloco existente da Task 5, inalterado
  ...
}
```

- [ ] **Step 6.7: Rodar testes**

Run: `pnpm --filter api test`
Expected: PASS

- [ ] **Step 6.8: Commit**

```bash
git add apps/api/src/modules/identity
git commit -m "feat(identity): link firebase uid to legacy client with same phone on first login"
```

---

### Task 7: C2 + C3 + C5 — Frontend: recaptcha lifecycle, reenvio, mensagens

**Files:**
- Modify: `apps/web/src/pages/login.tsx`
- Test: `apps/web/src/pages/__tests__/login.test.tsx`

- [ ] **Step 7.1: Testes (falhando)**

Adicionar em `login.test.tsx` (o mock de `RecaptchaVerifier` já devolve `{ clear: vi.fn() }`; promovê-lo a spy nomeado):

No topo, junto aos outros mocks:

```ts
const mockRecaptchaClear = vi.fn();
const mockRecaptchaVerifier = vi.fn().mockImplementation(() => ({ clear: mockRecaptchaClear }));
```

No `vi.mock('firebase/auth', ...)`, trocar a linha do `RecaptchaVerifier` por:

```ts
RecaptchaVerifier: function (...args: unknown[]) {
  return mockRecaptchaVerifier(...args);
},
```

No `beforeEach`, adicionar:

```ts
mockRecaptchaVerifier.mockClear();
mockRecaptchaClear.mockClear();
```

Novos testes dentro do `describe`:

```ts
it('recreates the recaptcha verifier after switching tabs (no stale DOM binding)', async () => {
  mockSignInWithPhoneNumber.mockResolvedValue({ confirm: mockConfirm });
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: /telefone/i }));
  fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '+5511999999999' } });
  fireEvent.click(screen.getByRole('button', { name: /enviar c(o|ó)digo/i }));
  await waitFor(() => expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(1));

  // troca de aba destrói o container do recaptcha
  fireEvent.click(screen.getByRole('button', { name: /e-mail/i }));
  expect(mockRecaptchaClear).toHaveBeenCalled();

  // volta e reenvia: verifier novo, não o órfão
  fireEvent.click(screen.getByRole('button', { name: /telefone/i }));
  fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '+5511888888888' } });
  fireEvent.click(screen.getByRole('button', { name: /enviar c(o|ó)digo/i }));
  await waitFor(() => expect(mockSignInWithPhoneNumber).toHaveBeenCalledTimes(2));
  expect(mockRecaptchaVerifier).toHaveBeenCalledTimes(2);
});

it('lets the user go back to change the number / resend the code', async () => {
  mockSignInWithPhoneNumber.mockResolvedValue({ confirm: mockConfirm });
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', { name: /telefone/i }));
  fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '+5511999999999' } });
  fireEvent.click(screen.getByRole('button', { name: /enviar c(o|ó)digo/i }));
  await waitFor(() => expect(screen.getByLabelText(/c(o|ó)digo/i)).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /trocar número/i }));
  expect(screen.queryByLabelText(/c(o|ó)digo/i)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/telefone/i)).not.toBeDisabled();
});
```

- [ ] **Step 7.2: Rodar e confirmar falha**

Run: `pnpm --filter web test`
Expected: FAIL nos 2 testes novos

- [ ] **Step 7.3: Implementar em `login.tsx`**

(a) Cleanup do verifier ao trocar de aba/desmontar — adicionar `useEffect` após os states do phone:

```ts
useEffect(() => {
  return () => {
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
  };
}, [method]);
```

(b) Em `handleSendCode`, no `catch`, invalidar o verifier consumido:

```ts
} catch (err) {
  recaptchaVerifierRef.current?.clear();
  recaptchaVerifierRef.current = null;
  toast.error(firebaseErrorMessage(err));
}
```

(c) Reset do fluxo — função nova + botão no form de telefone (renderizado junto do campo de código):

```ts
function resetPhoneFlow() {
  setConfirmation(null);
  setCode('');
}
```

```tsx
{confirmation && (
  <Button type="button" variant="ghost" className="w-full" onClick={resetPhoneFlow}>
    Trocar número ou reenviar código
  </Button>
)}
```

(d) C5 — fallback de mensagem em `firebaseErrorMessage`:

```ts
function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && FIREBASE_ERROR_MESSAGES[code]) return FIREBASE_ERROR_MESSAGES[code];
  // Erros do Firebase não mapeados vêm em inglês — não expor ao usuário.
  if (code?.startsWith('auth/')) return 'Erro ao fazer login. Tente novamente.';
  return err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.';
}
```

(Erros da nossa API chegam sem `code` `auth/*` e já têm mensagem pt-BR do backend — continuam passando.)

- [ ] **Step 7.4: Rodar testes**

Run: `pnpm --filter web test && pnpm --filter web typecheck`
Expected: PASS / sem erros

- [ ] **Step 7.5: Commit**

```bash
git add apps/web/src/pages
git commit -m "fix(web): recaptcha verifier lifecycle, resend flow and error message fallback on phone login"
```

---

### Task 8: S5 — Higiene de arquivos

**Files:**
- Modify: `.gitignore`

- [ ] **Step 8.1: Ignorar artefatos locais**

Adicionar ao final do `.gitignore`:

```
# local tooling / stray artifacts
.playwright-mcp/
.mcp.json
google-services*.json
landing-full.png
```

- [ ] **Step 8.2: Verificar**

Run: `git status --short`
Expected: nenhum dos arquivos acima listado como `??` (apenas o plano/review novos em docs/).

- [ ] **Step 8.3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore local tooling artifacts and stray firebase client config"
```

Nota manual para o usuário: mover `google-services (1).json` para o projeto Flutter como `android/app/google-services.json` e apagar a cópia da raiz quando conveniente.

---

### Task 9: Verificação final

- [ ] **Step 9.1: Suites completas**

Run: `pnpm --filter api test && pnpm --filter api typecheck && pnpm --filter web test && pnpm --filter web typecheck`
Expected: tudo PASS

- [ ] **Step 9.2: Atualizar review**

Marcar no `docs/reviews/2026-07-12-review-login-telefone-firebase.md` a seção "Veredito final" com nota: bloqueadores corrigidos em <hashes dos commits>.

- [ ] **Step 9.3: Commit dos docs**

```bash
git add docs
git commit -m "docs: add phone-login review and remediation plan"
```
