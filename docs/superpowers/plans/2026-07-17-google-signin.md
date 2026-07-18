# Google Sign-In (Admin Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Continuar com Google" button to the admin login page that signs in via Firebase `signInWithPopup(GoogleAuthProvider)` and exchanges the resulting idToken through the existing `/auth/admin/exchange` endpoint — no backend changes.

**Architecture:** `apps/web/src/pages/login.tsx` already has two auth methods (email/password, phone) that both call a shared `exchangeIdToken(idToken)` helper hitting `POST /auth/admin/exchange`. Google Sign-In slots in as a third entry point into that same helper: get a Firebase credential via popup, get its idToken, call `exchangeIdToken`. It is a one-click action (not a tab with its own form), placed above the existing email/phone tabs with a divider.

**Tech Stack:** React (Vite), `firebase/auth` (`signInWithPopup`, `GoogleAuthProvider`), Vitest + Testing Library, existing `Button`/`Separator` UI components.

**Scope note:** This plan covers the admin web surface only, per `docs/superpowers/specs/2026-07-17-google-signin-design.md`. Backend and mobile-client changes for Google are explicitly out of scope (documented as a pendency in that spec) and are not part of this plan.

---

### Task 1: Google Sign-In button — success flow

**Files:**
- Modify: `apps/web/src/pages/login.tsx`
- Test: `apps/web/src/pages/__tests__/login.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `apps/web/src/pages/__tests__/login.test.tsx`. First, extend the `firebase/auth` mock at the top of the file to include a mock `signInWithPopup` and a spy-able `GoogleAuthProvider`:

```ts
const mockSignInWithPopup = vi.fn();

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');
  return {
    ...actual,
    signInWithEmailAndPassword: vi.fn(),
    signInWithPhoneNumber: (...args: unknown[]) => mockSignInWithPhoneNumber(...args),
    signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
    RecaptchaVerifier: function (...args: unknown[]) {
      return mockRecaptchaVerifier(...args);
    },
  };
});
```

(`GoogleAuthProvider` is left as `actual` — it's just a plain constructor with no network calls, safe to use unmocked.)

Add `mockSignInWithPopup.mockReset();` to the existing `beforeEach`.

Then add a new describe block at the end of the file, before the final closing of the file:

```ts
describe('LoginPage — Google', () => {
  it('signs in with a Google popup and exchanges the resulting idToken', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: { getIdToken: vi.fn().mockResolvedValue('id-token-google') },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /continuar com google/i }));

    await waitFor(() => expect(mockSignInWithPopup).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/pages/__tests__/login.test.tsx -t "Google"`
Expected: FAIL — `Unable to find an accessible element with the role "button" and name "/continuar com google/i"` (button doesn't exist yet).

- [ ] **Step 3: Implement the button and handler**

In `apps/web/src/pages/login.tsx`:

Add to the imports from `firebase/auth` (currently `login.tsx:3-8`):

```ts
import {
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  type ConfirmationResult,
} from 'firebase/auth';
```

Add `Separator` to the component imports (after `login.tsx:16`, alongside the existing `@/components/ui/*` imports):

```ts
import { Separator } from '@/components/ui/separator';
```

Add new state, right after the existing `method` state (`login.tsx:49`):

```ts
const [googleLoading, setGoogleLoading] = useState(false);
```

Add the handler, right after `handleEmailSubmit` (after `login.tsx:120`):

```ts
async function handleGoogleSignIn() {
  setGoogleLoading(true);
  try {
    const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    const idToken = await credential.user.getIdToken();
    const result = await exchangeIdToken(idToken);
    setAuth(result.accessToken, result.expiresIn, result.user);
    void navigate('/app');
  } catch (err) {
    toast.error(firebaseErrorMessage(err));
  } finally {
    setGoogleLoading(false);
  }
}
```

Add the button + divider in the JSX, right after the `<p className="mt-1 ...">Acesse o painel administrativo.</p>` line and before the method-switch buttons (`login.tsx:186-188`):

```tsx
<Button
  type="button"
  variant="outline"
  className="mt-6 w-full gap-2"
  disabled={googleLoading}
  onClick={() => void handleGoogleSignIn()}
>
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.28A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.56.4-2.28V6.63H1.29A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.29 5.37z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
    />
  </svg>
  {googleLoading ? 'Entrando...' : 'Continuar com Google'}
</Button>
<div className="my-6 flex items-center gap-3">
  <Separator className="flex-1" />
  <span className="text-xs text-muted-foreground">ou</span>
  <Separator className="flex-1" />
</div>
```

Note this button/divider block replaces the `mt-6` on the method-switch `<div className="mt-6 flex gap-2">` (`login.tsx:188`) — change that div's class to just `flex gap-2` since the divider above it now provides the spacing.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/pages/__tests__/login.test.tsx -t "Google"`
Expected: PASS

- [ ] **Step 5: Run the full login test file to check for regressions**

Run: `cd apps/web && npx vitest run src/pages/__tests__/login.test.tsx`
Expected: PASS (all existing email/phone tests plus the new Google test)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/login.tsx apps/web/src/pages/__tests__/login.test.tsx
git commit -m "feat(web): add Google Sign-In button to admin login"
```

---

### Task 2: Google Sign-In error mapping

**Files:**
- Modify: `apps/web/src/pages/login.tsx`
- Test: `apps/web/src/pages/__tests__/login.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to the `describe('LoginPage — Google', ...)` block from Task 1:

```ts
  it('shows a toast when the user closes the Google popup', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /continuar com google/i }));

    await waitFor(() => expect(mockSignInWithPopup).toHaveBeenCalled());
    expect(await screen.findByText('Login cancelado.')).toBeInTheDocument();
  });

  it('shows a toast when the Google popup is blocked', async () => {
    mockSignInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /continuar com google/i }));

    expect(
      await screen.findByText('Pop-up bloqueado pelo navegador. Permita pop-ups e tente novamente.'),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/pages/__tests__/login.test.tsx -t "Google"`
Expected: FAIL — toast text not found (falls through to the generic `'Erro ao fazer login. Tente novamente.'` message since the codes aren't mapped yet).

- [ ] **Step 3: Add the error mappings**

In `apps/web/src/pages/login.tsx`, extend `FIREBASE_ERROR_MESSAGES` (`login.tsx:23-28`):

```ts
const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'Número de telefone inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
  'auth/invalid-verification-code': 'Código de verificação inválido.',
  'auth/code-expired': 'Código expirado. Solicite um novo.',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/popup-blocked': 'Pop-up bloqueado pelo navegador. Permita pop-ups e tente novamente.',
  'auth/account-exists-with-different-credential':
    'Já existe uma conta com este e-mail usando outro método de login.',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/pages/__tests__/login.test.tsx -t "Google"`
Expected: PASS

- [ ] **Step 5: Run the full login test file to check for regressions**

Run: `cd apps/web && npx vitest run src/pages/__tests__/login.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/login.tsx apps/web/src/pages/__tests__/login.test.tsx
git commit -m "feat(web): map Google popup errors to toasts"
```

---

### Task 3: Enable Google provider in Firebase console (manual, no code)

**Files:** none — Firebase Console only.

- [ ] **Step 1: Enable the provider**

Go to https://console.firebase.google.com → project `baber-fundation` → Authentication → Sign-in method → enable **Google** provider → set support email → Save.

- [ ] **Step 2: Verify locally**

Run the web app (`cd apps/web && npm run dev`), open the login page, click "Continuar com Google", complete the popup flow with a real Google account, confirm it redirects to `/app` and the admin user is created/logged in (check via the app's own client list / your user, or via `mcp__supabase__execute_sql` against the `users` table for a new row with `firebase_uid` set and `role = 'ADMIN'`).

No commit — this step is a manual console change plus a manual smoke test, not a code change.

---

## Self-Review Notes

- **Spec coverage:** Admin web button (Task 1), error mapping (Task 2), console provider enablement + manual verification (Task 3) all covered. The spec's "Pendência" section (client/mobile Google login) is explicitly out of scope for this plan per the spec itself — no task needed here.
- **Type consistency:** `exchangeIdToken`, `setAuth`, `navigate`, `firebaseAuth`, `toast`, `firebaseErrorMessage` are all reused as already defined in `login.tsx` — no new types introduced.
- **No placeholders:** all steps have concrete code/commands.
