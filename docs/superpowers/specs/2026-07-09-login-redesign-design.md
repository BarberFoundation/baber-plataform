# Login Redesign (Split-Screen) — Design

## Contexto

Segundo de quatro sub-projetos de redesign do app logado (sub-projeto 1, design system dark/laranja, já mergeado). `apps/web/src/pages/login.tsx` hoje é um `Card` genérico centralizado — já herda o tema escuro/laranja automaticamente, mas o layout continua sendo o template padrão do shadcn, sem identidade própria.

Escopo desta fase: **somente o layout visual e animação de entrada do login**. Lógica de autenticação (Firebase, exchange de token, `useAuthStore`, toast de erro, redirect pra `/app`) fica exatamente como está — zero mudança de comportamento.

## Layout

`login.tsx` vira um grid de 2 colunas em telas `lg` ou maiores:

- **Coluna esquerda — painel de branding** (`hidden lg:flex`, escondido abaixo de `lg`): fundo escuro (`bg-neutral-950`, ou herda `bg-background`), com:
  - Blob de gradiente animado em loop, mesma técnica de `apps/web/src/components/landing/hero.tsx` (ref + `animate()` com `translateX`/`translateY`/`scale` alternado, `loop: true`, cleanup com `.pause()`) — duplicado inline no arquivo do login, não extraído para componente compartilhado (só a segunda ocorrência do padrão; extrair vira decisão pro terceiro uso, se acontecer).
  - Logo/título "✂ Baber Admin".
  - Headline curta (1 frase, reaproveitando tom da landing, ex.: "Sua barbearia, sob controle.").
- **Coluna direita — formulário**: os mesmos campos e lógica de hoje (`E-mail`, `Senha`, botão "Entrar"/"Entrando..."), sem o `Card` ao redor (o painel já dá a moldura visual), centralizado vertical e horizontalmente dentro da coluna.

Abaixo de `lg` (mobile/tablet estreito): só a coluna do formulário aparece, full-width, mantendo o comportamento atual de tela única — sem quebrar o fluxo em telas pequenas.

## Animação

- Blob do painel de branding: loop contínuo (igual hero), sem trigger de scroll (a página não rola).
- Campos do formulário: entrada com fade+slide sutil ao montar (stagger pequeno entre label+input dos dois campos e o botão), mesma convenção de cleanup (`animate()` + `.pause()` no unmount) já usada em `hero.tsx`/`features.tsx`/`cta.tsx`.

## Fora de escopo

- Qualquer mudança em `handleSubmit`, Firebase, `resolveTenantId`, `apiFetch`, `useAuthStore`, mensagens de erro/toast, redirect.
- Recuperação de senha, cadastro, "lembrar de mim" — funcionalidades que não existem hoje e não estão sendo pedidas.
- Extração de um componente `AnimatedBlob` compartilhado — fica pra quando (e se) um terceiro lugar precisar do mesmo efeito.

## Testes

- `tsc -b --noEmit` limpo.
- Suite de testes existente (`vitest run`) continua passando; se houver teste que hoje dependa da estrutura DOM do login (checar `apps/web/src/pages/__tests__` e stores relacionados), confirmar que não quebra — ajustar apenas se necessário, sem adicionar novo teste de layout (mesma lógica dos specs anteriores: animação/visual não é testável de forma significativa em jsdom).
- Validação visual manual: desktop (`lg`+, ver os dois painéis) e mobile (< `lg`, ver só o form), submissão de login continua funcionando (fluxo de auth intacto).
