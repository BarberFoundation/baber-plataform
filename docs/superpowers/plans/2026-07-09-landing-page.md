# Landing Page (Motion-First Hero) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public, animated marketing landing page (bold/colorido barbearia style) at `/`, moving the existing authenticated dashboard to `/app`, per `docs/superpowers/specs/2026-07-09-landing-page-design.md`.

**Architecture:** Three new presentational components (`Hero`, `Features`, `Cta`) composed by a new `LandingPage`, all under `apps/web/src/components/landing/` and `apps/web/src/pages/landing.tsx`. Animation via `animejs` v4 (`animate`, `stagger`, `split`, `onScroll`). Router changes move the protected dashboard tree under `/app` and add the landing route at `/` outside `ProtectedRoute`.

**Tech Stack:** React 18, TypeScript, react-router-dom v6, Tailwind CSS, animejs v4.5.0, lucide-react, vitest + @testing-library/react.

---

## File Structure

- Create: `apps/web/src/components/landing/hero.tsx` — headline split-text entrance, gradient blob loop, floating icons w/ mouse parallax, pulsing CTA button.
- Create: `apps/web/src/components/landing/features.tsx` — 3-4 feature cards, scroll-reveal entrance (once).
- Create: `apps/web/src/components/landing/cta.tsx` — final call-to-action section linking to `/login`.
- Create: `apps/web/src/pages/landing.tsx` — composes `Hero`, `Features`, `Cta`.
- Create: `apps/web/src/pages/__tests__/landing.test.tsx` — smoke tests for the composed page (animejs mocked).
- Modify: `apps/web/src/router.tsx` — nest existing protected routes under `/app`, add `/` → `LandingPage`.
- Modify: `apps/web/src/pages/login.tsx:39` — redirect to `/app` instead of `/` after login.
- Modify: `apps/web/src/components/layout/app-shell.tsx:7-12` — update `NAV` paths from `/`, `/appointments`, `/barbers`, `/services` to `/app`, `/app/appointments`, `/app/barbers`, `/app/services`.

Tests for animation timing/visuals are not meaningful in jsdom/happy-dom — `animejs` is mocked in tests so components render without throwing and expose the right content/links. Real animation behavior is verified manually in the browser (Task 7).

---

### Task 1: Router — move dashboard to `/app`, add landing placeholder

**Files:**
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/src/pages/login.tsx:39`
- Modify: `apps/web/src/components/layout/app-shell.tsx:7-12`

- [ ] **Step 1: Update `router.tsx` to nest the protected tree under `/app` and add a temporary placeholder for `/`**

Replace the full file contents with:

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ProtectedRoute from '@/components/layout/protected-route';
import AppShell from '@/components/layout/app-shell';
import LoginPage from '@/pages/login';
import DashboardPage from '@/pages/dashboard';
import AppointmentsPage from '@/pages/appointments';
import BarbersPage from '@/pages/barbers';
import ServicesPage from '@/pages/services';
import LandingPage from '@/pages/landing';

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'appointments', element: <AppointmentsPage /> },
      { path: 'barbers', element: <BarbersPage /> },
      { path: 'services', element: <ServicesPage /> },
    ],
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
```

This imports `@/pages/landing`, which does not exist yet — expected, it's created in Task 5. The app won't build until then; that's fine since we're not running the dev server until Task 7.

- [ ] **Step 2: Update login redirect**

In `apps/web/src/pages/login.tsx`, change line 39:

```tsx
      void navigate('/');
```

to:

```tsx
      void navigate('/app');
```

- [ ] **Step 3: Update `AppShell` nav paths**

In `apps/web/src/components/layout/app-shell.tsx`, change the `NAV` array (lines 7-12):

```tsx
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/appointments', label: 'Agendamentos', icon: CalendarDays, end: false },
  { to: '/barbers', label: 'Barbeiros', icon: Users, end: false },
  { to: '/services', label: 'Serviços', icon: Scissors, end: false },
];
```

to:

