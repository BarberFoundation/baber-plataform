# Backend OTP Auth (Identity) — Design

Status: aprovado (autor decidiu prosseguir com defaults recomendados, ausente durante revisão — ver seção "Decisões tomadas sem confirmação ao vivo"). Depende de: nenhum. Bloqueia: `docs/superpowers/plans/2026-07-02-mobile-setup-auth.md`.

## Escopo

Fecha o contrato de auth do cliente final definido no `Handoff.md` §2.8, hoje inexistente no código (só Firebase admin existe):

1. `POST /api/v1/auth/otp/request { phone, tenantId }` — gera código, envia via WhatsApp.
2. `POST /api/v1/auth/otp/verify { phone, code, tenantId }` — valida código, cria/recupera `User CLIENT`, emite JWT (mesmo formato do fluxo admin).
3. `PATCH /api/v1/me { name }` — primeiro login seta nome.
4. `GET /api/v1/tenants` e `GET /api/v1/tenants/:slug` — listagem pública para seleção de tenant no mobile (pré-requisito de qualquer chamada acima, já que OTP é escopado por tenant).

Fora de escopo: rotação de refresh token diferente da já existente, 2FA, multi-telefone por usuário, alteração no fluxo admin/Firebase.

## Decisões tomadas sem confirmação ao vivo

O usuário aprovou seguir com as opções recomendadas e ficou ausente durante o restante do brainstorming. Registradas aqui para revisão posterior caso algo precise mudar:

- **Tenant scoping do OTP:** `tenantId` explícito no body (`{ phone, tenantId }`), replicando o padrão já existente em `ExchangeTokenDto` — não usa `TenantContext`/header, que hoje nenhum use case consome.
- **Listagem de tenants:** endpoint público dentro do módulo Identity (`TenantsController`), não um bounded context novo — não há dono natural da tabela `tenants` hoje.

## Modelagem

### Tabela `otp_codes` (nova)

