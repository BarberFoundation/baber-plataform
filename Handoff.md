\# HANDOFF — Projeto Barbearia



Documento de transferência de contexto. Cole isso (ou o caminho dele) em uma nova sessão de Claude Code pra continuar o projeto do ponto em que parou.



\---



\## 0. Como usar este documento



\*\*Para o próximo Claude Code:\*\*

> Estou continuando um projeto. Leia `HANDOFF.md` por completo antes de propor qualquer coisa. O documento contém: prompt original do projeto, decisões arquiteturais já fechadas, e o próximo passo definido. Não refaça decisões já tomadas. Pode pedir esclarecimento se algo estiver ambíguo, mas assuma que tudo na seção "Decisões fechadas" é definitivo.



\---



\## 1. Contexto do projeto



\### Sobre o desenvolvedor

\- Stack que domina: Node.js/TypeScript, NestJS, DDD + Clean Architecture, Drizzle ORM, PostgreSQL, React 19 + Vite, Flutter (domain/datasource/repository, ValueNotifier/Provider/Riverpod, BLoC), Docker, Git.

\- CLI própria de scaffolding (`create-gabryel`) com templates NestJS+DDD+Drizzle, React+Vite, Turborepo monorepo — disponível pra reaproveitar.

\- Experiência com Evolution API (WhatsApp) em projetos anteriores (bots multi-agente).

\- Prefere aprender fazendo. Quer feedback direto e honesto, sem rodeios.



\### Sobre o projeto

\- \*\*Objetivo:\*\* app completo (sem overengineering) pra barbearia pequena/média.

\- \*\*Cliente:\*\* amigo dono de barbearia real (valor simbólico, projeto principal de portfólio).

\- \*\*Plataformas:\*\* mobile (cliente final, Flutter) + web (painel admin, React).

\- \*\*Escopo funcional:\*\*

&#x20; - Cliente: cadastro/login, listagem de barbeiros/serviços/preços, agendamento com checagem real de disponibilidade, histórico, cancelamento/remarcação, notificação WhatsApp.

&#x20; - Admin: gestão de agenda, cadastro serviços/preços, cadastro clientes + histórico, faturamento básico.

\- \*\*Fora de escopo agora:\*\* pagamento online, fidelidade/pontos, multi-loja por enquanto (mas multi-tenant SIM no schema — ver decisão).

\- \*\*Volume:\*\* baixo (não precisa pensar em escala de milhares de usuários).

\- \*\*Prazo:\*\* livre, sem deadline.



\---



\## 2. Decisões fechadas



\### 2.1 Repositórios (2 repos separados)

\- \*\*`barbearia-platform`\*\* — monorepo Turborepo: `apps/api` (NestJS) + `apps/admin-web` (React 19 + Vite) + `packages/\*` compartilhados.

\- \*\*`barbearia-mobile`\*\* — Flutter standalone.



\### 2.2 Stack

\- Backend: \*\*NestJS + TypeScript + Drizzle ORM + PostgreSQL + Redis\*\*.

\- Admin web: \*\*React 19 + Vite + Tailwind CSS + shadcn/ui\*\*.

\- Mobile: \*\*Flutter\*\*.

\- Dev local: \*\*Docker Compose\*\* (Postgres + Redis).



\### 2.3 Arquitetura backend

\- \*\*Monolito modular\*\* (não microserviços).

\- \*\*DDD + Clean Architecture\*\*: cada módulo com `domain/`, `application/`, `infra/`.

\- \*\*5 bounded contexts:\*\*

&#x20; 1. \*\*Identity\*\* — auth, usuários, roles.

&#x20; 2. \*\*Catalog\*\* — serviços, preços, duração.

&#x20; 3. \*\*Team\*\* — barbeiros, jornadas de trabalho, folgas.

&#x20; 4. \*\*Scheduling\*\* — agendamentos, disponibilidade, políticas de booking. \*\*Core do sistema.\*\*

