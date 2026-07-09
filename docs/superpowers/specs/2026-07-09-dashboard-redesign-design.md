# Dashboard Redesign — Design

## Contexto

Terceiro de quatro sub-projetos de redesign do app logado (1: design system dark/laranja, 2: login split-screen — ambos mergeados). `apps/web/src/pages/dashboard.tsx` já tem tema escuro (herdado) e animação de entrada nos stat cards e nas linhas da tabela (adicionada antes deste ciclo de redesign). Falta estrutura/hierarquia visual: hoje é só título + data, 4 cards genéricos (label + número), e uma tabela.

Escopo desta fase: **header com saudação, ícones/cores nos stat cards, título da tabela com contagem**. Sem mudança de fonte de dados, sem gráficos novos, sem alterar a lógica de `useQuery`/`apiFetch` existente.

## Header

Acima da data atual (`{dateLabel}` já existe), adicionar uma linha de saudação dinâmica baseada na hora do dia:
- 5h–11h59: "Bom dia"
- 12h–17h59: "Boa tarde"
- 18h–4h59: "Boa noite"

Calculada uma vez no render via `new Date().getHours()` (sem necessidade de atualizar em tempo real — é uma tela que recarrega/remonta a cada visita).

## Stat cards

Cada um dos 4 cards (Pendente/Confirmado/Concluído/Cancelado) ganha um ícone `lucide-react` num círculo com fundo tintado, ao lado do número:

| Status | Ícone | Cor |
|---|---|---|
| Pendente | `Clock` | âmbar (`bg-amber-500/10 text-amber-400`) |
| Confirmado | `CalendarCheck` | esmeralda (`bg-emerald-500/10 text-emerald-400`) |
| Concluído | `CheckCheck` | neutro (`bg-secondary text-secondary-foreground`) |
| Cancelado | `XCircle` | vermelho (`bg-destructive/10 text-destructive`) |

Mesma paleta já usada nos badges (`Badge` warning/success/secondary/destructive), pra manter consistência entre o círculo do card e o badge da tabela do mesmo status.

Layout do card: ícone circular à esquerda, label pequeno + número grande à direita (ou label em cima do número, ícone alinhado à direita — escolha de implementação, desde que ícone e número fiquem visualmente parelhos, não empilhados de forma confusa).

## Tabela "Agendamentos de hoje"

Título do card passa a incluir a contagem, ex.: `Agendamentos de hoje (3)` — usa `appointments.length`, sem novo estado. Estrutura da tabela (colunas, ordenação, badges de status) permanece idêntica.

## Animação

Mantém exatamente a animação já existente (stagger nos 4 cards ao montar, stagger nas linhas da tabela quando os dados chegam) — não duplicar, não reimplementar, não mudar timing. O novo conteúdo dos cards (ícone) é filho do mesmo elemento já animado, então herda a animação de entrada automaticamente sem código extra.

## Fora de escopo

- Gráficos, filtros de período, comparação com dias anteriores.
- Mudança na query (`/appointments?date=${today}`), no formato de dados, ou em `isLoading`.
- Refresh automático / polling.

## Testes

- `tsc -b --noEmit` limpo.
- `vitest run` continua passando (sem teste específico de dashboard hoje — não é necessário adicionar, mesma justificativa dos specs anteriores: layout/visual não é significativamente testável em jsdom).
- Validação visual manual: cards com ícone/cor corretos por status, saudação correta (testável ajustando a hora do sistema ou lendo o código), contagem no título da tabela batendo com os dados reais, animação de entrada ainda funcionando.