```tsx
const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/appointments', label: 'Agendamentos', icon: CalendarDays, end: false },
  { to: '/app/barbers', label: 'Barbeiros', icon: Users, end: false },
  { to: '/app/services', label: 'Serviços', icon: Scissors, end: false },
];
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/router.tsx apps/web/src/pages/login.tsx apps/web/src/components/layout/app-shell.tsx
git commit -m "feat(web): move dashboard under /app to make room for landing page"
```

Note: this commit intentionally leaves the build broken (missing `@/pages/landing`) until Task 5. If your workflow requires a green build per commit, squash Tasks 1-5 at the end instead of committing individually — call this out to the user before deviating from per-task commits.

---

### Task 2: Hero component — static structure + headline entrance animation

**Files:**
- Create: `apps/web/src/components/landing/hero.tsx`
- Test: `apps/web/src/components/landing/__tests__/hero.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/landing/__tests__/hero.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Hero from '../hero';

vi.mock('animejs', () => ({
  animate: vi.fn(),
  stagger: vi.fn(() => 0),
  split: vi.fn(() => ({ words: [] })),
}));

describe('Hero', () => {
  it('renders the headline and a CTA link to /login', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agendar demonstração|come(c|ç)ar agora/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/landing/__tests__/hero.test.tsx`
Expected: FAIL — `Cannot find module '../hero'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/landing/hero.tsx
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger, split } from 'animejs';

export default function Hero() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!headlineRef.current) return;
    const { words } = split(headlineRef.current, { words: true });
    animate(words, {
      opacity: [0, 1],
      translateY: [20, 0],
      delay: stagger(80),
      duration: 600,
      easing: 'easeOutQuad',
    });
  }, []);

  useEffect(() => {
    if (!ctaRef.current) return;
    animate(ctaRef.current, {
      scale: [1, 1.03],
      duration: 1200,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
    });
  }, []);

  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 py-32 text-center">
      <h1 ref={headlineRef} className="mx-auto max-w-3xl text-5xl font-bold text-white sm:text-6xl">
        Gestão de barbearia que impressiona do primeiro corte ao último agendamento
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-300">
        Agendamentos, barbeiros e serviços em um painel só. Simples pra você, rápido pro seu cliente.
      </p>
      <Link
        ref={ctaRef}
        to="/login"
        className="mt-10 inline-block rounded-full bg-orange-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-orange-600/30"
      >
        Começar agora
      </Link>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/landing/__tests__/hero.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/landing/hero.tsx apps/web/src/components/landing/__tests__/hero.test.tsx
git commit -m "feat(web): add landing hero with split-text entrance animation"
```

---

### Task 3: Hero background blob + floating icons with mouse parallax

**Files:**
- Modify: `apps/web/src/components/landing/hero.tsx`
- Test: `apps/web/src/components/landing/__tests__/hero.test.tsx` (extend)

- [ ] **Step 1: Extend the test to cover the decorative icons render**

Add to `apps/web/src/components/landing/__tests__/hero.test.tsx`, inside the `describe('Hero', ...)` block:

```tsx
  it('renders three floating decorative icons', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId('hero-floating-icon')).toHaveLength(3);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/landing/__tests__/hero.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="hero-floating-icon"]`

- [ ] **Step 3: Add the gradient blob and floating icons to `hero.tsx`**

Update imports at the top of `apps/web/src/components/landing/hero.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger, split } from 'animejs';
import { Scissors, Sparkles, Wand2 } from 'lucide-react';
```

Add a blob ref and an icons container ref, plus their animations, alongside the existing refs/effects:

```tsx
  const blobRef = useRef<HTMLDivElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);
```

