# CRUD Screens Redesign (Agendamentos, Barbeiros, Serviços) — Design

## Contexto

Último de quatro sub-projetos de redesign do app logado (1: design system dark/laranja, 2: login split-screen, 3: dashboard — todos mergeados). `apps/web/src/pages/appointments.tsx`, `barbers.tsx`, `services.tsx` já herdam o tema escuro, mas seguem o padrão genérico: título + (filtro/dialog) + uma tabela num `Card`, sem nenhum resumo visual no topo — diferente do dashboard, que agora tem stat cards com ícone+cor.

Escopo desta fase: **cards de resumo no topo das 3 telas**, reaproveitando o padrão visual já estabelecido no dashboard (ícone circular colorido + número), e consolidação de uma duplicação de código já existente entre `dashboard.tsx` e `appointments.tsx`.

## Consolidação: `appointment-status.ts`

`dashboard.tsx` e `appointments.tsx` já duplicam, de forma idêntica, os dicionários `STATUS_LABEL: Record<AppointmentStatus, string>` e `STATUS_VARIANT: Record<AppointmentStatus, BadgeVariant>`. Este spec adiciona um terceiro par de dicionários (`STATUS_ICON`, `STATUS_ICON_CLASS`, já existentes em `dashboard.tsx` desde o sub-projeto 3) que também precisaria ser usado em `appointments.tsx` — momento correto pra parar de duplicar em vez de triplicar.

Criar `apps/web/src/lib/appointment-status.ts` exportando:
- `STATUS_LABEL`
- `STATUS_VARIANT`
- `STATUS_ICON`
- `STATUS_ICON_CLASS`

`dashboard.tsx` e `appointments.tsx` passam a importar esses quatro dicionários daqui, removendo suas cópias locais. Nenhuma mudança de valor — é puramente mover código que já existe (2x) pra um lugar só.

## Cards de resumo

Mesmo componente visual do dashboard (círculo com ícone tintado + label pequeno + número grande), num grid acima do conteúdo principal de cada tela:

### Agendamentos (`appointments.tsx`)
4 cards — Pendente/Confirmado/Concluído/Cancelado — usando `STATUS_ICON`/`STATUS_ICON_CLASS` do módulo compartilhado. Contagem reflete a lista **já filtrada** (`sorted`, resultado atual de data/barbeiro/status selecionados), não o total do dia sem filtro — os cards devem bater com o que a tabela abaixo mostra.

### Barbeiros (`barbers.tsx`)
2 cards — "Ativos" (ícone `UserCheck`, `bg-emerald-500/10 text-emerald-400`) e "Inativos" (ícone `UserX`, `bg-destructive/10 text-destructive`) — contagem derivada de `barbers.filter(b => b.isActive)` / inativos, sem nova chamada de API.

### Serviços (`services.tsx`)
2 cards — "Ativos" (ícone `CheckCircle2`, `bg-emerald-500/10 text-emerald-400`) e "Inativos" (ícone `XCircle`, `bg-destructive/10 text-destructive`) — mesma lógica derivada de `services`, sem nova chamada de API.

## Fora de escopo

- Novas queries, paginação, filtros adicionais.
- Mudança no fluxo de criar/editar/desativar barbeiro, serviço, ou nas transições de status de agendamento.
- Animação de entrada nos novos cards — pode ficar estático nesta fase (as telas de CRUD nunca tiveram animação de entrada; adicionar fica pra uma iteração futura se pedido).

## Testes

- `tsc -b --noEmit` limpo.
- `vitest run` continua passando — nenhum teste hoje cobre essas páginas, não é necessário adicionar (mesma justificativa dos specs anteriores).
- Validação visual manual: os 3 cards de resumo aparecem corretos nas 3 telas, contagens batem com os dados reais (incluindo o caso de agendamentos: mudar o filtro e ver os cards atualizarem junto com a tabela), `dashboard.tsx`/`appointments.tsx` continuam funcionando idênticos após a extração pro módulo compartilhado.
