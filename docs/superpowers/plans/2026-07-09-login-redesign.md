# Login Redesign (Split-Screen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic centered-card login layout with a split-screen design (animated branding panel + form), per `docs/superpowers/specs/2026-07-09-login-redesign-design.md`, with zero change to authentication logic.

**Architecture:** Single-file change to `apps/web/src/pages/login.tsx`: a 2-column grid (branding panel + form column), the branding panel reusing the gradient-blob-loop animation pattern already established in `apps/web/src/components/landing/hero.tsx`, and a small fade+stagger entrance on the form fields. `handleSubmit` and all auth-related imports/logic are copied over unchanged.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, animejs v4.5.0 (already a dependency), lucide-react, react-router-dom, Firebase Auth (untouched).

---

## File Structure

- Modify: `apps/web/src/pages/login.tsx` — full rewrite of the JSX/layout and addition of two animation `useEffect`s; `handleSubmit`, state, and all data-layer imports stay exactly as they are today.
- No new files, no test files. Per the design spec, there is no pre-existing test for `login.tsx`, and adding one is explicitly out of scope — animation/visual layout isn't meaningfully testable in jsdom, and this page has no business logic changes to cover. Verification is `tsc`, the existing full test suite (regression-only), and a manual browser pass (Task 3).

---

### Task 1: Restructure login into split-screen layout (no animation yet)

**Files:**
- Modify: `apps/web/src/pages/login.tsx`

- [ ] **Step 1: Replace the file's imports and JSX return**, keeping `handleSubmit`, all state (`email`, `password`, `loading`), and the `useNavigate`/`useAuthStore` wiring completely unchanged. Full new file content:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'sonner';
import { Scissors } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase';
import { apiFetch } from '@/lib/api';
import { resolveTenantId } from '@/lib/tenant';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { User } from '@/lib/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const idToken = await credential.user.getIdToken();
      const tenantId = await resolveTenantId();

      const result = await apiFetch<{ accessToken: string; expiresIn: number; user: User }>(
        '/auth/admin/exchange',
        {
          method: 'POST',
          body: JSON.stringify({ idToken, tenantId }),
        },
      );

      setAuth(result.accessToken, result.expiresIn, result.user);
      void navigate('/app');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12">
        <div className="relative flex items-center gap-2 text-2xl font-bold text-white">
          <Scissors className="h-7 w-7 text-orange-500" />
          Baber Admin
        </div>
        <p className="relative mt-4 max-w-sm text-center text-neutral-300">
          Sua barbearia, sob controle.
        </p>
      </div>

      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse o painel administrativo.</p>
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

Note this step deliberately removes the `Card`/`CardHeader`/`CardTitle`/`CardContent` imports and usage — the split-screen panel replaces the card's visual framing. This is expected per the spec, not an oversight.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/login.tsx
git commit -m "feat(web): restructure login into split-screen layout"
```

---

### Task 2: Add branding panel blob loop and form entrance animation

**Files:**
- Modify: `apps/web/src/pages/login.tsx`

- [ ] **Step 1: Add imports and refs**

Update the top imports (add `useEffect`, `useRef` from React, and `animate`, `stagger` from `animejs`):
```tsx
import { useEffect, useRef, useState } from 'react';
```
```tsx
import { animate, stagger } from 'animejs';
```

Inside `LoginPage`, alongside the existing `useState` calls, add:
```tsx
  const blobRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
```

- [ ] **Step 2: Add the blob loop effect**

Add this effect (same loop-animation-with-pause-cleanup convention as `apps/web/src/components/landing/hero.tsx`'s blob effect):
```tsx
  useEffect(() => {
    if (!blobRef.current) return;
    const animation = animate(blobRef.current, {
      translateX: ['-5%', '5%'],
      translateY: ['-3%', '4%'],
      scale: [1, 1.15],
      duration: 6000,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
    });
    return () => {
      animation.pause();
    };
  }, []);
