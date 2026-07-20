# barber-platform

Monorepo da plataforma de barbearia (multi-tenant). Backend NestJS + Drizzle, painel admin React, mobile Flutter em repo separado (`barber-mobile`).

## Stack

- **API** (`apps/api`) — NestJS 11 + TypeScript + Drizzle ORM + PostgreSQL 16 + Redis 7. Deploy: Fly.io (`barber-api`, região `gru`).
- **Admin web** (`apps/web`) — React 18 + Vite 6 + Tailwind + shadcn/ui + TanStack Query + Zustand. Auth admin via Firebase. Deploy: Vercel.
- **Dev local** — Docker Compose (Postgres + Redis; Evolution API opcional para WhatsApp).
- **Monorepo** — pnpm workspaces + Turborepo. CI no GitHub Actions (`ci.yml`, `release.yml` com Changesets).

## Bounded contexts (API)

```
Identity ──┐
Catalog ───┤  chamadas diretas via interface (leitura)
Team ──────┤  + eventos in-process (EventEmitter2) entre contextos
Scheduling ┤  Scheduling é o CORE (booking, disponibilidade, overlap)
           └──> AppointmentConfirmed/Cancelled/ReminderDue ──> Notifications
                                                  (BullMQ delayed p/ lembrete)
```

| Contexto      | Responsabilidade                                        |
|---------------|---------------------------------------------------------|
| Identity      | auth (OTP cliente / Firebase admin), usuários, roles    |
| Catalog       | serviços, preços, duração                               |
| Team          | barbeiros, jornadas, folgas                             |
| Scheduling    | agendamentos, disponibilidade, política de booking      |
| Notifications | WhatsApp (confirmação, lembrete, cancelamento)          |

## Setup

Pré-requisitos: Node ≥ 22, pnpm 10, Docker.

```bash
pnpm install

# sobe Postgres + Redis
docker compose up -d

# API
cp apps/api/.env.example apps/api/.env   # preencher segredos
pnpm --filter api db:generate            # gera migrations a partir do schema
pnpm --filter api db:migrate             # aplica migrations
pnpm --filter api db:seed                # cria tenant "Barbearia do Amigo"

# Web
cp apps/web/.env.example apps/web/.env   # VITE_API_URL, VITE_FIREBASE_*, VITE_TENANT_SLUG

# dev (todos os apps)
pnpm dev
```

API sobe em `http://localhost:3000`:
- Health: `GET /health` (checa Postgres + Redis)
- Swagger: `GET /docs`
- Rotas de negócio: prefixo `/api/v1`

Web sobe em `http://localhost:5173` (Vite).

## Scripts

Raiz (via Turborepo):

| Comando           | Ação                                  |
|-------------------|---------------------------------------|
| `pnpm dev`        | turbo dev em todos os apps            |
| `pnpm build`      | build de todos os apps                |
| `pnpm lint`       | eslint                                |
| `pnpm typecheck`  | tsc --noEmit                          |
| `pnpm test`       | testes (Jest na API, Vitest no web)   |

API (`pnpm --filter api <script>`):

| Comando        | Ação                                     |
|----------------|------------------------------------------|
| `db:generate`  | gera migration a partir do schema        |
| `db:migrate`   | aplica migrations                        |
| `db:push`      | push direto do schema (só dev)           |
| `db:studio`    | Drizzle Studio                           |
| `db:seed`      | seed do tenant de desenvolvimento        |
| `test:e2e`     | testes e2e (supertest)                   |

## Estrutura

```
apps/
  api/                  NestJS (5 módulos DDD: domain/application/infra)
    src/modules/        identity, catalog, team, scheduling, notifications
    src/shared/         kernel, tenancy, auth, database (+ schema), health, config
    drizzle/            migrations + seed (schema fica em src/shared/database/schema)
    Dockerfile          imagem usada pelo deploy no Fly.io
  web/                  React 18 + Vite (painel admin)
    src/pages/          landing, login, dashboard, appointments, barbers, services
    src/components/     UI (shadcn/ui)
    src/store/          Zustand
docker-compose.yml      Postgres + Redis (+ Evolution API comentado)
fly.toml                deploy da API (Fly.io)
vercel.json             deploy do web (Vercel, SPA rewrite)
```

## Deploy

- **API** → Fly.io: `fly deploy` na raiz (usa `apps/api/Dockerfile`, healthcheck em `/health`).
- **Web** → Vercel: build `pnpm --filter web build`, output `apps/web/dist`, rewrite SPA para `index.html`.

## Regras não-negociáveis

- `domain/` e `application/` nunca importam de `infra/`. ESLint barra.
- `domain/` de um módulo nunca importa `domain/` de outro. Use eventos/interfaces.
- Toda query em tabela com `tenant_id` filtra por ele (via `BaseTenantRepository`).
- Migrations só via Drizzle. Conventional Commits.
