# CRUD Screens Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the duplicated appointment-status dictionaries into a shared module, and add status/active-count summary cards (matching the dashboard's icon-circle visual pattern) to the top of `appointments.tsx`, `barbers.tsx`, and `services.tsx`, per `docs/superpowers/specs/2026-07-09-crud-screens-redesign-design.md`.

**Architecture:** One new file (`apps/web/src/lib/appointment-status.ts`) holding `STATUS_LABEL`/`STATUS_VARIANT`/`STATUS_ICON`/`STATUS_ICON_CLASS`, consumed by both `dashboard.tsx` (already has this logic locally — swapped to import) and `appointments.tsx` (previously duplicated `STATUS_LABEL`/`STATUS_VARIANT` locally — swapped to import, plus gains the icon dictionaries for its new summary cards). `barbers.tsx` and `services.tsx` get simpler, page-local active/inactive summary cards using the same visual pattern but no shared status domain (active/inactive isn't `AppointmentStatus`), so no extraction needed there.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, lucide-react, `@tanstack/react-query` (untouched), `class-variance-authority`/`cn` utility.

---

## File Structure

- Create: `apps/web/src/lib/appointment-status.ts` — `STATUS_LABEL`, `STATUS_VARIANT`, `STATUS_ICON`, `STATUS_ICON_CLASS` for `AppointmentStatus`.
- Modify: `apps/web/src/pages/dashboard.tsx` — remove local status dictionaries, import from the new shared module.
- Modify: `apps/web/src/pages/appointments.tsx` — remove local `STATUS_LABEL`/`STATUS_VARIANT`, import from shared module, add 4 summary cards reflecting the filtered list.
- Modify: `apps/web/src/pages/barbers.tsx` — add 2 summary cards (Ativos/Inativos).
- Modify: `apps/web/src/pages/services.tsx` — add 2 summary cards (Ativos/Inativos).
- No new test files — no pre-existing tests for any of these four pages, and per the design spec, visual/layout changes aren't meaningfully testable in jsdom.

---

### Task 1: Extract shared `appointment-status.ts`, update `dashboard.tsx`

**Files:**
- Create: `apps/web/src/lib/appointment-status.ts`
- Modify: `apps/web/src/pages/dashboard.tsx`

- [ ] **Step 1: Create the shared module**

```tsx
// apps/web/src/lib/appointment-status.ts
import { Clock, CalendarCheck, CheckCheck, XCircle } from 'lucide-react';
import type { AppointmentStatus } from '@/lib/types';

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

export const STATUS_VARIANT: Record<AppointmentStatus, 'warning' | 'success' | 'secondary' | 'destructive'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
};

export const STATUS_ICON: Record<AppointmentStatus, typeof Clock> = {
  PENDING: Clock,
  CONFIRMED: CalendarCheck,
  COMPLETED: CheckCheck,
  CANCELLED: XCircle,
};

export const STATUS_ICON_CLASS: Record<AppointmentStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400',
  COMPLETED: 'bg-secondary text-secondary-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};
```

- [ ] **Step 2: Update `dashboard.tsx`'s imports and remove the local dictionaries**

Change the top of `apps/web/src/pages/dashboard.tsx` from:
```tsx
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { animate, stagger } from 'animejs';
import { Clock, CalendarCheck, CheckCheck, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { Appointment, AppointmentStatus } from '@/lib/types';

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

const STATUS_VARIANT: Record<AppointmentStatus, 'warning' | 'success' | 'secondary' | 'destructive'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
};

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

function getGreeting(): string {
```
to:
```tsx
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { animate, stagger } from 'animejs';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { STATUS_LABEL, STATUS_VARIANT, STATUS_ICON, STATUS_ICON_CLASS } from '@/lib/appointment-status';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { Appointment, AppointmentStatus } from '@/lib/types';

function getGreeting(): string {
```
Everything below `function getGreeting()` (the function body, `StatusBadge`, and the entire `DashboardPage` component) stays completely unchanged — only the dictionaries moved out and the `lucide-react` icon imports (now unused directly in this file) were removed.

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/appointment-status.ts apps/web/src/pages/dashboard.tsx
git commit -m "refactor(web): extract shared appointment-status dictionaries"
```

---

### Task 2: Update `appointments.tsx` to use shared module, add summary cards

**Files:**
- Modify: `apps/web/src/pages/appointments.tsx`

- [ ] **Step 1: Update imports**

Change:
```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { Appointment, AppointmentStatus, Barber } from '@/lib/types';

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

const STATUS_VARIANT: Record<AppointmentStatus, 'warning' | 'success' | 'secondary' | 'destructive'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
};

