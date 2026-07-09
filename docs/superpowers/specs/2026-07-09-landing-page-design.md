# Landing Page (Motion-First Hero) — Design

## Contexto

App atual (`apps/web`) não tem página pública de marketing — a rota `/` já cai direto no dashboard logado (atrás de `ProtectedRoute`). Objetivo: landing page nova para abrir demos/pitches, com identidade visual "bold/colorido barbearia" e animações via `animejs` (já instalado, v4.5.0) para causar forte primeira impressão nos primeiros segundos.

Escopo desta fase: **somente a landing page**. Polish de transições no dashboard/app logado fica para uma segunda fase (fora deste spec).

## Roteamento

- Dashboard atual (hoje em `/`) move para `/app`, mantendo todas as sub-rotas (`/app/appointments`, `/app/barbers`, `/app/services`) e `ProtectedRoute`.
- `/login` continua igual.
- Nova rota pública `/` renderiza a landing page, sem `ProtectedRoute`.
- CTA da landing aponta para `/login`.

Arquivo afetado: `apps/web/src/router.tsx`.

## Estrutura de componentes

Novo diretório `apps/web/src/components/landing/`:

- `hero.tsx` — headline animada, blob de fundo, ícones flutuantes, CTA.
- `features.tsx` — grid de cards com scroll-reveal.
- `cta.tsx` — seção final de call-to-action.

Nova página `apps/web/src/pages/landing.tsx` compõe os três.

## Hero

- **Headline:** quebrada em palavras via `split()`/`splitText` do anime.js; cada palavra entra com stagger (opacity 0→1, translateY 20→0) ao montar o componente.
- **Fundo:** blob de gradiente (elemento `div` com `border-radius` orgânico e `background` gradiente laranja/vermelho/preto), animado em loop infinito alternando `translate`/`scale`/`borderRadius` via `animate()` com `loop: true, direction: 'alternate'`.
- **Ícones flutuantes:** 3 ícones lucide-react (tesoura, navalha, pente) posicionados absolutamente no hero, cada um com loop de flutuação vertical (`translateY` alternado, durações levemente diferentes entre eles pra não sincronizar) + leve parallax reagindo a `mousemove` (deslocamento proporcional à posição do cursor, aplicado via `animate()` com duração curta a cada evento, throttled).
- **CTA do hero:** botão com pulse contínuo sutil (`scale` alternando 1 → 1.03, loop infinito, easing suave).

## Features

- Grid 3-4 cards (agendamento, gestão de barbeiros, dashboard/relatórios — reaproveita ícones lucide-react já usados no app).
- Cada card observado via `onScroll` (ScrollObserver do anime v4): ao entrar na viewport, anima uma vez (fade + translateY + stagger entre cards), sem repetir a animação se o usuário rolar pra cima e descer de novo (usar flag/estado ou opção do próprio ScrollObserver para "once").

## CTA final

- Seção simples: headline curta + botão grande levando para `/login`. Sem animação própria além do scroll-reveal padrão de entrada (mesma mecânica dos features).

## Estilo visual

- Paleta: tons quentes (laranja, vermelho, preto/carvão), consistente com nicho barbearia.
- Tipografia grande no hero, hierarquia clara.
- Tailwind (já configurado no projeto) para layout/spacing; anime.js só para movimento.

## Fora de escopo

- Prova social (depoimentos, contadores) — não pedido nesta fase.
- Screenshot/mockup do produto embutido na landing — não pedido nesta fase.
- Qualquer alteração de animação/transição dentro do app logado (dashboard, appointments, etc.) — fica para fase 2.
- Responsividade mobile detalhada não é o foco principal (contexto é demo/pitch, provavelmente desktop), mas layout não deve quebrar em mobile — sem tratamento especial de animação para mobile além de funcionar.

## Testes

- Sem testes automatizados de animação (difícil de testar via vitest/jsdom de forma significativa). Validação via:
  - `tsc -b --noEmit` limpo.
  - Verificação visual manual no browser (dev server) cobrindo: entrada do hero, loop de ícones/blob, scroll-reveal dos features, CTA final.