```tsx
  useEffect(() => {
    if (!blobRef.current) return;
    animate(blobRef.current, {
      translateX: ['-5%', '5%'],
      translateY: ['-3%', '4%'],
      scale: [1, 1.15],
      duration: 6000,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
    });
  }, []);

  useEffect(() => {
    if (!iconsRef.current) return;
    const icons = Array.from(iconsRef.current.children);
    icons.forEach((icon, i) => {
      animate(icon, {
        translateY: [-10, 10],
        duration: 2200 + i * 400,
        loop: true,
        direction: 'alternate',
        easing: 'easeInOutSine',
      });
    });

    function handleMouseMove(e: MouseEvent) {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 20;
      const y = (e.clientY / innerHeight - 0.5) * 20;
      icons.forEach((icon, i) => {
        animate(icon, {
          translateX: x * (i + 1) * 0.3,
          duration: 400,
          easing: 'easeOutQuad',
        });
      });
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
```

Update the returned JSX to add the blob and icons inside the `<section>`, before the `<h1>`:

```tsx
      <div
        ref={blobRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-gradient-to-br from-orange-600 via-red-700 to-neutral-950 opacity-40 blur-3xl"
      />
      <div ref={iconsRef} className="pointer-events-none absolute inset-0">
        <Scissors data-testid="hero-floating-icon" className="absolute left-[15%] top-[25%] h-10 w-10 text-orange-500/70" />
        <Wand2 data-testid="hero-floating-icon" className="absolute right-[18%] top-[35%] h-8 w-8 text-red-500/70" />
        <Sparkles data-testid="hero-floating-icon" className="absolute left-[25%] bottom-[20%] h-9 w-9 text-orange-400/70" />
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/landing/__tests__/hero.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/landing/hero.tsx apps/web/src/components/landing/__tests__/hero.test.tsx
git commit -m "feat(web): add animated gradient blob and floating icons to hero"
```

---

### Task 4: Features component — scroll-reveal cards

**Files:**
- Create: `apps/web/src/components/landing/features.tsx`
- Test: `apps/web/src/components/landing/__tests__/features.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/landing/__tests__/features.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Features from '../features';

vi.mock('animejs', () => ({
  onScroll: vi.fn(() => ({})),
  animate: vi.fn(),
  stagger: vi.fn(() => 0),
}));

describe('Features', () => {
  it('renders four feature cards with titles', () => {
    render(<Features />);
    expect(screen.getByText(/agendamento/i)).toBeInTheDocument();
    expect(screen.getByText(/barbeiros/i)).toBeInTheDocument();
    expect(screen.getByText(/servi(c|ç)os/i)).toBeInTheDocument();
    expect(screen.getByText(/relat(o|ó)rios|dashboard/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/components/landing/__tests__/features.test.tsx`
Expected: FAIL — `Cannot find module '../features'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/landing/features.tsx
import { useEffect, useRef } from 'react';
import { CalendarDays, Users, Scissors, LayoutDashboard } from 'lucide-react';
import { animate, stagger, onScroll } from 'animejs';

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Agendamento inteligente',
    description: 'Clientes marcam horário sozinhos, sem choque de agenda entre barbeiros.',
  },
  {
    icon: Users,
    title: 'Gestão de barbeiros',
    description: 'Escalas, especialidades e disponibilidade de cada barbeiro em um lugar só.',
  },
  {
    icon: Scissors,
    title: 'Catálogo de serviços',
    description: 'Preços, duração e combos configuráveis sem depender de planilha.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard e relatórios',
    description: 'Veja o movimento do dia em tempo real, direto no painel.',
  },
];

export default function Features() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const cards = Array.from(gridRef.current.children);
    animate(cards, {
      opacity: [0, 1],
      translateY: [24, 0],
      delay: stagger(100),
      duration: 500,
      easing: 'easeOutQuad',
      autoplay: onScroll({ target: gridRef.current, enter: 'bottom-=10% top', once: true }),
    });
  }, []);

  return (
    <section className="bg-neutral-950 px-6 py-24">
      <div ref={gridRef} className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <Icon className="h-8 w-8 text-orange-500" />
            <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-neutral-400">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/components/landing/__tests__/features.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/landing/features.tsx apps/web/src/components/landing/__tests__/features.test.tsx
git commit -m "feat(web): add landing features grid with scroll-reveal"
```

---

### Task 5: CTA section + Landing page composition