&#x20; 5. \*\*Notifications\*\* — envio WhatsApp (confirmação, lembrete, cancelamento).

\- \*\*ESLint\*\* com `no-restricted-imports` barra imports cruzados entre `domain/` de módulos diferentes.

\- \*\*Comunicação entre contextos:\*\*

&#x20; - Chamadas diretas via interfaces (síncrono in-process) para leituras simples.

&#x20; - \*\*Eventos in-process\*\* via `EventEmitter2` para reações entre contextos (ex: `AppointmentConfirmed` → `Notifications` consome).

&#x20; - \*\*BullMQ + Redis\*\* SÓ pra Notifications (delayed job de lembrete 1h antes, retry).

\- Faturamento NÃO é bounded context — read-model/query em cima de `appointments WHERE status='COMPLETED'`.



\### 2.4 Multi-tenancy (decisão importante: desde o dia 1)

\- Tabela `tenants { id, name, slug, phone, address, timezone, created\_at }`.

\- Todas tabelas de domínio têm `tenant\_id UUID NOT NULL REFERENCES tenants(id)`.

\- JWT carrega `tenantId`.

\- Middleware NestJS injeta `TenantContext` (request-scoped).

\- Base repository (ou wrapper Drizzle) filtra automaticamente por `tenantId`.

\- Resolução de tenant:

&#x20; - \*\*Web admin:\*\* subdomínio (`barbearia-jose.app.com`) ou path (`/t/barbearia-jose`).

&#x20; - \*\*Mobile cliente:\*\* seleciona barbearia na primeira tela ou via link/QR.

\- \*\*Cliente é entidade POR tenant\*\* — `(tenant\_id, phone)` unique composto. Mesmo telefone pode existir em N tenants.

\- Seed inicial: 1 tenant ("Barbearia do Amigo") criado na migração.

\- Postgres RLS (Row-Level Security) opcional como segunda camada — anotado pra futuro.



\### 2.5 Modelagem do agregado `Appointment` (Scheduling)

\- \*\*Duração livre por serviço\*\* (não usa grid fixo).

\- `Service { id, tenantId, name, priceCents, durationMinutes }`.

\- `Appointment` é agregado raiz com \*\*N items\*\* (combo de serviços no mesmo booking):

&#x20; ```

&#x20; Appointment {

&#x20;   id, tenantId, clientId, barberId,

&#x20;   items: AppointmentItem\[]   // { serviceId, priceSnapshot, durationMinutes }

&#x20;   slot: TimeSlot              // start = início do primeiro item, duration = soma

&#x20;   status: AppointmentStatus

&#x20;   priceSnapshot: Money        // total congelado no booking

&#x20;   createdAt, updatedAt

&#x20; }

&#x20; ```

\- VOs: `TimeSlot { start, durationMinutes }` com método `overlaps()`; `Money { amount, currency }`.

\- Status: `PENDING | CONFIRMED | CANCELLED | COMPLETED | NO\_SHOW` (máquina de estados, transições inválidas lançam domain error).

\- Invariantes:

&#x20; - `slot.start` no futuro ao criar.

&#x20; - `slot.start` dentro da jornada do barbeiro.

&#x20; - Sem overlap com outros appointments do mesmo barbeiro (PENDING/CONFIRMED) do mesmo tenant.

&#x20; - `slot.durationMinutes === sum(items.durationMinutes)`.

&#x20; - `priceSnapshot` = soma dos `priceSnapshot` dos items (congelado no booking).

&#x20; - Cancelamento respeita política configurável (ver 2.6).

\- \*\*Conflito de horário (overlap):\*\*

&#x20; - Domain service `BookingPolicy` valida overlap.

&#x20; - Query usa `tstzrange \&\& tstzrange` no Postgres.

&#x20; - Lock transacional `SELECT ... FOR UPDATE` por `barber\_id` durante insert.

&#x20; - \*\*Exclusion constraint GIST no schema\*\* (defesa em profundidade):

