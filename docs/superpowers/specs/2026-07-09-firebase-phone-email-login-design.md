# Login com Email+Senha e Telefone (Firebase), remoção do OTP próprio — Design

Status: proposto. Depende de: nenhum. Substitui/deprecia: `docs/superpowers/specs/2026-07-02-backend-otp-auth-design.md` e o contrato de auth consumido pelos plans em `.worktrees/mobile-app-full` (`2026-07-02-mobile-setup-auth`, `2026-07-03-mobile-auth-ui`). O app mobile em si ainda não foi scaffoldado neste repo — este spec só muda o contrato de backend + o login web admin; a adoção do novo contrato pelo app mobile fica para quando esse app for implementado.

## Escopo

Duas superfícies de login, ambas via Firebase (sem sistema de senha próprio, sem OTP próprio):

1. **Email + senha** — já existe (admin web, `signInWithEmailAndPassword` → `POST /auth/admin/exchange`). Sem mudança de comportamento.
2. **Telefone (SMS nativo do Firebase)** — novo. Substitui o OTP próprio (código gerado no backend + envio via Evolution/WhatsApp) por `signInWithPhoneNumber` do Firebase (recaptcha + SMS enviado pelo próprio Firebase). Vale tanto para login admin no painel web (staff que prefere telefone) quanto para o futuro app mobile do cliente.

Fora de escopo:
- Notificações de agendamento (confirmação/cancelamento/lembrete) que hoje usam `WHATSAPP_GATEWAY`/Evolution — ficam como estão. Troca desse canal por Web Push é spec separada.
- Scaffold do app mobile em si (não existe neste repo ainda).
- Qualquer mudança em `RefreshTokenUseCase` / `LogoutUseCase` / cookie de refresh do fluxo admin.

## Por que remover o OTP próprio

O OTP próprio (`otp-auth.controller`, `request-otp`/`verify-otp` use cases, tabela `otp_codes`) depende do `WHATSAPP_GATEWAY` (Evolution API) só para enviar o código. Decisão do usuário: tirar a dependência de Evolution do fluxo de login inteiramente — Firebase phone auth já resolve envio de SMS nativamente (recaptcha + `signInWithPhoneNumber`), sem precisar de gateway próprio, rate limiting manual em Redis, nem tabela de códigos.

## Modelagem

### `FirebaseTokenPayload` — ganha `phone`

```ts
export interface FirebaseTokenPayload {
  uid: string;
  email: string | undefined;
  phone: string | undefined; // novo — claim `phone_number` do Firebase
  name: string | undefined;
}
```

`FirebaseTokenValidatorAdapter.validate`: modo real lê `decoded.phone_number`; modo stub lê `payload.phone_number` do JWT decodificado sem verificar assinatura (mesmo padrão do `email`/`name` hoje).

### `User` entity — `CreateClientUserProps` ganha `firebaseUid`

Hoje `createClient` não guarda `firebaseUid` (o cliente OTP nunca tinha conta Firebase). Com Firebase phone auth, o cliente passa a ter `firebaseUid`:

```ts
export interface CreateClientUserProps {
  tenantId: string;
  phone: string;
  firebaseUid: string;
}

static createClient(props: CreateClientUserProps): User {
  const now = new Date();
  return new User({
    id: randomUUID(),
    tenantId: props.tenantId,
    name: null,
    role: 'CLIENT',
    phone: props.phone,
    email: null,
    firebaseUid: props.firebaseUid,
    createdAt: now,
    updatedAt: now,
  });
}
```

`CreateAdminUserProps` ganha `phone` opcional (hoje só `email`), para o caso de staff logando por telefone:

```ts
export interface CreateAdminUserProps {
  tenantId: string;
  email: string | null;
  phone: string | null;
  firebaseUid: string;
  name: string | null;
}
```

`User.createAdmin` passa `phone: props.phone` em vez de fixo `null`.

### Uma nova use case: `ExchangeFirebaseClientTokenUseCase`

`ExchangeFirebaseTokenUseCase` (existente) fica reservado para o portal admin: sempre cria `User.createAdmin` quando o usuário é novo, independente de o token trazer email ou telefone (staff pode logar com qualquer um dos dois métodos, mas continua sendo admin). Único ajuste nela: passar `phone: firebasePayload.phone ?? null` na criação.

Para o cliente (mobile, role `CLIENT`), nova use case dedicada — espelha a antiga `VerifyOtpUseCase`, mas a entrada já é um idToken do Firebase (não mais phone+código):

```ts
export interface ExchangeFirebaseClientTokenInput {
  idToken: string;
  tenantId: string;
}

@Injectable()
export class ExchangeFirebaseClientTokenUseCase {
  async execute(input: ExchangeFirebaseClientTokenInput): Promise<AuthResult> {
    const payload = await this.validator.validate(input.idToken).catch(() => {
      throw new InvalidFirebaseTokenError();
    });
    if (!payload.phone) {
      throw new InvalidFirebaseTokenError('Token não contém número de telefone.');
    }

    let user = await this.userRepo.findByFirebaseUidAnyTenant(payload.uid);

    if (!user && !(await this.tenantLookup.existsById(input.tenantId))) {
      throw new TenantNotFoundError();
    }
    if (user && user.tenantId !== input.tenantId) {
      throw new FirebaseAccountTenantMismatchError();
    }
    if (!user) {
      user = await this.userRepo.save(
        User.createClient({ tenantId: input.tenantId, phone: payload.phone, firebaseUid: payload.uid }),
      );
    }

    return this.tokenPairIssuer.issue(user);
  }
}
```

