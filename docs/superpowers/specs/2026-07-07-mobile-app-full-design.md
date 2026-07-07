# App Mobile Completo (Cliente) — Design

Depende de: mobile-auth-ui (concluído). Bloqueia: planos de implementação por módulo (catalog/team browsing, booking backend, minhas-consultas, notificações).

## Escopo

Cliente autenticado (já resolvido pelo fluxo de auth) agora pode: ver serviços, agendar (sem escolher barbeiro — auto-assign), ver/cancelar próprias consultas, ver histórico de notificações enviadas por WhatsApp. Fora de escopo: reagendar, telas de staff/barbeiro, push notification (FCM), escolha manual de barbeiro.

## 1. Backend — Scheduling: auto-assign de barbeiro

**Problema:** `barberId` é obrigatório hoje (`Appointment.create`, `BookAppointmentDto`, coluna `appointments.barber_id NOT NULL`). Cliente não deve escolher barbeiro.

**Mudança de schema** (`apps/api/src/shared/database/schema/appointments.ts`): `barberId` vira nullable. Migration via `db:generate`.

**`GET /appointments/available-slots`**: novo modo — `serviceId` + `date` sem `barberId` → `GetAvailableSlotsUseCase` passa a aceitar `barberId` opcional; quando ausente, busca todos barbeiros ativos do tenant (`IBarberLookup.listActive(tenantId)` — novo método no port), calcula slots de cada um e retorna a **união** (slot ocupado só se todos os barbeiros estiverem ocupados nele).

**`POST /appointments`**: `BookAppointmentDto.barberId` vira opcional. Em `BookAppointmentUseCase.execute`: se `barberId` ausente, itera barbeiros ativos do tenant, pega o primeiro com aquele slot livre (reusa `BookingPolicy` por candidato); se nenhum livre, erro `NoBarberAvailableError` (novo, mapeado pra 409).

## 2. Backend — Vínculo cliente ↔ consulta

**Schema**: `appointments.customer_id` (uuid, nullable, FK → `users.id`). Nullable pra não quebrar bookings antigos/admin sem login.

**`POST /appointments`**: authGuard passa a rodar antes (endpoint deixa de ser `@Public()` — cliente precisa estar logado pra agendar). Handler injeta `customerId: user.userId` a partir do `CurrentUser`/`JwtPayload` no `BookAppointmentUseCase.execute`. `clientName`/`clientPhone` continuam vindo do body (evita nova consulta pro nome do user).

**`GET /appointments/my`** (novo, protegido, role CLIENT): `ListAppointmentsUseCase` variante filtrando por `customerId = user.userId` e `tenantId = user.tenantId`, todos status, ordenado por `date`/`startTime` desc.

**`PATCH /appointments/:id/cancel`**: guard de role hoje é `ADMIN`-only. Passa a aceitar também o dono: `user.role === 'ADMIN' || appointment.customerId === user.userId`. Regra de negócio: só cancela se `status` for `PENDING` ou `CONFIRMED` e a consulta ainda não começou (`date+startTime > now`) — senão 409.

## 3. Backend — Notificações: leitura pelo cliente

`notification_logs` não tem `userId`, só `phone` + `appointmentId` (FK appointments). Sem nova coluna: `GET /notifications/my` (novo, protegido) faz join `notification_logs.appointment_id = appointments.id WHERE appointments.customer_id = user.userId`, retorna `{type, message, status, sentAt, createdAt}` ordenado desc. Sem endpoint de "marcar como lida" (não há esse conceito hoje — é log de envio, não inbox).

## 4. Mobile — Catálogo (novo feature `catalog`)

`GET /services` já existe e é público — só precisa do header `x-tenant-id` (já resolvido pelo `ApiClient` existente, que injeta tenant salvo). Tela `ServicesListScreen`: lista `nome, duração, preço (formatado em R$)`. Sem tela de barbeiros (cliente não escolhe).

Camadas: `domain/service.dart` (entidade), `domain/service_repository.dart` (porta), `data/service_repository_impl.dart` (dio), `presentation/services_bloc.dart` + `services_list_screen.dart`.

## 5. Mobile — Agendamento (novo feature `booking`)

Fluxo: `ServicesListScreen` → tap serviço → `DatePickerScreen` (calendário simples, próximos 30 dias) → `SlotsScreen` (`GET /available-slots?serviceId&date`, grid de horários) → tap horário → `ConfirmBookingScreen` (resumo: serviço, data, hora, preço; campos `clientName`/`clientPhone` pré-preenchidos do perfil, editáveis) → `POST /appointments` → `BookingSuccessScreen` (checkmark, botão "Ver minhas consultas").

Bloc por etapa seria overkill — um `BookingBloc` único guarda o estado do fluxo inteiro (serviço selecionado → data → slot → confirmação), consistente com o padrão single-bloc-por-fluxo já usado em `AuthBloc`.

## 6. Mobile — Minhas Consultas (novo feature `appointments`)

`MyAppointmentsScreen`: lista via `GET /appointments/my`, pull-to-refresh (`RefreshIndicator`), separada em "Próximas" (PENDING/CONFIRMED futuras) e "Histórico" (resto). Item com status badge (cores: PENDING âmbar, CONFIRMED verde, COMPLETED cinza, CANCELLED vermelho). Consultas futuras não canceladas mostram botão "Cancelar" → dialog de confirmação → `PATCH /appointments/:id/cancel` → refresh da lista.

## 7. Mobile — Notificações (novo feature `notifications`)

`NotificationsScreen`: lista somente-leitura via `GET /notifications/my`. Cada item: ícone por `type` (confirmação/cancelamento/lembrete), mensagem, data relativa ("há 2h"). Sem estado de lida/não-lida.

## 8. Mobile — Home vira dashboard

`HomeScreen` atual (placeholder "Bem-vindo, {nome}") ganha: card da próxima consulta (se houver, via `GET /appointments/my` pegando a mais próxima futura) e 3 atalhos (Serviços, Minhas Consultas, Notificações) além do logout já existente.

## 9. Navegação (`go_router`)

Novas rotas dentro do `ShellRoute` autenticado (paralelo ao existente): `/home` (dashboard), `/services`, `/booking/date`, `/booking/slots`, `/booking/confirm`, `/appointments`, `/notifications`. `BottomNavigationBar` com 3 abas: Início, Consultas, Notificações (Serviços acessado a partir do Início, não é aba — é o ponto de entrada do agendamento).

## Testes

Backend: TDD nos use cases alterados/novos (Jest), seguindo padrão dos módulos existentes. Mobile: bloc_test pros blocs novos, widget tests pras telas seguindo padrão de `phone_screen_test.dart`/`otp_screen_test.dart` (mock do bloc, verifica dispatch de evento e render de estado).

## Ordem de implementação (planos separados)

1. Backend: auto-assign de barbeiro + slots agregados.
2. Backend: `customer_id` em appointments + `GET /appointments/my` + cancel pelo dono.
3. Backend: `GET /notifications/my`.
4. Mobile: catálogo + agendamento (consome 1+2).
5. Mobile: minhas consultas (consome 2).
6. Mobile: notificações + dashboard home + navegação/bottom nav (consome 3, finaliza integração).