&#x20;   ```sql

&#x20;   ALTER TABLE appointments ADD CONSTRAINT no\_overlap

&#x20;   EXCLUDE USING gist (

&#x20;     tenant\_id WITH =,

&#x20;     barber\_id WITH =,

&#x20;     tstzrange(slot\_start, slot\_start + (duration\_minutes \* interval '1 minute')) WITH \&\&

&#x20;   ) WHERE (status IN ('PENDING','CONFIRMED'));

&#x20;   ```

\- \*\*NO\_SHOW manual\*\* (admin marca depois, sem regra automática agora).



\### 2.6 Política de booking (configurável)

\- Tabela `booking\_policies { id, tenant\_id, min\_cancel\_hours, min\_reschedule\_hours, updated\_at, updated\_by }`.

\- UI no admin pra ajustar.

\- Cache em memória (TTL 1min) pra não bater no banco a cada booking.

\- Valores iniciais: `min\_cancel\_hours = 2`, `min\_reschedule\_hours = 2`.

\- \*\*Reschedule\*\* = use case atômico `RescheduleAppointment` (atualiza `slot` do appointment existente, não cria 2 registros).

\- \*\*Admin/barbeiro pode cancelar sempre\*\* (ignora política, com motivo opcional).



\### 2.7 Disponibilidade

\- Endpoint `GET /availability?barberId=\&date=\&durationMinutes=` retorna lista de `start` válidos.

\- \*\*Granularidade: 10 minutos.\*\*

\- Algoritmo: jornada do barbeiro no dia menos appointments existentes, varre janelas livres retornando starts onde `durationMinutes` cabe.



\### 2.8 Autenticação (híbrida)

\- \*\*Cliente final (mobile)\*\*: OTP via WhatsApp usando Evolution API.

&#x20; - Endpoints: `POST /api/v1/auth/otp/request { phone }` e `POST /api/v1/auth/otp/verify { phone, code }`.

&#x20; - Tabela `otp\_codes { phone, code, expires\_at, attempts, used\_at }`.

&#x20; - Código 6 dígitos, expira 5min, max 3 tentativas, rate limit 1 envio/60s e 5/hora por telefone (via Redis).

&#x20; - Primeiro login com novo telefone cria `User { role: CLIENT, phone, name: null }`; segunda tela pede nome.

\- \*\*Admin (web)\*\*: Firebase Auth (email + senha).

&#x20; - Frontend usa SDK Firebase pra autenticar.

&#x20; - Backend valida `idToken` via Firebase Admin SDK em `POST /api/v1/auth/firebase/exchange`.

&#x20; - Cria/busca user local por `firebase\_uid`, retorna JWT próprio.

\- \*\*API sempre emite JWT próprio\*\* (mesmo formato em ambos os fluxos):

&#x20; - Access token 15min.

&#x20; - Refresh token 30d.

&#x20; - Tabela `refresh\_tokens` pra revogação (rotation).

&#x20; - Mobile: secure storage. Web: httpOnly cookie.

&#x20; - Claim inclui `userId`, `tenantId`, `role`.

\- Roles: `CLIENT | BARBER | ADMIN`. Guards NestJS por endpoint.



\### 2.9 Modelo `users` (Identity)

```ts

{

&#x20; id: UUID,

&#x20; tenant\_id: UUID,

&#x20; name: string | null,

&#x20; role: 'CLIENT' | 'BARBER' | 'ADMIN',

&#x20; phone: string | null,          // unique por tenant se não-null

&#x20; email: string | null,          // unique por tenant se não-null

&#x20; firebase\_uid: string | null,   // unique global se não-null

&#x20; created\_at, updated\_at

}

```

Regra: cada user tem pelo menos `phone` OU `firebase\_uid`.



\### 2.10 Integração mobile + web + backend

\- REST única, sem GraphQL, sem BFF.

\- Versionamento: `/api/v1/...`.

