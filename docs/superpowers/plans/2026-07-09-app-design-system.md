# App Design System (Dark Theme) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme the authenticated app (`/app/...`) to a dark, landing-consistent color system, per `docs/superpowers/specs/2026-07-09-app-design-system-design.md`.

**Architecture:** Replace the shadcn CSS custom properties in `apps/web/src/index.css` with dark, orange-accented HSL values derived from the landing page's actual Tailwind classes. Fix the two hardcoded-light-color `Badge` variants (`warning`, `success`) that would otherwise be illegible on the new dark background. Validate the sidebar (`AppShell`), which already consumes theme tokens and needs no code change, only visual confirmation.

**Tech Stack:** Tailwind CSS (CSS custom properties / shadcn convention), React 18, TypeScript, `class-variance-authority` (badge variants), vitest.

---

## File Structure

- Modify: `apps/web/src/index.css` — `:root` CSS variables (background/foreground/card/primary/secondary/muted/accent/destructive/border/input/ring).
- Modify: `apps/web/src/components/ui/badge.tsx` — `warning` and `success` variant classes only.
- No new files. No test files — there is no meaningful automated assertion for color values; verification is `tsc`, the existing test suite (regression-only, unrelated to color), and manual visual review across all five app pages (login, dashboard, appointments, barbers, services) in Task 3.

---

### Task 1: Update theme CSS variables

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Replace the `:root` variable block**

Current content of `apps/web/src/index.css` (for reference, to locate the block):
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}
```

Replace it with:
```css
@layer base {
  :root {
    --background: 0 0% 4%;
    --foreground: 0 0% 98%;
    --card: 0 0% 9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 9%;
    --popover-foreground: 0 0% 98%;
    --primary: 20.5 90% 48%;
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 15%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 15%;
    --muted-foreground: 0 0% 64%;
    --accent: 0 0% 15%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 74% 42%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 15%;
    --input: 0 0% 15%;
    --ring: 20.5 90% 48%;
    --radius: 0.5rem;
  }
}
```
Leave the second `@layer base { * { @apply border-border; } body { @apply bg-background text-foreground; } }` block untouched — it already applies the new variables automatically.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat(web): switch app theme to dark, landing-consistent palette"
```

---

### Task 2: Fix badge warning/success variants for dark background

**Files:**
- Modify: `apps/web/src/components/ui/badge.tsx`

- [ ] **Step 1: Update the two hardcoded-light variants**

In `apps/web/src/components/ui/badge.tsx`, change:
```tsx
        warning: 'border-transparent bg-yellow-100 text-yellow-800',
        success: 'border-transparent bg-green-100 text-green-800',
```
to:
```tsx
        warning: 'border-transparent bg-amber-500/10 text-amber-400',
        success: 'border-transparent bg-emerald-500/10 text-emerald-400',
```
Leave `default`, `secondary`, `destructive`, `outline` untouched — they already reference theme tokens (`bg-primary`, `bg-secondary`, `bg-destructive`, `text-foreground`) and pick up the new dark theme automatically via Task 1's variable changes.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/badge.tsx
git commit -m "fix(web): make badge warning/success variants legible on dark background"
```

---

### Task 3: Full verification pass (typecheck, tests, manual visual review)

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/web && npx vitest run`
Expected: all existing test files still pass (this change touches no logic, only CSS/class strings — a regression here would indicate something unexpected, e.g. a test asserting on a class name).

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Start the dev server and visually verify every app page**

Run: `cd apps/web && npx vite`

You'll need an authenticated session to reach `/app/...` pages. If you don't have real login credentials, you can bypass `ProtectedRoute` for visual-inspection purposes only (never for anything else) by setting a fake token in the browser's localStorage before navigating:
```js
localStorage.setItem('baber-auth', JSON.stringify({
  state: { accessToken: 'fake-token-for-ui-check', expiresAt: Date.now() + 3600000, user: { id: '1', name: 'Test', role: 'ADMIN' } },
  version: 0,
}));
```
Then navigate to `http://localhost:5173/app`. API calls will fail (no real backend session), but the pages should still render their static shell/loading states, which is enough to review the theme.

Confirm on each of these pages that text is legible (no dark-on-dark or light-on-light), the primary color reads as orange (not the old near-black), and there is no leftover light-background element:
- `/login` — check the centered card, inputs, and submit button.
- `/app` (dashboard) — stat cards, table headers, badges (`Pendente`/`Confirmado`/`Concluído`/`Cancelado` — confirm `warning`/`success`/`secondary`/`destructive` badge colors are all readable).
- `/app/appointments` — filter controls (date input, selects), table, action buttons, status badges.
- `/app/barbers` — table, `Ativo`/`Inativo` badges, "Novo barbeiro" dialog (open it to check dialog background/text contrast too).
- `/app/services` — table, price/duration columns, badges, "Novo serviço" dialog.

Also confirm the sidebar (`AppShell`): dark background, active nav item highlighted in orange, inactive items legible, "Sair" button legible.

Stop the dev server after verifying (`Ctrl+C`, or kill the process by the port it printed).

- [ ] **Step 4: Commit any fixups found during manual verification**

If Step 3 revealed illegible text, wrong contrast, or a missed hardcoded light-color class anywhere, fix it, re-run Steps 1-2, then:

```bash
git add -A
git commit -m "fix(web): address contrast issues found in dark theme manual verification"
```

If no issues were found, skip this step — nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** CSS variable replacement (Task 1), badge variant fix (Task 2), sidebar validation + full-app manual visual review (Task 3). The spec's "out of scope" items (page-level layout changes, light/dark toggle, animations) are correctly not tasked here.
- **Type consistency:** no new functions/types introduced; this plan only edits CSS values and Tailwind class strings.
- **Known constraint:** there is no real automated test coverage for visual/color correctness in this codebase (jsdom doesn't render CSS meaningfully) — Task 3's manual browser pass is the actual verification gate, not vitest.