```

- [ ] **Step 3: Add the form entrance effect**

Add this effect (same fade+translateY+stagger convention as `apps/web/src/components/landing/features.tsx`'s card entrance, but without `onScroll` since this page never scrolls — plain `autoplay` on mount):
```tsx
  useEffect(() => {
    if (!formRef.current) return;
    const animation = animate(formRef.current.children, {
      opacity: [0, 1],
      translateY: [12, 0],
      delay: stagger(80),
      duration: 500,
      easing: 'easeOutQuad',
    });
    return () => {
      animation.pause();
    };
  }, []);
```

- [ ] **Step 4: Wire the refs into the JSX**

Add `ref={blobRef}` to a new `<div>` inside the branding panel (before the logo/tagline, so it sits behind them), and add `ref={formRef}` to the `<form>` element. Updated branding panel and form markup:
```tsx
      <div className="relative hidden overflow-hidden bg-neutral-950 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12">
        <div
          ref={blobRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-gradient-to-br from-orange-600 via-red-700 to-neutral-950 opacity-40 blur-3xl"
        />
        <div className="relative flex items-center gap-2 text-2xl font-bold text-white">
          <Scissors className="h-7 w-7 text-orange-500" />
          Baber Admin
        </div>
        <p className="relative mt-4 max-w-sm text-center text-neutral-300">
          Sua barbearia, sob controle.
        </p>
      </div>
```
```tsx
          <form ref={formRef} onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
```
(Everything else in the form — the two field `div`s and the submit `Button` — stays exactly as Task 1 left it; they become the 3 children `formRef.current.children` staggers over.)

- [ ] **Step 5: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0. If `animate()`'s return type or `.pause()` causes a type error, check how `apps/web/src/components/landing/hero.tsx` handles the same pattern (it captures the `animate()` return value and calls `.pause()` in a block-body cleanup) and match that shape exactly.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/login.tsx
git commit -m "feat(web): animate login branding blob and form entrance"
```

---

### Task 3: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/web && npx vitest run`
Expected: all existing test files still pass (this page has no pre-existing tests, so this is purely a regression check on the rest of the app).

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Start the dev server and visually verify**

Run: `cd apps/web && npx vite`

Open `http://localhost:5173/login` at a desktop width (>= 1024px, the `lg` breakpoint) and confirm:
- Left panel: dark background, animated gradient blob looping continuously, "✂ Baber Admin" logo and tagline visible and legible.
- Right panel: "Entrar" heading, subtext, email/senha fields, submit button — all fade+slide in with a visible stagger on page load.
- Resize the browser (or use device toolbar) to a width below 1024px and confirm the branding panel disappears entirely and the form column takes the full width, matching the previous single-column behavior.
- Submit the form with any credentials (a real login isn't required for this visual check — confirm the button shows "Entrando..." while `loading` is true, and that an error toast appears if the credentials are invalid, proving `handleSubmit`'s logic path is intact and untouched).

Stop the dev server after verifying.

- [ ] **Step 4: Commit any fixups found during manual verification**

If Step 3 revealed layout issues (e.g., overlap, illegible text, animation not looping, mobile breakpoint not collapsing correctly) or found `handleSubmit` behavior broken, fix it, re-run Steps 1-2, then:

```bash
git add -A
git commit -m "fix(web): address issues found in login redesign manual verification"
```

If no issues were found, skip this step — nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** split-screen layout with mobile collapse (Task 1), blob loop + form entrance animation (Task 2), manual verification of both desktop/mobile layout and the untouched auth flow (Task 3). The spec's explicit "fora de escopo" items (auth logic, password recovery, shared `AnimatedBlob` extraction) are correctly not tasked.
- **Type consistency:** `blobRef`/`formRef` and the `animate(...).pause()` cleanup pattern match the exact shape already used and reviewed in `hero.tsx`/`features.tsx` — no new conventions introduced.
- **No test file added**, consistent with the design spec's explicit call-out that this isn't meaningfully testable and no existing test covers this page today.