\- `packages/api-contracts` exporta DTOs TS compartilhados api ↔ admin-web (type-safety end-to-end).

\- \*\*OpenAPI\*\* gerado pelo NestJS via `@nestjs/swagger`. Publicado como artifact/Pages. Mobile consome via `openapi-generator` pra Dart.

\- Endpoints `/admin/\*` quando precisar de agregações específicas do painel (mantém monolito modular).



\### 2.11 Notificações WhatsApp

\- Bounded context próprio: `Notifications`.

\- \*\*Evolution API self-hosted\*\* (não WhatsApp Business API oficial).

\- Adapter trocável: interface `WhatsAppGateway` com impl `EvolutionApiAdapter`. Migrar pra WABA depois = trocar 1 classe.

\- Eventos consumidos:

&#x20; - `AppointmentConfirmed` → manda confirmação imediata.

&#x20; - `AppointmentCancelled` → manda aviso.

&#x20; - `AppointmentReminderDue` → manda lembrete (disparado por BullMQ delayed job agendado em `slot.start - 1h` no momento do confirm).

\- Tabela `notification\_requests { id, tenant\_id, recipient\_phone, template, payload, status, sent\_at, error }`.



\### 2.12 Deploy/Infra

\- VPS único (Hetzner/Contabo \~$5/mês) com Docker Compose.

\- \*\*Coolify ou Dokploy\*\* opcional pra experiência PaaS-like.

\- Sem Kubernetes, sem Prometheus/Grafana, sem OpenTelemetry.

\- Logs: \*\*pino\*\* (estruturado JSON).

\- Healthcheck: `GET /health` (verifica Postgres + Redis).



\### 2.13 Testes

\- Unit nos agregados (domain puro, sem mock).

\- Integration nos use cases críticos: `BookAppointment`, `CancelAppointment`, `RescheduleAppointment`, `VerifyOtp`.

\- E2E só no fluxo principal de agendamento (cliente faz booking → confirma → recebe notificação).



\### 2.14 Explicitamente FORA de escopo

\- Pagamento online

\- Programa de fidelidade/pontos

\- Multi-loja como feature de UI (multi-tenant no schema sim, mas dono não tem UI pra gerenciar N barbearias agora)

\- CQRS, Event Sourcing, Saga, Outbox pattern

\- Kafka, RabbitMQ

\- Microserviços

\- GraphQL

\- BFF

\- Kubernetes



\---



\## 3. Estrutura proposta dos repos



\### `barbearia-platform/`