Mesma estrutura da use case admin (reaproveita `TENANT_LOOKUP`, `USER_REPOSITORY`, `FIREBASE_TOKEN_VALIDATOR`, `TokenPairIssuer`) — só troca `createAdmin` por `createClient` e exige `phone` no payload.

## HTTP

### `ClientAuthController` (novo, substitui `OtpAuthController`)

```ts
@Controller('auth/client')
export class ClientAuthController {
  @Public()
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Body() dto: ExchangeTokenDto) {
    return this.exchangeUseCase.execute({ idToken: dto.idToken, tenantId: dto.tenantId });
  }
}
```

`ExchangeTokenDto` é o mesmo shape já usado em `AdminAuthController` (`idToken`, `tenantId`) — pode ser extraído para um DTO compartilhado em `application/dto` já que agora tem dois consumidores.

Resposta: `{ accessToken, refreshToken, expiresIn, user }` no **body**, sem cookie — mantém o padrão já decidido no spec do OTP original (mobile usa secure storage, não cookie httpOnly, diferente do admin web).

### `AdminAuthController` — sem mudança de rota/contrato

Continua `POST /auth/admin/exchange`, cookie httpOnly, aceita idToken vindo de email+senha ou (novo) de telefone+SMS.

## Frontend web (`apps/web/src/pages/login.tsx`)

Duas abas:

- **"E-mail"** — formulário atual, sem mudança.
- **"Telefone"** — novo:
  1. Input de telefone (mesma máscara/validação E.164 usada no backend hoje, `+\d{10,15}`).
  2. `RecaptchaVerifier` invisível montado num `div` oculto no form.
  3. Botão "Enviar código" → `signInWithPhoneNumber(firebaseAuth, phone, recaptchaVerifier)` → guarda `ConfirmationResult` em estado.
  4. Input de código de 6 dígitos aparece → botão "Confirmar" → `confirmationResult.confirm(code)` → `credential.user.getIdToken()`.
  5. Mesmo destino do fluxo email: `POST /auth/admin/exchange` com o idToken resultante.

Erros do Firebase (`auth/invalid-phone-number`, `auth/too-many-requests`, `auth/invalid-verification-code`) mapeados para toasts em português, mesmo padrão de tratamento de erro já usado no `handleSubmit` atual.

## Remoção do OTP próprio

Apagar:
- `apps/api/src/modules/identity/http/otp-auth.controller.ts` (+ `.spec.ts`)
- `apps/api/src/modules/identity/application/use-cases/request-otp.use-case.ts` (+ `.spec.ts`)
- `apps/api/src/modules/identity/application/use-cases/verify-otp.use-case.ts` (+ `.spec.ts`)
- `apps/api/src/modules/identity/domain/repositories/otp-code.repository.ts`
- `apps/api/src/modules/identity/infra/repositories/otp-code-drizzle.repository.ts`
- `OtpRateLimitedError`, `InvalidOtpError` de `identity.errors.ts`
- Wiring de `OTP_CODE_REPOSITORY`, `RequestOtpUseCase`, `VerifyOtpUseCase`, `OtpAuthController` em `identity.module.ts`; adicionar `ExchangeFirebaseClientTokenUseCase`, `ClientAuthController`.
- Migration nova: `DROP TABLE otp_codes`.
- `IdentityModule` deixa de precisar importar `NotificationsModule` (só existia pra injetar `WHATSAPP_GATEWAY` no OTP) — remover o import se nada mais em Identity depender dele.

Não mexe em: `EvolutionApiWhatsAppGateway`, `WHATSAPP_GATEWAY`, `NotificationsModule` — seguem servindo as notificações de agendamento.

## Erros (sem mudança de contrato, reaproveita existentes)

`InvalidFirebaseTokenError`, `TenantNotFoundError`, `FirebaseAccountTenantMismatchError` já existem e cobrem os casos de falha do novo fluxo — nada novo precisa ser criado.

## Testes

- `ExchangeFirebaseClientTokenUseCase`: usuário novo (cria `CLIENT`), usuário existente por `firebaseUid`, tenant mismatch, tenant inexistente, token sem claim de telefone.
- `ExchangeFirebaseTokenUseCase`: caso novo de criação com `phone` preenchido (token de telefone) além dos casos de email já cobertos.
- `User.createClient`/`createAdmin`: specs existentes ajustados pros novos campos.
- Frontend: fluxo de telefone no `login.tsx` — mock do Firebase (`signInWithPhoneNumber`, `RecaptchaVerifier`, `ConfirmationResult.confirm`), mesmo padrão de mock já usado no teste do fluxo email se existir.

## Impacto na branch mobile

`docs/superpowers/specs/2026-07-02-backend-otp-auth-design.md` deve ser marcado como superseded por este documento. Os plans `2026-07-02-mobile-setup-auth` e `2026-07-03-mobile-auth-ui` (na worktree `feature/mobile-app-full`) assumiam `POST /auth/otp/request` + `/verify`; precisam ser revisados para usar `POST /auth/client/exchange` com Firebase phone auth nativo (SDK do Firebase para React Native/Expo, equivalente ao `signInWithPhoneNumber` do web) quando esse app for implementado. Isso é trabalho de uma spec/plan futura na branch mobile, não deste spec.
