# App Design System (Dark Theme, Landing-Consistent) — Design

## Contexto

A landing page (`/`) tem identidade visual "bold/colorido barbearia": fundo escuro (`neutral-950`/`neutral-900`), acentos laranja/vermelho (`orange-600`, `red-700`/`red-800`). O app autenticado (`/app/...`) ainda usa o tema neutro claro padrão do shadcn (fundo branco, `--primary` quase preto), completamente dissonante do que o usuário acabou de ver na landing.

Este é o primeiro de quatro sub-projetos de redesign do app logado (spec/plano próprios cada um):
1. **Este spec** — Design system (tema + sidebar).
2. Login.
3. Dashboard.
4. Telas de CRUD (Agendamentos, Barbeiros, Serviços — mesmo padrão de tabela+dialog).

Escopo desta fase: **somente a base visual compartilhada** (variáveis CSS do tema, badges de status, sidebar). Como o resto do app já consome os tokens do shadcn (`bg-background`, `text-foreground`, `bg-primary`, etc.) via Tailwind, atualizar essas variáveis já propaga o novo visual pra todas as telas automaticamente, sem tocar em lógica ou layout de nenhuma página individual.

## Paleta

Convertendo as classes Tailwind já usadas na landing para variáveis HSL do shadcn (formato `H S% L%`, sem a função `hsl()`):

| Variável | Valor novo | Equivalente Tailwind | Uso |
|---|---|---|---|
| `--background` | `0 0% 4%` | `neutral-950` | fundo geral do app |
| `--foreground` | `0 0% 98%` | quase branco | texto principal |
| `--card` | `0 0% 9%` | `neutral-900` | fundo de cards/painéis |
| `--card-foreground` | `0 0% 98%` | — | texto em cards |
| `--popover` / `--popover-foreground` | igual a `--card`/`--card-foreground` | — | dropdowns, dialogs |
| `--primary` | `20.5 90% 48%` | `orange-600` | botões primários, links ativos, foco |
| `--primary-foreground` | `0 0% 100%` | branco | texto sobre botão laranja |
| `--secondary` / `--muted` / `--accent` | `0 0% 15%` | `neutral-800` | fundos secundários, hover |
| `--secondary-foreground` / `--accent-foreground` | `0 0% 98%` | — | texto sobre esses fundos |
| `--muted-foreground` | `0 0% 64%` | `neutral-400` | texto secundário/descrições |
| `--destructive` | `0 74% 42%` | `red-700` | ações destrutivas (cancelar, desativar) |
| `--destructive-foreground` | `0 0% 98%` | — | texto sobre vermelho |
| `--border` / `--input` | `0 0% 15%` | `neutral-800` | bordas, contornos de input |
| `--ring` | `20.5 90% 48%` | `orange-600` | anel de foco |
| `--radius` | mantém `0.5rem` | — | sem mudança |

Essas variáveis substituem os valores atuais em `apps/web/src/index.css` (dentro do bloco `:root`) — o app não tem hoje um modo claro/escuro alternável, então não há necessidade de duplicar em `.dark`; o `:root` passa a ser sempre este tema escuro.

## Badges de status

`apps/web/src/components/ui/badge.tsx` tem duas variantes com cores fixas claras que ficam ilegíveis em fundo escuro:
- `warning`: `bg-yellow-100 text-yellow-800` → `bg-amber-500/10 text-amber-400`
- `success`: `bg-green-100 text-green-800` → `bg-emerald-500/10 text-emerald-400`

As variantes `default`, `secondary`, `destructive`, `outline` já usam tokens do tema (`bg-primary`, `bg-secondary`, etc.), então herdam o novo tema automaticamente sem edição.

## Sidebar (`AppShell`)

`apps/web/src/components/layout/app-shell.tsx` hoje usa `bg-card` com borda (`border-r`) — ambos já herdam o novo tema escuro automaticamente. Ajustes manuais necessários:
- Item de nav ativo (`isActive ? 'bg-primary text-primary-foreground' : ...`) já usa os tokens corretos — nenhuma mudança de classe necessária, só validação visual (laranja em vez de preto).
- Logo/título (`✂ Baber Admin`) — sem mudança de estrutura, herda `text-foreground`.
- Validar visualmente que o contraste do texto inativo (`text-muted-foreground`) contra o novo fundo escuro do sidebar está legível; se não estiver, ajustar apenas essa classe.

## Fora de escopo

- Qualquer mudança de layout, estrutura ou lógica das páginas individuais (login, dashboard, appointments, barbers, services) — cobertas em sub-projetos seguintes.
- Toggle de tema claro/escuro — o app passa a ser escuro fixo, sem alternância.
- Animações (`animejs`) — não fazem parte deste sub-projeto; entram, se fizer sentido, nos sub-projetos de página individual.

## Testes

- `tsc -b --noEmit` limpo.
- Suite de testes existente (`vitest run`) continua passando sem alteração (nenhum destes arquivos tem lógica testável; testes existentes não fazem asserção de cor).
- Validação visual manual no browser: login, dashboard, appointments, barbers, services — confirmar legibilidade de texto, badges, sidebar, botões em todas as telas com o novo tema.