```

barbearia-platform/

├── apps/

│   ├── api/                                NestJS

│   │   ├── src/

│   │   │   ├── modules/

│   │   │   │   ├── identity/

│   │   │   │   │   ├── domain/

│   │   │   │   │   │   ├── entities/user.entity.ts

│   │   │   │   │   │   ├── value-objects/{phone.vo.ts, email.vo.ts}

│   │   │   │   │   │   ├── repositories/user.repository.ts

│   │   │   │   │   │   ├── services/jwt.service.ts

│   │   │   │   │   │   └── errors/

│   │   │   │   │   ├── application/

│   │   │   │   │   │   ├── use-cases/

│   │   │   │   │   │   │   ├── request-otp.use-case.ts

│   │   │   │   │   │   │   ├── verify-otp.use-case.ts

│   │   │   │   │   │   │   ├── exchange-firebase-token.use-case.ts

│   │   │   │   │   │   │   ├── refresh-token.use-case.ts

│   │   │   │   │   │   │   └── logout.use-case.ts

│   │   │   │   │   │   └── dto/

│   │   │   │   │   ├── infra/

│   │   │   │   │   │   ├── http/

│   │   │   │   │   │   │   ├── client-auth.controller.ts   # /auth/otp/\*

│   │   │   │   │   │   │   └── admin-auth.controller.ts    # /auth/firebase/exchange

│   │   │   │   │   │   ├── whatsapp/otp-sender.ts

│   │   │   │   │   │   ├── firebase/{firebase-admin.ts, firebase-token-validator.ts}

│   │   │   │   │   │   └── persistence/

│   │   │   │   │   │       ├── user.drizzle.repository.ts

│   │   │   │   │   │       ├── otp-code.drizzle.repository.ts

│   │   │   │   │   │       └── refresh-token.drizzle.repository.ts

│   │   │   │   │   └── identity.module.ts

│   │   │   │   ├── catalog/                # mesma estrutura DDD

│   │   │   │   ├── team/

│   │   │   │   ├── scheduling/

│   │   │   │   │   ├── domain/

│   │   │   │   │   │   ├── entities/{appointment.entity.ts, appointment-item.entity.ts}

│   │   │   │   │   │   ├── value-objects/time-slot.vo.ts

│   │   │   │   │   │   ├── services/booking-policy.service.ts

│   │   │   │   │   │   ├── events/{appointment-confirmed.event.ts, appointment-cancelled.event.ts, appointment-reminder-due.event.ts}

│   │   │   │   │   │   └── repositories/appointment.repository.ts

│   │   │   │   │   ├── application/

│   │   │   │   │   │   └── use-cases/

│   │   │   │   │   │       ├── book-appointment.use-case.ts

│   │   │   │   │   │       ├── cancel-appointment.use-case.ts

│   │   │   │   │   │       ├── reschedule-appointment.use-case.ts

│   │   │   │   │   │       ├── mark-no-show.use-case.ts

│   │   │   │   │   │       ├── complete-appointment.use-case.ts

│   │   │   │   │   │       └── list-availability.use-case.ts

│   │   │   │   │   └── infra/...

│   │   │   │   └── notifications/

│   │   │   │       ├── application/handlers/

│   │   │   │       │   ├── on-appointment-confirmed.handler.ts

│   │   │   │       │   ├── on-appointment-cancelled.handler.ts

│   │   │   │       │   └── on-appointment-reminder-due.handler.ts

│   │   │   │       └── infra/

│   │   │   │           ├── whatsapp/evolution-api.client.ts

│   │   │   │           └── queue/notification.processor.ts

│   │   │   ├── shared/

│   │   │   │   ├── kernel/

│   │   │   │   │   ├── value-objects/{money.vo.ts, id.vo.ts, datetime.vo.ts}

│   │   │   │   │   └── errors/domain-error.ts

│   │   │   │   ├── tenancy/

│   │   │   │   │   ├── tenant-context.ts

│   │   │   │   │   ├── tenant.middleware.ts

│   │   │   │   │   └── base-repository.ts        # injeta filtro automaticamente

│   │   │   │   ├── events/event-bus.ts

│   │   │   │   └── auth/{jwt.guard.ts, roles.guard.ts, roles.decorator.ts}

│   │   │   ├── main.ts

│   │   │   └── app.module.ts

│   │   ├── drizzle/

│   │   │   ├── schema/                     # arquivos por bounded context

│   │   │   ├── migrations/

│   │   │   └── seed.ts

│   │   ├── drizzle.config.ts

│   │   ├── package.json

│   │   ├── tsconfig.json

│   │   └── .env.example

│   └── admin-web/                          React 19 + Vite + Tailwind + shadcn

│       ├── src/

│       │   ├── components/ui/              # shadcn copia aqui

│       │   ├── features/{auth,services,barbers,schedule,clients,settings,billing}/

│       │   ├── lib/{api-client.ts, firebase.ts}

│       │   ├── App.tsx

│       │   └── main.tsx

│       ├── index.html

│       ├── vite.config.ts

│       ├── tailwind.config.ts

│       ├── components.json                 # shadcn config

│       └── package.json

├── packages/

│   ├── api-contracts/                      DTOs/types compartilhados

│   ├── eslint-config/                      # inclui no-restricted-imports entre módulos

│   └── tsconfig/

├── docker-compose.yml                      Postgres + Redis (+ opcional Evolution)

├── turbo.json

├── pnpm-workspace.yaml

├── package.json

├── .gitignore

└── README.md

```



