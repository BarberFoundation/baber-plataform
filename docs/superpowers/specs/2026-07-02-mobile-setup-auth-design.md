# Mobile Setup + Auth — Design

Status: aprovado. Sub-spec 1 de N do app mobile `baber-mobile` (Flutter). Ver decisões fechadas no `Handoff.md` — não refazer.

## Escopo

Bootstrap do repo Flutter `baber-mobile` + fluxo de entrada do cliente final:

1. Seleção de tenant (lista manual + deep link/QR).
2. Auth OTP via WhatsApp (telefone → código → nome, se primeiro login).
3. JWT em secure storage com refresh automático.
4. Tela home placeholder (conteúdo real fica pra próximo sub-spec).

Fora de escopo: booking flow, listagem de barbeiros/serviços, histórico — sub-specs futuros.

## Dependência de backend (bloqueante — spec próprio em Identity, fora deste documento)

Endpoints ainda **não existem** no `apps/api`:

- `GET /tenants` — lista pública de tenants (seleção manual).
- `GET /tenants/{slug}` — resolve tenant a partir de deep link.
- `POST /api/v1/auth/otp/request { phone }` e `POST /api/v1/auth/otp/verify { phone, code }` — contrato já definido no `Handoff.md` §2.8 (tabela `otp_codes`, código 6 dígitos, expira 5min, max 3 tentativas, rate limit 1/60s e 5/hora via Redis).
- `PATCH /me` para setar nome no primeiro login — verificar se `me.controller.ts` já cobre isso; se não, incluir no spec de backend.

Este spec mobile assume esses contratos como dados e pode mockar localmente (ex: mock server ou fixtures) até o backend existir. Integração ponta a ponta só é possível depois do spec de backend Identity/OTP ser implementado.

## Repositório e estrutura

Repo standalone Flutter (`baber-mobile`), conforme `Handoff.md` §2.1:

```
baber-mobile/
├── lib/
│   ├── core/
│   │   ├── api/            # cliente HTTP gerado via openapi-generator + wrapper
│   │   ├── auth/            # OTP flow, JWT storage, refresh interceptor
│   │   ├── tenancy/         # seleção/persistência de tenant, deep link parsing
│   │   └── error/
│   ├── features/
│   │   ├── tenant_selection/
│   │   ├── auth/             # telas telefone / código / nome
│   │   └── home/             # placeholder
│   └── shared/
│       ├── widgets/
│       └── theme/
├── pubspec.yaml
└── README.md
```

Padrão por feature: `domain/` (entities, use cases), `data/` (datasource, repository impl), `presentation/` (bloc, pages, widgets).

## Stack

- **State management:** BLoC (`flutter_bloc`).
- **Cliente HTTP:** gerado via `openapi-generator` a partir do Swagger do NestJS (`GET /docs-json`). Wrapper fino por cima do cliente gerado para injetar header `Authorization`/tenant e centralizar tratamento de erro.
- **Navegação:** `go_router` com redirect guard: sem tenant salvo → `tenant_selection`; tenant salvo sem JWT válido → `auth`; ambos presentes → `home`.
- **Secure storage:** `flutter_secure_storage` (tokens, tenant_id, slug).
- **Plataformas:** Android + iOS.
- **Deep link:** URL scheme custom `baber://t/{slug}` (QR code codifica essa URL). Universal/App Links HTTPS ficam fora de escopo por ora.

## Fluxo

1. **Tenant selection**
   - App abre normal → tela lista tenants (busca simples, `GET /tenants`), usuário seleciona.
   - App abre via `baber://t/{slug}` (QR/link) → resolve direto via `GET /tenants/{slug}`, pula lista.
   - Tenant escolhido (`tenant_id`, `slug`) salvo em secure storage.

2. **Auth OTP**
   - Tela telefone → `POST auth/otp/request` → tela código (6 dígitos) → `POST auth/otp/verify` → resposta `{ accessToken, refreshToken, user }`.
   - Se `user.name == null` (primeiro login): tela pedir nome → `PATCH /me`.
   - Tokens salvos em secure storage. Access token 15min; refresh token 30d.
   - Interceptor no client HTTP: em 401, tenta refresh automático com refresh token; se refresh falhar (expirado/revogado), força logout.

3. **Home placeholder** pós-login — tela vazia com nome do tenant e do usuário, ponto de entrada pro próximo sub-spec (booking).

## Error handling

- Rede/timeout: sem retry automático silencioso — botão de retry manual na UI.
- OTP inválido/expirado/rate-limited: mensagens específicas mapeadas do status code da API (não mensagem genérica).
- Deep link com slug inexistente (404 em `GET /tenants/{slug}`): fallback pra tela de lista manual com toast de erro.
- Refresh token expirado/revogado (401 no refresh): logout forçado → volta pra `auth` (mantém tenant salvo, não volta pra tenant_selection).

## Testes

- Unit: BLoCs (`TenantSelectionBloc`, `AuthBloc`) com mocks do client HTTP gerado — cobre estados loading/success/error de cada transição.
- Widget tests: telas telefone/código/nome/lista de tenants — estados loading/error/success.
- Sem integration/e2e nesta fase (backend OTP real ainda não existe; depende do spec de backend).

## Próximos sub-specs (fora deste documento)

- Backend Identity: endpoints OTP + `GET /tenants[/{slug}]`.
- Mobile: home real (listar barbeiros/serviços).
- Mobile: booking flow (barbeiro → serviços → horário → confirmar).
- Mobile: histórico (cancelar/remarcar).