```ts
export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),   // sha256, mesmo padrão de refresh_tokens
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Código nunca fica em texto plano no banco — mesmo tratamento que `refresh_tokens.token_hash`.

### `User` entity — novo factory

`User.createClient({ tenantId, phone })` além do `createAdmin` já existente: `role: 'CLIENT'`, `phone`, `name: null`, `firebaseUid: null`, `email: null`.

### Refatoração: extrair emissão de par de tokens

`ExchangeFirebaseTokenUseCase` e `RefreshTokenUseCase` hoje duplicam a lógica de gerar access token + refresh token + salvar hash (linhas ~56-69 em cada). O `VerifyOtpUseCase` precisaria de uma terceira cópia. Extrair para `TokenPairIssuer` (application service, `modules/identity/application/services/token-pair-issuer.ts`):

```ts
export class TokenPairIssuer {
  constructor(
    private readonly refreshRepo: IRefreshTokenRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async issue(user: User): Promise<AuthResult> {
    // gera access token, refresh token cru + hash, salva refresh_tokens, retorna AuthResult
  }
}
```

`AuthResult.user` ganha `phone: string | null` (hoje só tem `id, name, role, email`) — mobile precisa de `phone` para nada crítico no fluxo, mas mantém o shape consistente com o que `User` expõe; campo populado a partir de `user.phone` (null para admins).

Isso é uma melhoria pontual no código que este spec já mexe (DRY, sem tocar em nada fora do escopo).

## Rate limiting (Redis)

`REDIS` já é provider global (`shared/database/database.module.ts`). `RequestOtpUseCase` usa `ioredis` diretamente (sem abstração nova — é a única consumidora):

- Cooldown: chave `otp:cooldown:{tenantId}:{phone}`, `SET ... EX 60 NX` — se já existir, `OtpRateLimitedError` (mensagem "aguarde antes de solicitar novo código").
- Limite horário: chave `otp:hourly:{tenantId}:{phone}`, `INCR` + `EXPIRE 3600` na primeira escrita; se resultado > 5, `OtpRateLimitedError` (mensagem "limite de tentativas por hora atingido").

## Use cases

### `RequestOtpUseCase`

Input: `{ phone, tenantId }`.

1. Checa rate limit (Redis, acima). Falha → `OtpRateLimitedError`.
2. Gera código de 6 dígitos (`crypto.randomInt(100000, 999999)`).
3. Hash sha256, salva `otp_codes` row (`expiresAt = now + 5min`, `attempts = 0`).
4. Envia via `WHATSAPP_GATEWAY.send(phone, "Seu código de verificação Baber é: {code}. Válido por 5 minutos.")`.
5. Retorna `void` (controller responde 204).

### `VerifyOtpUseCase`

Input: `{ phone, code, tenantId }`.

1. Busca `otp_codes` mais recente para `(tenantId, phone)` com `usedAt IS NULL` e `expiresAt > now`. Não encontrado → `InvalidOtpError` ("código inválido ou expirado").
2. `attempts >= 3` → `InvalidOtpError` (mesma mensagem — não vaza detalhe de tentativas esgotadas vs código errado, evita enumeração).
3. Compara hash do código informado com `codeHash`. Não bate → incrementa `attempts`, `InvalidOtpError`.
4. Bate → marca `usedAt = now`.
5. Busca `User` por `(tenantId, phone)`; não existe → `User.createClient({ tenantId, phone })`, salva.
6. `TokenPairIssuer.issue(user)` → `AuthResult`.
7. Controller retorna `{ accessToken, refreshToken, expiresIn, user }` no body (sem cookie — mobile usa secure storage, diferente do fluxo admin que usa cookie httpOnly).

### `UpdateUserNameUseCase`

Input: `{ userId, tenantId, name }` (de `CurrentUser()`, autenticado — qualquer role pode renomear a si mesmo).

1. Busca `User` por id+tenant. Não encontrado → `UserNotFoundError` (já existe).
2. `user.rename(name)`, salva.
3. Retorna `{ id, name, role, phone, email }`.

### `ListTenantsUseCase` / `FindTenantBySlugUseCase`

Leitura simples via Drizzle direto na tabela `tenants` (sem repositório novo — é uma query pública, sem regra de negócio). `findBySlug` não encontrado → controller responde 404.

## HTTP

- `OtpAuthController` (`auth/otp`, `@Public()` nas duas rotas):
  - `POST /request` — 204 No Content em sucesso.
  - `POST /verify` — 200, body `AuthResult`.
- `MeController` (existente, `me`):
  - `PATCH /` — 200, body do usuário atualizado. Autenticado (guard já global).
- `TenantsController` (`tenants`, `@Public()`):
  - `GET /` — lista `{ id, slug, name }[]`.
  - `GET /:slug` — `{ id, slug, name }` ou 404.

## Erros (novos, em `identity.errors.ts`)

```ts
export class OtpRateLimitedError extends DomainError {
  readonly code = 'OTP_RATE_LIMITED';
}

export class InvalidOtpError extends DomainError {
  readonly code = 'INVALID_OTP';
}
```

Mapeamento HTTP: seguir o filtro global de exceptions já existente no projeto (`DomainError` → status code por convenção do projeto — `OtpRateLimitedError` deve mapear pra 429, `InvalidOtpError` pra 400; se o exception filter atual não tiver esse mapeamento configurável por código, o plano de implementação inclui o ajuste nele).

## Módulo

`IdentityModule` passa a importar `NotificationsModule` (para injetar `WHATSAPP_GATEWAY`). `NotificationsModule` precisa exportar esse token (`exports: [WHATSAPP_GATEWAY]`, hoje ausente). Sem risco de dependência circular — `NotificationsModule` não importa `IdentityModule`.

Novos providers em `IdentityModule`: `OTP_CODE_REPOSITORY` (Drizzle impl), `TokenPairIssuer`, `RequestOtpUseCase`, `VerifyOtpUseCase`, `UpdateUserNameUseCase`, `ListTenantsUseCase`, `FindTenantBySlugUseCase`. Novos controllers: `OtpAuthController`, `TenantsController`.

## Testes

- Unit: `RequestOtpUseCase` (rate limit hit/miss, geração+hash+envio), `VerifyOtpUseCase` (código certo/errado/expirado/esgotado, cria vs reaproveita user), `TokenPairIssuer` (compartilhado, testado uma vez — `ExchangeFirebaseTokenUseCase`/`RefreshTokenUseCase` passam a usá-lo e seus testes existentes continuam cobrindo a integração).
- Unit: `UpdateUserNameUseCase`, `ListTenantsUseCase`, `FindTenantBySlugUseCase`.
- Integração leve (Drizzle contra Postgres de teste, se o projeto já tiver esse padrão — verificar testes existentes de `identity` antes de decidir): repositório `otp_codes`.
- Sem teste de envio real via Evolution API — `WHATSAPP_GATEWAY` mockado nos testes de use case (mesmo padrão de `Notifications`).