\### `barbearia-mobile/`

```

barbearia-mobile/

├── lib/

│   ├── core/

│   │   ├── api/                            # cliente HTTP gerado via openapi-generator

│   │   ├── auth/                           # OTP flow, JWT storage

│   │   ├── tenancy/                        # seleção/persistência de tenant

│   │   └── error/

│   ├── features/

│   │   ├── auth/                           # tela de telefone, tela de código, tela de nome

│   │   ├── tenant\_selection/               # primeira tela ou via deep link

│   │   ├── home/

│   │   ├── booking/                        # flow: barbeiro → serviços → horário → confirmar

│   │   ├── barbers/

│   │   ├── services/

│   │   └── history/                        # histórico + cancelar/remarcar

│   └── shared/

│       ├── widgets/

│       └── theme/

├── pubspec.yaml

└── README.md

```



\---



\## 4. Próximo passo definido



\*\*Scaffold do `barbearia-platform`.\*\*



Tudo abaixo precisa ser criado de zero, sem código de negócio ainda — só estrutura, configs e shells de módulo funcionando:



1\. \*\*Raiz do monorepo\*\*

&#x20;  - `package.json` com workspaces

&#x20;  - `pnpm-workspace.yaml`

&#x20;  - `turbo.json`

&#x20;  - `.gitignore`, `.editorconfig`, `.nvmrc`

&#x20;  - `docker-compose.yml` com:

&#x20;    - Postgres 16

&#x20;    - Redis 7

&#x20;    - (Evolution API opcional como service comentado pra dev local)

&#x20;  - `README.md` inicial com instruções de setup, diagrama dos bounded contexts, link pra este HANDOFF.



2\. \*\*`apps/api` (NestJS)\*\*

&#x20;  - `nest-cli.json`, `tsconfig.json`, `package.json`

&#x20;  - Estrutura completa de pastas dos 5 módulos (todas vazias, mas com `\*.module.ts` registrado)

&#x20;  - `main.ts` com Swagger habilitado, validation pipe global, CORS

&#x20;  - `app.module.ts` importando os 5 módulos + `ConfigModule` + `EventEmitterModule` + `BullModule`

&#x20;  - `shared/tenancy/` com `TenantContext` (request-scoped), middleware básico que lê `tenantId` do JWT

&#x20;  - `shared/auth/` com `JwtGuard`, `RolesGuard`, decorator `@Roles()`

&#x20;  - `drizzle.config.ts` apontando pra `./drizzle/schema/\*`

&#x20;  - `drizzle/seed.ts` criando 1 tenant inicial

&#x20;  - `.env.example` com TODAS variáveis:

&#x20;    ```

&#x20;    DATABASE\_URL=postgresql://postgres:postgres@localhost:5432/barbearia

&#x20;    REDIS\_URL=redis://localhost:6379

&#x20;    JWT\_ACCESS\_SECRET=

&#x20;    JWT\_REFRESH\_SECRET=

&#x20;    JWT\_ACCESS\_TTL=15m

&#x20;    JWT\_REFRESH\_TTL=30d

&#x20;    EVOLUTION\_API\_URL=

&#x20;    EVOLUTION\_API\_KEY=

&#x20;    EVOLUTION\_INSTANCE\_NAME=

&#x20;    FIREBASE\_PROJECT\_ID=

&#x20;    FIREBASE\_CLIENT\_EMAIL=

&#x20;    FIREBASE\_PRIVATE\_KEY=

&#x20;    PORT=3000

&#x20;    ```

&#x20;  - Health check em `GET /health` (verifica Postgres + Redis)



3\. \*\*`apps/admin-web` (React 19 + Vite + Tailwind + shadcn)\*\*

&#x20;  - `vite.config.ts`, `tsconfig.json`, `package.json`

