# Mobile Auth — Telas & Navegação — Design

Status: aprovado. Continuação de `2026-07-02-mobile-setup-auth-design.md` (domain/data/bloc já implementados em `baber-mobile`, sem UI). Este spec cobre o que falta: telas, router, tema, wiring.

## Escopo

Repo `baber-mobile`. Sub-projeto 1 de N do app mobile (ver decomposição no Handoff/conversa: auth → catálogo → agendamento → staff mode → notificações → perfil).

Cobre: `SplashScreen`, `TenantSelectionScreen`, `PhoneScreen`, `OtpScreen`, `NameScreen`, `HomeScreen` (placeholder), `go_router` real, tema Material 3, wiring de repositórios/blocs em `main.dart`.

Fora de escopo: conteúdo real de home (catálogo/agendamento), staff mode, notificações.

## Desvio do spec anterior

- **Client HTTP:** spec anterior previa cliente gerado via `openapi-generator`. Implementação real usa `ApiClient` (Dio manual, `lib/core/api/api_client.dart`) com interceptor de auth header + refresh-on-401. Já implementado e testado — este spec assume esse cliente, não o gerado.
- **Erro handling:** spec anterior previa "botão de retry manual". Decisão desta sessão: `SnackBar`/toast via `BlocListener` (mais simples, sem estado de retry extra na UI).

## Gap encontrado (bloqueante, corrigido aqui)

Backend (`otp-auth.controller.ts`) exige `tenantId` obrigatório no body de `RequestOtpDto`/`VerifyOtpDto`. `AuthRepositoryImpl` atual não envia `tenantId`. Fix: injetar `TenantStorage` em `AuthRepositoryImpl`, ler `tenantId` salvo antes de cada chamada a `/auth/otp/request` e `/auth/otp/verify`. Não muda assinatura de `AuthBloc`/eventos — mudança isolada no repository impl (+ teste atualizado).

## Fluxo & navegação

```
Splash (lê tenant_storage + token_storage)
  ├─ tenant + token válidos → Home
  ├─ tenant salvo, sem token → Phone
  └─ sem tenant:
       ├─ deep link (baber://t/<slug>) no cold start → resolve → Phone
       └─ sem deep link → TenantSelection (lista) → seleciona → Phone
Phone → (PhoneSubmitted) → Otp
Otp → (CodeSubmitted) → needsName ? Name : Home
Name → (NameSubmitted) → Home
```

- **Router:** `go_router`. `SplashScreen` é a rota inicial (`/`), decide via `FutureBuilder` lendo `TokenStorage`+`TenantStorage` e chama `context.go()` pra rota final. Sem redirect síncrono complexo no `GoRouter.redirect`.
- **Deep link:** só cold start (via `app_links` `getInitialLink()`), sem listener contínuo em foreground/background — fora de escopo por agora.
- **Rotas de auth (Phone/Otp/Name) compartilham `AuthBloc`:** agrupadas sob uma rota-pai/shell no `go_router` com `BlocProvider` posicionado acima do grupo, pra manter estado (`codeSentToPhone`, etc) entre as 3 telas sem recriar o bloc a cada navegação.

## Telas

- **SplashScreen** — sem bloc próprio. Lê storages, decide rota, sem UI visível relevante (ou logo estático).
- **TenantSelectionScreen** — `TenantSelectionBloc`, dispara `LoadTenants` no `initState`. `ListView` de `ListTile` (nome do tenant). Tap → `SelectTenant` → navega Phone. Sem busca/filtro (YAGNI, poucos tenants esperados).
- **PhoneScreen** — `TextField` telefone (aceita formato livre, backend normaliza), botão "Continuar" → `PhoneSubmitted`. Loading = botão desabilitado + spinner.
- **OtpScreen** — recebe `phone` de `state.codeSentToPhone`. Campo 6 dígitos, botão "Confirmar" → `CodeSubmitted`. Botão "Reenviar" desabilitado com countdown 30s (`Timer.periodic` no widget); ao expirar, habilita e reenvio dispara `PhoneSubmitted` de novo.
- **NameScreen** — só renderizada quando `state.userNeedingName != null`. `TextField` nome → `NameSubmitted`.
- **HomeScreen** — placeholder: "Bem-vindo, {nome}" + botão sair (limpa `TokenStorage`+`TenantStorage`, `context.go('/tenant-selection')`).

## Tema

`lib/shared/theme/app_theme.dart`:

```dart
ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(
    seedColor: Colors.amber,
    brightness: Brightness.dark,
  ),
)
```

Dark por padrão, seed âmbar (clima barbearia). Sem token system customizado além disso — YAGNI até precisar de mais.

## Error handling

`BlocListener` em cada tela escuta `errorMessage` do state correspondente, dispara `ScaffoldMessenger.showSnackBar`. Substitui a proposta de "retry manual" do spec anterior.

## Wiring

`RepositoryProvider`s (Dio/`ApiClient`/`TokenStorage`/`TenantStorage`) no root (`main.dart`, substituindo o app-contador padrão do `flutter create`). `BlocProvider` por tela/grupo de rota, não global.

## Testes

Segue padrão existente (`bloc_test` + `mocktail`, um `_test.dart` por arquivo fonte):

- Widget tests por tela (`TenantSelectionScreen`, `PhoneScreen`, `OtpScreen`, `NameScreen`, `HomeScreen`): renderiza estado certo por state (loading/error/success), dispara evento certo ao interagir. Mock do bloc via `bloc_test`'s `whenListen`/`MockBloc`.
- `AuthRepositoryImpl`: atualiza teste existente pra cobrir `tenantId` no body (gap fix acima).
- `SplashScreen`: testa lógica de decisão de rota — 4 combinações (tenant+token / tenant sem token / sem tenant com deep link / sem tenant sem deep link).
- Sem integration/e2e nesta fase.

## Próximos sub-projetos (fora deste documento)

- Catálogo (barbeiros/serviços — view cliente).
- Agendamento (marcar/cancelar, histórico).
- Staff mode (agenda do dia, atendimentos).
- Notificações.
- Perfil/config.
