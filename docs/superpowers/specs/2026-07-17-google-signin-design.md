# Login com Google (Firebase) — Design

Status: proposto. Depende de: nenhum (backend admin já genérico o suficiente). Relacionado: `docs/superpowers/specs/2026-07-09-firebase-phone-email-login-design.md` (mesma arquitetura: Firebase emite idToken, backend troca por par de tokens via `/auth/{admin,client}/exchange`).

## Escopo

Adicionar Google como terceiro método de login, ao lado de e-mail+senha e telefone, já existentes.

1. **Admin web (`apps/web/src/pages/login.tsx`)** — novo botão "Continuar com Google", via `signInWithPopup(firebaseAuth, new GoogleAuthProvider())`. Reaproveita `exchangeIdToken`/`POST /auth/admin/exchange` já existente. **Zero mudança de backend** — esse endpoint já cria `User.createAdmin` a partir de qualquer idToken Firebase válido, e email é claim padrão do provider Google.
2. **App mobile futuro, staff** — mesmo padrão quando o app existir (SDK Firebase para RN/Expo equivalente ao `signInWithPopup`/`signInWithCredential`). Sem mudança de backend.

Fora de escopo (implementação):
- Scaffold do app mobile (não existe neste repo ainda).
- Login Google para usuários **CLIENT** — ver seção "Pendência" abaixo. Documentado aqui pra não perder o requisito, mas não implementado nesta spec.

## Console Firebase

Passo manual, uma vez: Authentication → Sign-in method → habilitar provider **Google**. Sem isso `signInWithPopup` falha com `auth/operation-not-allowed`.

## Frontend (`apps/web/src/pages/login.tsx`)

- Import `GoogleAuthProvider`, `signInWithPopup` de `firebase/auth`.
- Novo estado `googleLoading`.
- Novo handler:
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
- Posicionamento: botão fica **acima** das tabs e-mail/telefone (não é uma terceira tab — é ação de um clique, não tem formulário próprio), com um divisor "ou" abaixo dele separando das tabs existentes.
- `FIREBASE_ERROR_MESSAGES` ganha:
  ```ts
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/popup-blocked': 'Pop-up bloqueado pelo navegador. Permita pop-ups e tente novamente.',
  'auth/account-exists-with-different-credential': 'Já existe uma conta com este e-mail usando outro método de login.',
  ```

## Erros

Sem mudança de contrato no backend — mesmos erros do fluxo email/telefone já cobrem (`InvalidFirebaseTokenError`, `TenantNotFoundError`). Os únicos erros novos são do SDK client-side do Firebase (lista acima).

## Testes

- `login.test.tsx`: mock de `signInWithPopup`/`GoogleAuthProvider`. Casos: sucesso (chama `exchangeIdToken`, navega pra `/app`), popup fechado pelo usuário (toast, sem navegação), popup bloqueado (toast).
- Sem teste novo de backend — `ExchangeFirebaseTokenUseCase` já testado pro caso de email/telefone, e Google entrega claim `email`, caminho idêntico ao email/senha do ponto de vista do backend.

## Pendência — login Google para cliente (CLIENT) no app mobile

Não implementado nesta spec. Fica registrado pra quando o app mobile for scaffoldado:

`ExchangeFirebaseClientTokenUseCase` hoje **exige** `payload.phone` (lança `InvalidFirebaseTokenError` se ausente — `exchange-firebase-client-token.use-case.ts:44`) e `User.createClient` só aceita `phone` (não `email`) como identificador. Google entrega `email`, não `phone` — client autenticado só via Google não passa nesse fluxo hoje.

O que muda quando essa spec for feita (não agora):
- Schema **já suporta** isso sem migration — `phone` e `email` já são nullable com unique constraints que toleram múltiplos NULL por tenant (`users.ts:23-28`), pensado desde a spec de telefone justamente pra esse caso.
- Muda só lógica de aplicação: `CreateClientUserProps` aceitar `phone` OU `email` (pelo menos um dos dois, não os dois obrigatórios); `ExchangeFirebaseClientTokenUseCase` trocar o guard de "precisa ter phone" por "precisa ter phone OU email"; `findByPhone`-based dedup de usuário legado (linhas 58-63 do use case) precisa de um equivalente `findByEmail` quando o claim for email.
- Sem mudança de rota/contrato HTTP — mesmo `POST /auth/client/exchange`.

## Impacto branch mobile

Quando `feature/mobile-app-full` implementar o app de fato, os plans de auth mobile devem incluir Google como método adicional (via SDK Firebase Google Sign-In pra RN/Expo) tanto pra staff quanto pra cliente — a parte staff já funciona sem mudança (backend genérico), a parte cliente depende da pendência acima ser resolvida primeiro.
