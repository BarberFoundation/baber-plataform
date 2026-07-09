# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dynamic greeting header, icon+color accents on the 4 stat cards, and an appointment count in the table title to `apps/web/src/pages/dashboard.tsx`, per `docs/superpowers/specs/2026-07-09-dashboard-redesign-design.md`, without touching data fetching or the existing entrance animations.

**Architecture:** Single-file change. Two small `Record<AppointmentStatus, ...>` lookup tables (icon component, icon background/text classes) added alongside the existing `STATUS_LABEL`/`STATUS_VARIANT`. The stat card markup restructures from a stacked `CardHeader`/`CardContent` into a single `CardContent` with an icon circle + label/number pair, so the existing `cardsRef`-driven entrance animation (which animates `cardsRef.current.children`, i.e. each `Card`) keeps working unchanged — only what's *inside* each card changes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react, `date-fns`, animejs (untouched in this plan — no new animation code).

---

## File Structure

- Modify: `apps/web/src/pages/dashboard.tsx` — add a `getGreeting()` helper, two new lookup constants (`STATUS_ICON`, `STATUS_ICON_CLASS`), restructure the header and stat card JSX, add a count to the table card's title.
- No new files, no test files (consistent with the design spec: no pre-existing dashboard test, and layout/visual changes aren't meaningfully testable in jsdom).

---

### Task 1: Add dynamic greeting to header

**Files:**
- Modify: `apps/web/src/pages/dashboard.tsx`

- [ ] **Step 1: Add a `getGreeting` helper function**

Add this function near the top of the file, after the `STATUS_VARIANT` constant and before `StatusBadge`:
```tsx
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
```

- [ ] **Step 2: Use it in the header**

Change:
```tsx
      <div>
        <h1 className="text-2xl font-bold capitalize">{dateLabel}</h1>
        <p className="text-muted-foreground text-sm">Resumo dos agendamentos de hoje</p>
      </div>
```
to:
```tsx
      <div>
        <p className="text-sm font-medium text-primary">{getGreeting()}</p>
        <h1 className="text-2xl font-bold capitalize">{dateLabel}</h1>
        <p className="text-muted-foreground text-sm">Resumo dos agendamentos de hoje</p>
      </div>
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/dashboard.tsx
git commit -m "feat(web): add dynamic greeting to dashboard header"
```

---

### Task 2: Add icon and color accent to stat cards

**Files:**
- Modify: `apps/web/src/pages/dashboard.tsx`

- [ ] **Step 1: Add imports**

Add to the top imports:
```tsx
import { Clock, CalendarCheck, CheckCheck, XCircle } from 'lucide-react';
```
```tsx
import { cn } from '@/lib/utils';
```

- [ ] **Step 2: Add the icon and color lookup tables**

Add these two constants right after `STATUS_VARIANT`:
```tsx
const STATUS_ICON: Record<AppointmentStatus, typeof Clock> = {
  PENDING: Clock,
  CONFIRMED: CalendarCheck,
  COMPLETED: CheckCheck,
  CANCELLED: XCircle,
};

const STATUS_ICON_CLASS: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400',
  COMPLETED: 'bg-secondary text-secondary-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};
```

- [ ] **Step 3: Restructure the stat card markup**

Change:
```tsx
      <div ref={cardsRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as AppointmentStatus[]).map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {STATUS_LABEL[status]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{counts[status] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>
```
to:
```tsx
      <div ref={cardsRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as AppointmentStatus[]).map((status) => {
          const Icon = STATUS_ICON[status];
          return (
            <Card key={status}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    STATUS_ICON_CLASS[status],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {STATUS_LABEL[status]}
                  </div>
                  <div className="text-3xl font-bold">{counts[status] ?? 0}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
```
Note: `CardHeader` and `CardTitle` are still used elsewhere in this file (the "Agendamentos de hoje" card in Task 3), so do not remove those imports — only the stat cards' internal structure changes here.

- [ ] **Step 4: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/dashboard.tsx
git commit -m "feat(web): add icon and color accents to dashboard stat cards"
```

---

### Task 3: Add appointment count to table title

**Files:**
- Modify: `apps/web/src/pages/dashboard.tsx`

- [ ] **Step 1: Update the table card's title**

Change:
```tsx
        <CardHeader>
          <CardTitle>Agendamentos de hoje</CardTitle>
        </CardHeader>
```
to:
```tsx
        <CardHeader>
          <CardTitle>Agendamentos de hoje ({appointments.length})</CardTitle>
        </CardHeader>
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/dashboard.tsx
git commit -m "feat(web): show appointment count in dashboard table title"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/web && npx vitest run`
Expected: all existing test files still pass (no test in this suite covers `dashboard.tsx` today; this is a pure regression check).

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Start the dev server and visually verify**

Run: `cd apps/web && npx vite`

You'll need an authenticated session. If you don't have real login credentials, set a fake token in the browser's localStorage before navigating (for visual inspection only):
```js
localStorage.setItem('baber-auth', JSON.stringify({
  state: { accessToken: 'fake-token-for-ui-check', expiresAt: Date.now() + 3600000, user: { id: '1', name: 'Test', role: 'ADMIN' } },
  version: 0,
}));
```
Then navigate to `http://localhost:5173/app`. Confirm:
- Greeting text above the date matches the current time of day ("Bom dia"/"Boa tarde"/"Boa noite").
- Each of the 4 stat cards shows a distinct icon in a colored circle (amber clock for Pendente, emerald calendar-check for Confirmado, neutral double-check for Concluído, red X-circle for Cancelado), with the label and number still legible.
- The "Agendamentos de hoje" card title shows the count in parentheses, matching the number of rows actually rendered in the table below it (or `(0)` if there's no data / the fake token can't fetch real data — confirm the number shown matches `appointments.length`, whatever that value is in your test environment).
- The existing entrance animation (cards fading/sliding in on load, table rows fading in once data resolves) still plays — this should be automatic since only the cards' internal content changed, not the animated container structure, but confirm visually rather than assuming.

Stop the dev server after verifying.

- [ ] **Step 4: Commit any fixups found during manual verification**

If Step 3 revealed an issue (wrong icon/color mapping, greeting logic off, count not matching, animation broken), fix it, re-run Steps 1-2, then:

```bash
git add -A
git commit -m "fix(web): address issues found in dashboard redesign manual verification"
```

If no issues were found, skip this step — nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** greeting (Task 1), stat card icons/colors (Task 2), table count (Task 3), manual verification including confirming the pre-existing animation still works (Task 4). The spec's "fora de escopo" items (charts, date filters, polling, query changes) are correctly not tasked.
- **Type consistency:** `STATUS_ICON`'s value type (`typeof Clock`, i.e. a lucide-react icon component type) is used consistently as `Icon` in the map callback and rendered as `<Icon .../>` — matches the existing `STATUS_LABEL`/`STATUS_VARIANT` record pattern already in the file.
- **Known constraint:** no new automated test coverage, consistent with the design spec's explicit reasoning (no pre-existing dashboard test, visual changes aren't meaningfully testable in jsdom) — Task 4's manual browser pass is the real verification gate.
- **Animation safety:** the `cardsRef` and `tableBodyRef` elements, and the effects that animate them, are not touched by any task in this plan — only the JSX *inside* each `Card`/`TableRow` changes, so the existing animation (already implemented and shipped in a prior commit) continues to target the same container children.