&#x20;  - Tailwind configurado (`tailwind.config.ts`, `postcss.config.js`, `globals.css`)

&#x20;  - shadcn inicializado (`components.json`, `src/components/ui/` com pelo menos `button.tsx` pra validar)

&#x20;  - `src/lib/api-client.ts` (axios/fetch wrapper apontando pra API)

&#x20;  - `src/lib/firebase.ts` (init do SDK Firebase)

&#x20;  - `App.tsx` placeholder com "Hello, barbearia"

&#x20;  - `.env.example`:

&#x20;    ```

&#x20;    VITE\_API\_URL=http://localhost:3000/api/v1

&#x20;    VITE\_FIREBASE\_API\_KEY=

&#x20;    VITE\_FIREBASE\_AUTH\_DOMAIN=

&#x20;    VITE\_FIREBASE\_PROJECT\_ID=

&#x20;    ```



4\. \*\*`packages/api-contracts`\*\*

&#x20;  - `package.json`, `tsconfig.json`

&#x20;  - `src/index.ts` exportando types vazios por enquanto (organizados por módulo)



5\. \*\*`packages/eslint-config`\*\*

&#x20;  - `index.js` com regras base + `no-restricted-imports` que barra:

&#x20;    - `modules/\*/domain` importando de `modules/\*/domain` de OUTRO módulo

&#x20;    - `modules/\*/domain` importando de qualquer `infra/`



6\. \*\*`packages/tsconfig`\*\*

&#x20;  - `base.json`, `nestjs.json`, `react.json`



7\. \*\*CI básico (opcional, mas recomendado)\*\*

&#x20;  - `.github/workflows/ci.yml`: lint + typecheck + build em todos os apps.



\*\*Validar scaffold:\*\*

\- `pnpm install` na raiz funciona.

\- `pnpm dev` (turbo) sobe api em :3000 e admin-web em :5173.

\- `docker compose up` sobe Postgres + Redis.

\- `pnpm --filter api test` roda (mesmo sem testes ainda, framework funciona).

\- `pnpm --filter api db:migrate` aplica migração inicial (cria tabela `tenants` mínima).

\- `pnpm --filter api db:seed` cria 1 tenant ("Barbearia do Amigo").



\---



\## 5. Backlog de implementação (após scaffold)



Ordem sugerida (pode ser reavaliada quando começar):



1\. \*\*Identity — flow admin (Firebase)\*\*

&#x20;  - Use case `ExchangeFirebaseToken`.

&#x20;  - Guards JWT + Roles funcionando.

&#x20;  - Endpoint `GET /me` retornando user logado.

&#x20;  - Tela de login web (admin) com Firebase SDK.



2\. \*\*Catalog — CRUD de Services\*\*

&#x20;  - Entidade, repository, use cases (create/update/list/delete).

&#x20;  - Endpoints `/admin/services`.

&#x20;  - Tela admin de gestão de serviços.



3\. \*\*Team — CRUD de Barbers + WorkSchedule\*\*

&#x20;  - Entidade `Barber`, value object `WorkSchedule` (jornada semanal).

&#x20;  - Endpoints `/admin/barbers`.

&#x20;  - Tela admin.



4\. \*\*Scheduling — booking flow completo (core)\*\*

&#x20;  - Agregado `Appointment` com items, invariantes, máquina de estados.

&#x20;  - Domain service `BookingPolicy`.

&#x20;  - Migration com exclusion constraint GIST.

&#x20;  - Use cases: `BookAppointment`, `CancelAppointment`, `RescheduleAppointment`, `ListAvailability`, `MarkNoShow`, `CompleteAppointment`.

&#x20;  - Configuração de política (entidade `BookingPolicy` + tela admin).

&#x20;  - Endpoints `/appointments`, `/availability`, `/admin/booking-policy`.



5\. \*\*Identity — flow cliente (OTP)\*\*