export default function AppointmentsPage() {
```
to:
```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { STATUS_LABEL, STATUS_VARIANT, STATUS_ICON, STATUS_ICON_CLASS } from '@/lib/appointment-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import type { Appointment, AppointmentStatus, Barber } from '@/lib/types';

export default function AppointmentsPage() {
```

- [ ] **Step 2: Add a per-status count derived from the already-filtered list**

Find this line (it already exists, near the end of the component's data-derivation logic, right before the `return`):
```tsx
  const sorted = appointments.slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
```
Add immediately after it:
```tsx

  const statusCounts = sorted.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<AppointmentStatus, number>>,
  );
```
(Named `statusCounts`, not `counts`, to avoid any ambiguity with other variables in this file.)

- [ ] **Step 3: Insert the summary cards**

Find:
```tsx
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agendamentos</h1>

      <Card>
        <CardContent className="pt-4">
```
Change to:
```tsx
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agendamentos</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as AppointmentStatus[]).map((s) => {
          const Icon = STATUS_ICON[s];
          return (
            <Card key={s}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    STATUS_ICON_CLASS[s],
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">{STATUS_LABEL[s]}</div>
                  <div className="text-3xl font-bold">{statusCounts[s] ?? 0}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-4">
```
Note the map variable is named `s`, not `status` — this file already has a `status` state variable (the status filter dropdown's value) in scope, and reusing that name in the map callback would shadow it confusingly.

- [ ] **Step 4: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/appointments.tsx
git commit -m "feat(web): add filtered status summary cards to appointments page"
```

---

### Task 3: Add active/inactive summary cards to `barbers.tsx`

**Files:**
- Modify: `apps/web/src/pages/barbers.tsx`

- [ ] **Step 1: Add icon imports**

Change:
```tsx
import { Plus } from 'lucide-react';
```
to:
```tsx
import { Plus, UserCheck, UserX } from 'lucide-react';
```

- [ ] **Step 2: Compute active/inactive counts**

Find this line (the `useQuery` that fetches barbers):
```tsx
  const { data: barbers = [], isLoading } = useQuery({
    queryKey: ['barbers-admin'],
    queryFn: () => apiFetch<Barber[]>('/barbers/admin?includeInactive=true'),
  });
```
Add immediately after it:
```tsx

  const activeCount = barbers.filter((b) => b.isActive).length;
  const inactiveCount = barbers.length - activeCount;
```

- [ ] **Step 3: Insert the summary cards**

Find:
```tsx
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{barbers.length} barbeiro(s)</CardTitle>
```
Change to:
```tsx
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Ativos</div>
              <div className="text-3xl font-bold">{activeCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Inativos</div>
              <div className="text-3xl font-bold">{inactiveCount}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{barbers.length} barbeiro(s)</CardTitle>
```

- [ ] **Step 4: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/barbers.tsx
git commit -m "feat(web): add active/inactive summary cards to barbers page"
```

---

### Task 4: Add active/inactive summary cards to `services.tsx`

**Files:**
- Modify: `apps/web/src/pages/services.tsx`

- [ ] **Step 1: Add icon imports**

Change:
```tsx
import { Plus } from 'lucide-react';
```
to:
```tsx
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
```

- [ ] **Step 2: Compute active/inactive counts**

Find this line (the `useQuery` that fetches services):
```tsx
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services-admin'],
    queryFn: () => apiFetch<Service[]>('/services/admin?includeInactive=true'),
  });
```
Add immediately after it:
```tsx

  const activeCount = services.filter((s) => s.isActive).length;
  const inactiveCount = services.length - activeCount;
```

- [ ] **Step 3: Insert the summary cards**

Find:
```tsx
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{services.length} serviço(s)</CardTitle>
```
Change to:
```tsx
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Ativos</div>
              <div className="text-3xl font-bold">{activeCount}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Inativos</div>
              <div className="text-3xl font-bold">{inactiveCount}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{services.length} serviço(s)</CardTitle>
```

- [ ] **Step 4: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/services.tsx
git commit -m "feat(web): add active/inactive summary cards to services page"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/web && npx vitest run`
Expected: all existing test files still pass (pure regression check — no test covers any of the four touched pages).

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc -b --noEmit`
Expected: no output, exit code 0.

- [ ] **Step 3: Start the dev server and visually verify**

Run: `cd apps/web && npx vite`

Use a fake auth token in localStorage if you don't have real credentials (visual inspection only, as in prior sub-projects):
```js
localStorage.setItem('baber-auth', JSON.stringify({
  state: { accessToken: 'fake-token-for-ui-check', expiresAt: Date.now() + 3600000, user: { id: '1', name: 'Test', role: 'ADMIN' } },
  version: 0,
}));
```

Confirm on `http://localhost:5173/app`:
- **Dashboard**: unchanged in appearance from before this plan (the refactor in Task 1 should be purely internal — greeting, stat card icons, table count all still there and correct).
- **`/app/appointments`**: 4 summary cards appear above the filter row, showing Pendente/Confirmado/Concluído/Cancelado counts with the correct icons/colors. Change the date/barber/status filters and confirm the summary cards' numbers update to match the filtered table below them (not the unfiltered total).
- **`/app/barbers`**: "Ativos"/"Inativos" cards appear above the barbers table, with counts matching what's visible in the table's Status column.
- **`/app/services`**: same check for services — "Ativos"/"Inativos" cards match the table.

Stop the dev server after verifying.

- [ ] **Step 4: Commit any fixups found during manual verification**

If Step 3 revealed an issue (wrong counts, wrong icon/color, dashboard regression from the refactor), fix it, re-run Steps 1-2, then:

```bash
git add -A
git commit -m "fix(web): address issues found in CRUD screens manual verification"
```

If no issues were found, skip this step — nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** shared module extraction + dashboard update (Task 1), appointments summary cards reflecting filtered data (Task 2), barbers summary cards (Task 3), services summary cards (Task 4), full verification including confirming filtered-count correctness and no dashboard regression (Task 5). The spec's "fora de escopo" items (new queries, pagination, animation on the new cards, changes to create/edit/deactivate flows) are correctly not tasked.
- **Type consistency:** `STATUS_ICON`'s value type (`typeof Clock`) and all four dictionaries' shapes are defined once in `appointment-status.ts` and consumed identically by both `dashboard.tsx` and `appointments.tsx` — no risk of the two files drifting out of sync the way the pre-existing duplication did.
- **Naming collision avoided:** `appointments.tsx`'s summary-card map uses `s` instead of `status` for the loop variable, since `status` is already a state variable in that file (the status filter). `statusCounts` (not `counts`) is used for the derived tally to avoid ambiguity with any other similarly-named variable in the file.
- **No animation added** to the new cards in any of the three pages, per the spec's explicit scope boundary — this is a visual-structure-only change.
