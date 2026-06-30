# baber-platform

Monorepo da plataforma de barbearia (multi-tenant). Backend NestJS + Drizzle, painel admin React (a vir), mobile Flutter em repo separado (`baber-mobile`).

> Decisões de arquitetura e backlog: ver [`Handoff.md`](./Handoff.md). Não refazer decisões fechadas lá.

## Stack

- **API** — NestJS 11 + TypeScript + Drizzle ORM + PostgreSQL 16 + Redis 7.
- **Admin web** — React 19 + Vite + Tailwind + shadcn/ui *(scaffold pendente)*.
- **Dev local** — Docker Compose (Postgres + Redis).
- **Monorepo** — pnpm workspaces + Turborepo.

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
pnpm --filter api db:generate            # gera migration a partir do schema
pnpm --filter api db:migrate             # aplica (cria tabela tenants)
pnpm --filter api db:seed                # cria tenant "Barbearia do Amigo"

# dev (todos os apps)
pnpm dev
```

API sobe em `http://localhost:3000`:
- Health: `GET /health` (checa Postgres + Redis)
- Swagger: `GET /docs`
- Rotas de negócio: prefixo `/api/v1`

## Scripts (raiz)

| Comando           | Ação                                  |
|-------------------|---------------------------------------|
| `pnpm dev`        | turbo dev em todos os apps            |
| `pnpm build`      | build de todos os apps                |
| `pnpm lint`       | eslint                                |
| `pnpm typecheck`  | tsc --noEmit                          |
| `pnpm test`       | testes                                |

## Estrutura

```
apps/
  api/                  NestJS (5 módulos DDD: domain/application/infra)
    src/modules/        identity, catalog, team, scheduling, notifications
    src/shared/         kernel, tenancy, auth, database (+ schema), health, config
    drizzle/            migrations + seed (schema fica em src/shared/database/schema)
  admin-web/            (pendente) React 19 + Vite
packages/               (pendente) api-contracts, eslint-config, tsconfig
```

## Regras não-negociáveis

- `domain/` e `application/` nunca importam de `infra/`. ESLint barra.
- `domain/` de um módulo nunca importa `domain/` de outro. Use eventos/interfaces.
- Toda query em tabela com `tenant_id` filtra por ele (via `BaseTenantRepository`).
- Migrations só via Drizzle. Conventional Commits.