&#x20;  - Use cases `RequestOtp` e `VerifyOtp`.

&#x20;  - Adapter Evolution pra envio.

&#x20;  - Rate limit Redis.

&#x20;  - (Mobile consome quando for implementado.)



6\. \*\*Notifications\*\*

&#x20;  - Handlers dos 3 eventos.

&#x20;  - Processor BullMQ pra delayed reminder.

&#x20;  - Templates de mensagem.



7\. \*\*Admin web — telas restantes\*\*

&#x20;  - Visão de agenda diária/semanal por barbeiro.

&#x20;  - Gestão de clientes + histórico.

&#x20;  - Dashboard de faturamento (read-model em cima de `appointments COMPLETED`).

&#x20;  - Configurações (booking policy, dados do tenant).



8\. \*\*Mobile (Flutter)\*\*

&#x20;  - Setup do repo `barbearia-mobile`.

&#x20;  - Geração de cliente HTTP via openapi-generator.

&#x20;  - Telas: tenant selection → auth (telefone + código + nome) → home → booking flow → histórico.



9\. \*\*Deploy\*\*

&#x20;  - VPS provisionado.

&#x20;  - Coolify/Dokploy.

&#x20;  - Domínio + subdomínio por tenant.

&#x20;  - Backup automático do Postgres.

&#x20;  - Evolution API hospedada.



\---



\## 6. Convenções e regras não-negociáveis



\- \*\*Nunca\*\* importar de `infra/` em `domain/` ou `application/`.

\- \*\*Nunca\*\* importar de `domain/` de outro módulo (use eventos ou interfaces explícitas).

\- \*\*Toda query\*\* que toca tabela com `tenant\_id` deve filtrar por ele. Base repository ou helper garante isso automaticamente — não fazer query crua sem ele.

\- \*\*Migrations\*\*: sempre via Drizzle, nunca SQL manual em prod.

\- \*\*Commits\*\*: Conventional Commits.

\- \*\*Testes\*\*: agregados de domínio NÃO podem ser testados com mock de banco — domain é puro, testa sem framework.

\- \*\*Sem comentários óbvios\*\* no código. Só comentário pra explicar PORQUÊ não-óbvio.

\- \*\*Sem código morto\*\*, sem feature flag desnecessária, sem abstração prematura.



\---



\## 7. Pontos abertos (não decididos, podem virar pergunta depois)



\- Estratégia exata de subdomínio vs path no admin web (subdomínio é melhor mas exige DNS wildcard).

\- Layout exato da máquina de estados de `Appointment` (transições válidas) — esboçado mas pode refinar quando implementar.

\- Granularidade configurável por tenant ou global (10min é global por enquanto, mas amanhã alguém pode querer 15min — fica anotado).

\- Política de tentativas de OTP além do 3 (bloqueio temporário do telefone?).

\- Política de Firebase: aceitar só email verificado? Bloquear domínios públicos? Hoje aceita tudo.



Esses NÃO bloqueiam o scaffold nem o início da implementação. Decidir quando bater o ponto.



\---



\## 8. Como retomar com novo Claude Code



Cole isto no início da nova conversa:



> Estou retomando um projeto em outro PC. Leia o arquivo `HANDOFF.md` que está na raiz do projeto antes de fazer qualquer coisa. Ele contém:

> - Contexto do projeto (barbearia, portfólio, baixo volume).

> - Decisões arquiteturais JÁ FECHADAS — não refaça.

> - Próximo passo definido (scaffold do `barbearia-platform`).

> - Backlog ordenado de implementação.

>

> Confirme que leu, resuma em 5 linhas o estado atual, e me pergunte se podemos seguir com o próximo passo (scaffold).



\---



\## 9. Arquivo original



O prompt original do projeto está em `prompt-arquitetura-barbearia.md` na mesma pasta. Foi a base de toda a sessão de design que gerou as decisões acima.



\---



\*\*Última atualização:\*\* 2026-06-30.