**Files:**
- Create: `apps/web/src/components/landing/cta.tsx`
- Create: `apps/web/src/pages/landing.tsx`
- Create: `apps/web/src/pages/__tests__/landing.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/pages/__tests__/landing.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../landing';

vi.mock('animejs', () => ({
  animate: vi.fn(),
  stagger: vi.fn(() => 0),
  split: vi.fn(() => ({ words: [] })),
  onScroll: vi.fn(() => ({})),
}));

describe('LandingPage', () => {
  it('renders hero, features, and a final CTA link to /login', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/agendamento inteligente/i)).toBeInTheDocument();
    const ctaLinks = screen.getAllByRole('link', { name: /come(c|ç)ar agora|criar conta|entrar/i });
    expect(ctaLinks.length).toBeGreaterThan(0);
    expect(ctaLinks[0]).toHaveAttribute('href', '/login');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/pages/__tests__/landing.test.tsx`
Expected: FAIL — `Cannot find module '../landing'`

- [ ] **Step 3: Write `cta.tsx`**

```tsx
// apps/web/src/components/landing/cta.tsx
import { Link } from 'react-router-dom';

export default function Cta() {
  return (
    <section className="bg-gradient-to-br from-orange-700 via-red-800 to-neutral-950 px-6 py-24 text-center">
      <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">
        Pronto pra deixar sua barbearia no automático?
      </h2>
      <Link
        to="/login"
        className="mt-8 inline-block rounded-full bg-white px-8 py-4 text-lg font-semibold text-neutral-950 shadow-lg"
      >
        Entrar
      </Link>
    </section>
  );
}
```

- [ ] **Step 4: Write `landing.tsx`**

```tsx
// apps/web/src/pages/landing.tsx
import Hero from '@/components/landing/hero';
import Features from '@/components/landing/features';
import Cta from '@/components/landing/cta';

export default function LandingPage() {
  return (
    <div>
      <Hero />
      <Features />
      <Cta />
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/pages/__tests__/landing.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/landing/cta.tsx apps/web/src/pages/landing.tsx apps/web/src/pages/__tests__/landing.test.tsx
git commit -m "feat(web): compose landing page from hero, features, and cta"
```

---

### Task 6: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/web && npx vitest run`
Expected: all test files pass, including the three new landing test files.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Start the dev server and visually verify in the browser**

Run: `cd apps/web && npx vite`

Open `http://localhost:5173/` and confirm:
- Headline words cascade in on load.
- Background blob and 3 floating icons animate continuously in a loop; icons shift slightly when the mouse moves.
- CTA button in the hero pulses continuously.
- Scrolling down animates the 4 feature cards in with a stagger, once, without visible re-trigger scrolling up and back down.
- Bottom CTA section renders and its "Entrar" link goes to `/login`.
- Navigating to `/login` and logging in redirects to `/app` (dashboard), and the sidebar links (`Dashboard`, `Agendamentos`, `Barbeiros`, `Serviços`) all point to `/app/...` and highlight correctly.

Stop the dev server after verifying (`Ctrl+C` in that terminal, or kill the process by the port it printed).

- [ ] **Step 4: Commit any fixups found during manual verification**

If Step 3 revealed issues, fix them, re-run Steps 1-2, then:

```bash
git add -A
git commit -m "fix(web): address issues found in landing page manual verification"
```

If no issues were found, skip this step — nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** routing move (Task 1), hero headline/blob/icons/CTA pulse (Tasks 2-3), features scroll-reveal (Task 4), final CTA + composition (Task 5), manual verification of all animated behaviors (Task 6). Out-of-scope items from the spec (social proof, product screenshot, dashboard polish) are intentionally not tasked.
- **Type consistency:** `Hero`, `Features`, `Cta` are all default exports with no props, matching how `landing.tsx` composes them. `onScroll`/`animate`/`stagger`/`split` names match across mocked tests and implementation.
- **Known risk:** Task 1's commit leaves the build broken until Task 5 (missing `@/pages/landing`). Flagged inline in Task 1 — if the executor's workflow requires a green build at every commit, squash Tasks 1-5 into one commit instead.
