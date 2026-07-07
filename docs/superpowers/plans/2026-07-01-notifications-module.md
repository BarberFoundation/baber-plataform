# Notifications Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Do NOT add `Co-Authored-By` trailers to any commit message.

**Goal:** Build the Notifications bounded context — WhatsApp messages (confirmation, cancellation, reminder) triggered by Scheduling domain events, with BullMQ delayed-job reminders and an Evolution API adapter.

**Architecture:**
- `EventEmitter2` in-process events published from Scheduling use cases after successful saves.
- `NotificationsModule` listeners consume events → call application use cases.
- Reminder uses BullMQ delayed job (fires ~24h before appointment).
- `IWhatsAppGateway` port with two impls: `EvolutionApiWhatsAppGateway` (production) + `StubWhatsAppGateway` (development — logs only, selected when `EVOLUTION_API_URL` is absent).
- `notification_logs` table persists every send attempt.
- No HTTP routes — purely event-driven.

**Tech Stack:** NestJS 11, TypeScript strict, `@nestjs/event-emitter` (EventEmitter2), `@nestjs/bullmq`, Drizzle ORM + postgres-js, `axios` or native `fetch`.

---

## Task Index

| # | Task | Layer |
|---|------|-------|
| N1 | Shared event payload types + emit events from Scheduling use cases | Shared / Application |
| N2 | Notification domain (`NotificationLog` entity, status, errors, `INotificationRepository`, `IWhatsAppGateway` port) | Domain |
| N3 | DB schema `notification_logs` | Infra |
| N4 | Application use cases: `SendConfirmationNotification`, `SendCancellationNotification`, `SendReminderNotification` | Application |
| N5 | Infra: `NotificationDrizzleRepository`, `EvolutionApiWhatsAppGateway`, `StubWhatsAppGateway` | Infra |
| N6 | Event listeners + BullMQ processor + reminder queue | Infra |
| N7 | Wire `NotificationsModule` | Module |

---

## Task N1 — Shared event payload types + emit from Scheduling use cases

**Files to create:**
- `apps/api/src/shared/events/appointment-events.ts`

**Files to modify:**
- `apps/api/src/modules/scheduling/application/use-cases/book-appointment.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/confirm-appointment.use-case.ts`
- `apps/api/src/modules/scheduling/application/use-cases/cancel-appointment.use-case.ts`

### Step-by-step

- [ ] Create `apps/api/src/shared/events/appointment-events.ts`:

```typescript
export const APPOINTMENT_EVENTS = {
  BOOKED:    'appointment.booked',
  CONFIRMED: 'appointment.confirmed',
  CANCELLED: 'appointment.cancelled',
} as const;

export interface AppointmentEventPayload {
  appointmentId: string;
  tenantId:      string;
  clientName:    string;
  clientPhone:   string;
  barberId:      string;
  serviceId:     string;
  date:          string;   // YYYY-MM-DD
  startTime:     string;   // HH:mm
  endTime:       string;   // HH:mm
}
```

- [ ] Modify `book-appointment.use-case.ts` — inject `EventEmitter2` and emit after save:

Add import:
```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
```

Add to constructor (after existing injects):
```typescript
@Inject(EventEmitter2) private readonly emitter: EventEmitter2,
```

Add after `return this.repo.save(appointment)`:
```typescript
// replace the return with:
const saved = await this.repo.save(appointment);
const payload: AppointmentEventPayload = {
  appointmentId: saved.id,
  tenantId:      saved.tenantId,
  clientName:    saved.clientName,
  clientPhone:   saved.clientPhone,
  barberId:      saved.barberId,
  serviceId:     saved.serviceId,
  date:          saved.date,
  startTime:     saved.startTime,
  endTime:       saved.endTime,
};
this.emitter.emit(APPOINTMENT_EVENTS.BOOKED, payload);
return saved;
```

- [ ] Modify `confirm-appointment.use-case.ts` — inject `EventEmitter2` and emit after save:

Add import:
```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
```

Add to constructor:
```typescript
@Inject(EventEmitter2) private readonly emitter: EventEmitter2,
```

Replace `return this.repo.save(appt)` with:
```typescript
const saved = await this.repo.save(appt);
const payload: AppointmentEventPayload = {
  appointmentId: saved.id,
  tenantId:      saved.tenantId,
  clientName:    saved.clientName,
  clientPhone:   saved.clientPhone,
  barberId:      saved.barberId,
  serviceId:     saved.serviceId,
  date:          saved.date,
  startTime:     saved.startTime,
  endTime:       saved.endTime,
};
this.emitter.emit(APPOINTMENT_EVENTS.CONFIRMED, payload);
return saved;
```

- [ ] Modify `cancel-appointment.use-case.ts` — same pattern, emit `APPOINTMENT_EVENTS.CANCELLED`.

- [ ] Update existing specs — the use case constructors now have an extra arg. Add a stub emitter to each affected spec:

In `book-appointment.use-case.spec.ts`, `confirm-appointment.use-case.spec.ts`, `cancel-appointment.use-case.spec.ts`:

Add a mock emitter constant and pass it:
```typescript
const MOCK_EMITTER = { emit: jest.fn() } as any;

// update construction:
const uc = new BookAppointmentUseCase(repo, makeBarberLookup(), makeServiceLookup(), MOCK_EMITTER);
```

- [ ] Run all affected specs to verify still green:
```
npx jest --testPathPattern="(book|confirm|cancel)-appointment.use-case.spec" --no-coverage
```
Expected: 5+3+4 = 12 tests pass.

- [ ] Run full suite: `npx jest --no-coverage` — all 110 pass.

- [ ] Commit: `feat(notifications): add appointment event types, emit from Scheduling use cases`

---

## Task N2 — Notification domain

**Files to create:**
- `apps/api/src/modules/notifications/domain/value-objects/notification-type.ts`
- `apps/api/src/modules/notifications/domain/value-objects/notification-status.ts`
- `apps/api/src/modules/notifications/domain/entities/notification-log.entity.ts`
- `apps/api/src/modules/notifications/domain/errors/notification.errors.ts`
- `apps/api/src/modules/notifications/domain/repositories/notification.repository.ts`
- `apps/api/src/modules/notifications/domain/ports/whatsapp-gateway.port.ts`

### Step-by-step

- [ ] Create `notification-type.ts`:

```typescript
export type NotificationType = 'CONFIRMATION' | 'CANCELLATION' | 'REMINDER';
export const NOTIFICATION_TYPES = ['CONFIRMATION', 'CANCELLATION', 'REMINDER'] as const;
```

- [ ] Create `notification-status.ts`:

```typescript
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';
```

- [ ] Create `notification-log.entity.ts`:

```typescript
import { randomUUID } from 'crypto';
import { NotificationType } from '../value-objects/notification-type';
import { NotificationStatus } from '../value-objects/notification-status';

export interface NotificationLogProps {
  id: string;
  tenantId: string;
  appointmentId: string;
  type: NotificationType;
  phone: string;
  message: string;
  status: NotificationStatus;
  sentAt: Date | null;
  error: string | null;
  createdAt: Date;
}

export interface CreateNotificationLogProps {
  tenantId: string;
  appointmentId: string;
  type: NotificationType;
  phone: string;
  message: string;
}

export class NotificationLog {
  readonly id: string;
  readonly tenantId: string;
  readonly appointmentId: string;
  readonly type: NotificationType;
  readonly phone: string;
  readonly message: string;
  private _status: NotificationStatus;
  private _sentAt: Date | null;
  private _error: string | null;
  readonly createdAt: Date;

  private constructor(props: NotificationLogProps) {
    this.id            = props.id;
    this.tenantId      = props.tenantId;
    this.appointmentId = props.appointmentId;
    this.type          = props.type;
    this.phone         = props.phone;
    this.message       = props.message;
    this._status       = props.status;
    this._sentAt       = props.sentAt;
    this._error        = props.error;
    this.createdAt     = props.createdAt;
  }

  get status(): NotificationStatus { return this._status; }
  get sentAt(): Date | null        { return this._sentAt; }
  get error(): string | null       { return this._error; }

  static create(props: CreateNotificationLogProps): NotificationLog {
    return new NotificationLog({
      id:            randomUUID(),
      tenantId:      props.tenantId,
      appointmentId: props.appointmentId,
      type:          props.type,
      phone:         props.phone,
      message:       props.message,
      status:        'PENDING',
      sentAt:        null,
      error:         null,
      createdAt:     new Date(),
    });
  }

  static reconstitute(props: NotificationLogProps): NotificationLog {
    return new NotificationLog(props);
  }

  markSent(): void {
    this._status = 'SENT';
    this._sentAt = new Date();
  }

  markFailed(error: string): void {
    this._status = 'FAILED';
    this._error  = error;
  }
}
```

- [ ] Create `notification.errors.ts`:

```typescript
import { DomainError } from '@shared/kernel/errors/domain-error';

export class NotificationFailedError extends DomainError {
  readonly code = 'NOTIFICATION_FAILED';
  constructor(message = 'Falha ao enviar notificação.') { super(message); }
}
```

- [ ] Create `notification.repository.ts`:

```typescript
import { NotificationLog } from '../entities/notification-log.entity';

export const NOTIFICATION_REPOSITORY = Symbol('INotificationRepository');

export interface INotificationRepository {
  save(log: NotificationLog): Promise<NotificationLog>;
}
```

- [ ] Create `whatsapp-gateway.port.ts`:

```typescript
export const WHATSAPP_GATEWAY = Symbol('IWhatsAppGateway');

export interface IWhatsAppGateway {
  send(to: string, message: string): Promise<void>;
}
```

- [ ] Add `NOTIFICATION_FAILED` to `DomainExceptionFilter`:
Read `apps/api/src/shared/kernel/errors/domain-exception.filter.ts`, add:
```typescript
NOTIFICATION_FAILED: HttpStatus.INTERNAL_SERVER_ERROR,
```

- [ ] Run tsc: `npx tsc --noEmit` from `apps/api` — zero errors.

- [ ] Commit: `feat(notifications): add NotificationLog entity, domain errors, INotificationRepository, IWhatsAppGateway port`

---

## Task N3 — DB schema `notification_logs`

**Files to create:**
- `apps/api/src/shared/database/schema/notification-logs.ts`

**Files to modify:**
- `apps/api/src/shared/database/schema/index.ts`

### Step-by-step

- [ ] Create `notification-logs.ts`:

```typescript
import { pgTable, pgEnum, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { appointments } from './appointments';

export const notificationTypeEnum = pgEnum('notification_type', [
  'CONFIRMATION',
  'CANCELLATION',
  'REMINDER',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'PENDING',
  'SENT',
  'FAILED',
]);

export const notificationLogs = pgTable('notification_logs', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id),
  appointmentId: uuid('appointment_id').notNull().references(() => appointments.id),
  type:          notificationTypeEnum('type').notNull(),
  phone:         text('phone').notNull(),
  message:       text('message').notNull(),
  status:        notificationStatusEnum('status').notNull().default('PENDING'),
  sentAt:        timestamp('sent_at', { withTimezone: true }),
  error:         text('error'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationLogRow = typeof notificationLogs.$inferSelect;
```

- [ ] Add to `index.ts`:
```typescript
export * from './notification-logs';
```

- [ ] Generate and apply migration:
```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
```

- [ ] Run tsc: `npx tsc --noEmit` — zero errors.

- [ ] Commit: `feat(notifications): add notification_logs table schema`

---

## Task N4 — Application use cases

**Files to create:**
- `apps/api/src/modules/notifications/application/use-cases/send-confirmation-notification.use-case.ts`
- `apps/api/src/modules/notifications/application/use-cases/send-confirmation-notification.use-case.spec.ts`
- `apps/api/src/modules/notifications/application/use-cases/send-cancellation-notification.use-case.ts`
- `apps/api/src/modules/notifications/application/use-cases/send-cancellation-notification.use-case.spec.ts`
- `apps/api/src/modules/notifications/application/use-cases/send-reminder-notification.use-case.ts`
- `apps/api/src/modules/notifications/application/use-cases/send-reminder-notification.use-case.spec.ts`

### Step-by-step

- [ ] Create `send-confirmation-notification.use-case.spec.ts` (TDD — red first):

```typescript
import { SendConfirmationNotificationUseCase, SendConfirmationInput } from './send-confirmation-notification.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

function makeRepo(): INotificationRepository {
  return { save: jest.fn().mockImplementation(async (l: NotificationLog) => l) };
}

function makeGateway(fail = false): IWhatsAppGateway {
  return {
    send: fail
      ? jest.fn().mockRejectedValue(new Error('network error'))
      : jest.fn().mockResolvedValue(undefined),
  };
}

const INPUT: SendConfirmationInput = {
  tenantId:      'tenant-1',
  appointmentId: 'appt-1',
  clientName:    'João',
  clientPhone:   '+5511999999999',
  date:          '2025-03-10',
  startTime:     '09:00',
};

describe('SendConfirmationNotificationUseCase', () => {
  it('sends WhatsApp message and saves SENT log', async () => {
    const repo    = makeRepo();
    const gateway = makeGateway();
    const uc      = new SendConfirmationNotificationUseCase(repo, gateway);

    await uc.execute(INPUT);

    expect(gateway.send).toHaveBeenCalledWith(
      INPUT.clientPhone,
      expect.stringContaining(INPUT.clientName),
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SENT' }),
    );
  });

  it('saves FAILED log when gateway throws, does not rethrow', async () => {
    const repo    = makeRepo();
    const gateway = makeGateway(true);
    const uc      = new SendConfirmationNotificationUseCase(repo, gateway);

    await expect(uc.execute(INPUT)).resolves.not.toThrow();

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' }),
    );
  });
});
```

- [ ] Run (expect red): `npx jest --testPathPattern="send-confirmation-notification.use-case.spec" --no-coverage`

- [ ] Create `send-confirmation-notification.use-case.ts` (green):

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../domain/repositories/notification.repository';
import { WHATSAPP_GATEWAY, IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

export interface SendConfirmationInput {
  tenantId:      string;
  appointmentId: string;
  clientName:    string;
  clientPhone:   string;
  date:          string;
  startTime:     string;
}

@Injectable()
export class SendConfirmationNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo:    INotificationRepository,
    @Inject(WHATSAPP_GATEWAY)        private readonly gateway: IWhatsAppGateway,
  ) {}

  async execute(input: SendConfirmationInput): Promise<void> {
    const message = `Olá ${input.clientName}! Seu agendamento foi marcado para ${input.date} às ${input.startTime}. Até logo! 💈`;
    const log = NotificationLog.create({
      tenantId:      input.tenantId,
      appointmentId: input.appointmentId,
      type:          'CONFIRMATION',
      phone:         input.clientPhone,
      message,
    });

    try {
      await this.gateway.send(input.clientPhone, message);
      log.markSent();
    } catch (err) {
      log.markFailed(err instanceof Error ? err.message : String(err));
    }

    await this.repo.save(log);
  }
}
```

- [ ] Run (expect green): `npx jest --testPathPattern="send-confirmation-notification.use-case.spec" --no-coverage`
  Expected: 2 tests pass.

- [ ] Create `send-cancellation-notification.use-case.spec.ts`:

```typescript
import { SendCancellationNotificationUseCase, SendCancellationInput } from './send-cancellation-notification.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

function makeRepo(): INotificationRepository {
  return { save: jest.fn().mockImplementation(async (l: NotificationLog) => l) };
}

function makeGateway(fail = false): IWhatsAppGateway {
  return {
    send: fail
      ? jest.fn().mockRejectedValue(new Error('network error'))
      : jest.fn().mockResolvedValue(undefined),
  };
}

const INPUT: SendCancellationInput = {
  tenantId:      'tenant-1',
  appointmentId: 'appt-1',
  clientName:    'João',
  clientPhone:   '+5511999999999',
  date:          '2025-03-10',
  startTime:     '09:00',
};

describe('SendCancellationNotificationUseCase', () => {
  it('sends WhatsApp cancellation message and saves SENT log', async () => {
    const repo    = makeRepo();
    const gateway = makeGateway();
    const uc      = new SendCancellationNotificationUseCase(repo, gateway);

    await uc.execute(INPUT);

    expect(gateway.send).toHaveBeenCalledWith(
      INPUT.clientPhone,
      expect.stringContaining('cancelado'),
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SENT' }),
    );
  });

  it('saves FAILED log when gateway throws, does not rethrow', async () => {
    const repo    = makeRepo();
    const gateway = makeGateway(true);
    const uc      = new SendCancellationNotificationUseCase(repo, gateway);

    await expect(uc.execute(INPUT)).resolves.not.toThrow();
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' }),
    );
  });
});
```

- [ ] Create `send-cancellation-notification.use-case.ts`:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../domain/repositories/notification.repository';
import { WHATSAPP_GATEWAY, IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

export interface SendCancellationInput {
  tenantId:      string;
  appointmentId: string;
  clientName:    string;
  clientPhone:   string;
  date:          string;
  startTime:     string;
}

@Injectable()
export class SendCancellationNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo:    INotificationRepository,
    @Inject(WHATSAPP_GATEWAY)        private readonly gateway: IWhatsAppGateway,
  ) {}

  async execute(input: SendCancellationInput): Promise<void> {
    const message = `Olá ${input.clientName}! Seu agendamento de ${input.date} às ${input.startTime} foi cancelado.`;
    const log = NotificationLog.create({
      tenantId:      input.tenantId,
      appointmentId: input.appointmentId,
      type:          'CANCELLATION',
      phone:         input.clientPhone,
      message,
    });

    try {
      await this.gateway.send(input.clientPhone, message);
      log.markSent();
    } catch (err) {
      log.markFailed(err instanceof Error ? err.message : String(err));
    }

    await this.repo.save(log);
  }
}
```

- [ ] Run: `npx jest --testPathPattern="send-cancellation-notification.use-case.spec" --no-coverage`
  Expected: 2 tests pass.

- [ ] Create `send-reminder-notification.use-case.spec.ts`:

```typescript
import { SendReminderNotificationUseCase, SendReminderInput } from './send-reminder-notification.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

function makeRepo(): INotificationRepository {
  return { save: jest.fn().mockImplementation(async (l: NotificationLog) => l) };
}

function makeGateway(fail = false): IWhatsAppGateway {
  return {
    send: fail
      ? jest.fn().mockRejectedValue(new Error('network error'))
      : jest.fn().mockResolvedValue(undefined),
  };
}

const INPUT: SendReminderInput = {
  tenantId:      'tenant-1',
  appointmentId: 'appt-1',
  clientName:    'João',
  clientPhone:   '+5511999999999',
  date:          '2025-03-10',
  startTime:     '09:00',
};

describe('SendReminderNotificationUseCase', () => {
  it('sends reminder message and saves SENT log', async () => {
    const repo    = makeRepo();
    const gateway = makeGateway();
    const uc      = new SendReminderNotificationUseCase(repo, gateway);

    await uc.execute(INPUT);

    expect(gateway.send).toHaveBeenCalledWith(
      INPUT.clientPhone,
      expect.stringContaining('lembrete'),
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SENT' }),
    );
  });

  it('saves FAILED log when gateway throws, does not rethrow', async () => {
    const repo    = makeRepo();
    const gateway = makeGateway(true);
    const uc      = new SendReminderNotificationUseCase(repo, gateway);

    await expect(uc.execute(INPUT)).resolves.not.toThrow();
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED' }),
    );
  });
});
```

- [ ] Create `send-reminder-notification.use-case.ts`:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../domain/repositories/notification.repository';
import { WHATSAPP_GATEWAY, IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

export interface SendReminderInput {
  tenantId:      string;
  appointmentId: string;
  clientName:    string;
  clientPhone:   string;
  date:          string;
  startTime:     string;
}

@Injectable()
export class SendReminderNotificationUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repo:    INotificationRepository,
    @Inject(WHATSAPP_GATEWAY)        private readonly gateway: IWhatsAppGateway,
  ) {}

  async execute(input: SendReminderInput): Promise<void> {
    const message = `Olá ${input.clientName}! Lembrete: você tem um agendamento amanhã às ${input.startTime}. Até logo! 💈`;
    const log = NotificationLog.create({
      tenantId:      input.tenantId,
      appointmentId: input.appointmentId,
      type:          'REMINDER',
      phone:         input.clientPhone,
      message,
    });

    try {
      await this.gateway.send(input.clientPhone, message);
      log.markSent();
    } catch (err) {
      log.markFailed(err instanceof Error ? err.message : String(err));
    }

    await this.repo.save(log);
  }
}
```

- [ ] Run all 3 specs: `npx jest --testPathPattern="send-(confirmation|cancellation|reminder)-notification.use-case.spec" --no-coverage`
  Expected: 6 tests pass.

- [ ] Run full suite: `npx jest --no-coverage` — all previous tests still pass.

- [ ] Commit: `feat(notifications): add SendConfirmation, SendCancellation, SendReminder use cases`

---

## Task N5 — Infra: repository + WhatsApp gateway adapters

**Files to create:**
- `apps/api/src/modules/notifications/infra/repositories/notification-drizzle.repository.ts`
- `apps/api/src/modules/notifications/infra/gateways/evolution-api-whatsapp.gateway.ts`
- `apps/api/src/modules/notifications/infra/gateways/stub-whatsapp.gateway.ts`

### Step-by-step

- [ ] Create `notification-drizzle.repository.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE } from '@shared/database/database.tokens';
import * as schema from '@shared/database/schema';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { NotificationLog } from '../../domain/entities/notification-log.entity';
import { NotificationType } from '../../domain/value-objects/notification-type';
import { NotificationStatus } from '../../domain/value-objects/notification-status';

type DB = PostgresJsDatabase<typeof schema>;

@Injectable()
export class NotificationDrizzleRepository implements INotificationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DB) {}

  async save(log: NotificationLog): Promise<NotificationLog> {
    await this.db
      .insert(schema.notificationLogs)
      .values({
        id:            log.id,
        tenantId:      log.tenantId,
        appointmentId: log.appointmentId,
        type:          log.type,
        phone:         log.phone,
        message:       log.message,
        status:        log.status,
        sentAt:        log.sentAt,
        error:         log.error,
        createdAt:     log.createdAt,
      })
      .onConflictDoUpdate({
        target: schema.notificationLogs.id,
        set: {
          status: log.status,
          sentAt: log.sentAt,
          error:  log.error,
        },
      });
    return log;
  }
}
```

- [ ] Create `evolution-api-whatsapp.gateway.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';

@Injectable()
export class EvolutionApiWhatsAppGateway implements IWhatsAppGateway {
  private readonly logger = new Logger(EvolutionApiWhatsAppGateway.name);
  private readonly baseUrl:    string;
  private readonly instance:   string;
  private readonly apiKey:     string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl  = config.getOrThrow<string>('EVOLUTION_API_URL');
    this.instance = config.getOrThrow<string>('EVOLUTION_INSTANCE');
    this.apiKey   = config.getOrThrow<string>('EVOLUTION_API_KEY');
  }

  async send(to: string, message: string): Promise<void> {
    const url = `${this.baseUrl}/message/sendText/${this.instance}`;
    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        this.apiKey,
      },
      body: JSON.stringify({ number: to, text: message }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Evolution API error ${response.status}: ${body}`);
      throw new Error(`WhatsApp send failed: ${response.status}`);
    }

    this.logger.log(`WhatsApp sent to ${to}`);
  }
}
```

- [ ] Create `stub-whatsapp.gateway.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { IWhatsAppGateway } from '../../domain/ports/whatsapp-gateway.port';

@Injectable()
export class StubWhatsAppGateway implements IWhatsAppGateway {
  private readonly logger = new Logger(StubWhatsAppGateway.name);

  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[STUB] WhatsApp → ${to}: ${message}`);
  }
}
```

- [ ] Run tsc: `npx tsc --noEmit` from `apps/api` — zero errors.

- [ ] Commit: `feat(notifications): NotificationDrizzleRepository, EvolutionApiWhatsAppGateway, StubWhatsAppGateway`

---

## Task N6 — Event listeners + BullMQ reminder queue

**Files to create:**
- `apps/api/src/modules/notifications/infra/listeners/appointment-booked.listener.ts`
- `apps/api/src/modules/notifications/infra/listeners/appointment-confirmed.listener.ts`
- `apps/api/src/modules/notifications/infra/listeners/appointment-cancelled.listener.ts`
- `apps/api/src/modules/notifications/infra/queues/reminder.queue.ts`
- `apps/api/src/modules/notifications/infra/processors/reminder.processor.ts`

### Step-by-step

- [ ] Create `reminder.queue.ts`:

```typescript
export const REMINDER_QUEUE = 'reminder';

export interface ReminderJobData {
  tenantId:      string;
  appointmentId: string;
  clientName:    string;
  clientPhone:   string;
  date:          string;
  startTime:     string;
}
```

- [ ] Create `appointment-booked.listener.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { SendConfirmationNotificationUseCase } from '../../application/use-cases/send-confirmation-notification.use-case';
import { REMINDER_QUEUE, ReminderJobData } from '../queues/reminder.queue';
import { timeToMinutes } from '../../../scheduling/domain/utils/time.utils';

@Injectable()
export class AppointmentBookedListener {
  constructor(
    private readonly sendConfirmation: SendConfirmationNotificationUseCase,
    @InjectQueue(REMINDER_QUEUE) private readonly reminderQueue: Queue<ReminderJobData>,
  ) {}

  @OnEvent(APPOINTMENT_EVENTS.BOOKED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    await this.sendConfirmation.execute({
      tenantId:      payload.tenantId,
      appointmentId: payload.appointmentId,
      clientName:    payload.clientName,
      clientPhone:   payload.clientPhone,
      date:          payload.date,
      startTime:     payload.startTime,
    });

    // Schedule reminder 24h before appointment (skip if < 2h away)
    const appointmentMs = new Date(`${payload.date}T${payload.startTime}:00`).getTime();
    const reminderMs    = appointmentMs - 24 * 60 * 60 * 1000;
    const delayMs       = reminderMs - Date.now();

    if (delayMs > 2 * 60 * 60 * 1000) {
      const jobData: ReminderJobData = {
        tenantId:      payload.tenantId,
        appointmentId: payload.appointmentId,
        clientName:    payload.clientName,
        clientPhone:   payload.clientPhone,
        date:          payload.date,
        startTime:     payload.startTime,
      };
      await this.reminderQueue.add('send-reminder', jobData, { delay: delayMs });
    }
  }
}
```

- [ ] Create `appointment-confirmed.listener.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { SendConfirmationNotificationUseCase } from '../../application/use-cases/send-confirmation-notification.use-case';

@Injectable()
export class AppointmentConfirmedListener {
  constructor(private readonly sendConfirmation: SendConfirmationNotificationUseCase) {}

  @OnEvent(APPOINTMENT_EVENTS.CONFIRMED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    await this.sendConfirmation.execute({
      tenantId:      payload.tenantId,
      appointmentId: payload.appointmentId,
      clientName:    payload.clientName,
      clientPhone:   payload.clientPhone,
      date:          payload.date,
      startTime:     payload.startTime,
    });
  }
}
```

- [ ] Create `appointment-cancelled.listener.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APPOINTMENT_EVENTS, AppointmentEventPayload } from '@shared/events/appointment-events';
import { SendCancellationNotificationUseCase } from '../../application/use-cases/send-cancellation-notification.use-case';

@Injectable()
export class AppointmentCancelledListener {
  constructor(private readonly sendCancellation: SendCancellationNotificationUseCase) {}

  @OnEvent(APPOINTMENT_EVENTS.CANCELLED)
  async handle(payload: AppointmentEventPayload): Promise<void> {
    await this.sendCancellation.execute({
      tenantId:      payload.tenantId,
      appointmentId: payload.appointmentId,
      clientName:    payload.clientName,
      clientPhone:   payload.clientPhone,
      date:          payload.date,
      startTime:     payload.startTime,
    });
  }
}
```

- [ ] Create `reminder.processor.ts`:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { REMINDER_QUEUE, ReminderJobData } from '../queues/reminder.queue';
import { SendReminderNotificationUseCase } from '../../application/use-cases/send-reminder-notification.use-case';

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  constructor(private readonly sendReminder: SendReminderNotificationUseCase) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    await this.sendReminder.execute(job.data);
  }
}
```

- [ ] Run tsc: `npx tsc --noEmit` from `apps/api` — zero errors.

- [ ] Run full suite: `npx jest --no-coverage` — all tests pass.

- [ ] Commit: `feat(notifications): event listeners, reminder queue, BullMQ processor`

---

## Task N7 — Wire `NotificationsModule`

**Files to modify:**
- `apps/api/src/modules/notifications/notifications.module.ts`

**Files to check (env):**
- `apps/api/src/shared/config/env.validation.ts` — add optional `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE`, `EVOLUTION_API_KEY`

### Step-by-step

- [ ] Read `apps/api/src/shared/config/env.validation.ts`. Add optional Evolution API env vars:

```typescript
EVOLUTION_API_URL:  z.string().url().optional(),
EVOLUTION_INSTANCE: z.string().optional(),
EVOLUTION_API_KEY:  z.string().optional(),
```

- [ ] Replace `notifications.module.ts` with full wiring:

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '@shared/database/database.module';
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository';
import { WHATSAPP_GATEWAY }        from './domain/ports/whatsapp-gateway.port';

import { NotificationDrizzleRepository }   from './infra/repositories/notification-drizzle.repository';
import { EvolutionApiWhatsAppGateway }     from './infra/gateways/evolution-api-whatsapp.gateway';
import { StubWhatsAppGateway }            from './infra/gateways/stub-whatsapp.gateway';
import { AppointmentBookedListener }      from './infra/listeners/appointment-booked.listener';
import { AppointmentConfirmedListener }   from './infra/listeners/appointment-confirmed.listener';
import { AppointmentCancelledListener }   from './infra/listeners/appointment-cancelled.listener';
import { ReminderProcessor }             from './infra/processors/reminder.processor';
import { REMINDER_QUEUE }               from './infra/queues/reminder.queue';

import { SendConfirmationNotificationUseCase } from './application/use-cases/send-confirmation-notification.use-case';
import { SendCancellationNotificationUseCase } from './application/use-cases/send-cancellation-notification.use-case';
import { SendReminderNotificationUseCase }     from './application/use-cases/send-reminder-notification.use-case';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
  ],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationDrizzleRepository },
    {
      provide:    WHATSAPP_GATEWAY,
      useFactory: (config: ConfigService) =>
        config.get('EVOLUTION_API_URL')
          ? new EvolutionApiWhatsAppGateway(config)
          : new StubWhatsAppGateway(),
      inject: [ConfigService],
    },
    SendConfirmationNotificationUseCase,
    SendCancellationNotificationUseCase,
    SendReminderNotificationUseCase,
    AppointmentBookedListener,
    AppointmentConfirmedListener,
    AppointmentCancelledListener,
    ReminderProcessor,
  ],
})
export class NotificationsModule {}
```

- [ ] Run tsc: `npx tsc --noEmit` from `apps/api` — zero errors.

- [ ] Run full build: `pnpm --filter api build` — success.

- [ ] Run full suite: `npx jest --no-coverage` — all tests pass.

- [ ] Commit: `feat(notifications): wire NotificationsModule`

---

## Environment variables to add to `.env`

```env
# WhatsApp — Evolution API (leave blank in dev to use stub logger)
EVOLUTION_API_URL=
EVOLUTION_INSTANCE=
EVOLUTION_API_KEY=
```

---

## Final directory structure

```
apps/api/src/modules/notifications/
├── domain/
│   ├── entities/
│   │   └── notification-log.entity.ts
│   ├── errors/
│   │   └── notification.errors.ts
│   ├── ports/
│   │   └── whatsapp-gateway.port.ts
│   ├── repositories/
│   │   └── notification.repository.ts
│   └── value-objects/
│       ├── notification-status.ts
│       └── notification-type.ts
├── application/
│   └── use-cases/
│       ├── send-confirmation-notification.use-case.ts + .spec.ts
│       ├── send-cancellation-notification.use-case.ts + .spec.ts
│       └── send-reminder-notification.use-case.ts + .spec.ts
├── infra/
│   ├── gateways/
│   │   ├── evolution-api-whatsapp.gateway.ts
│   │   └── stub-whatsapp.gateway.ts
│   ├── listeners/
│   │   ├── appointment-booked.listener.ts
│   │   ├── appointment-confirmed.listener.ts
│   │   └── appointment-cancelled.listener.ts
│   ├── processors/
│   │   └── reminder.processor.ts
│   ├── queues/
│   │   └── reminder.queue.ts
│   └── repositories/
│       └── notification-drizzle.repository.ts
└── notifications.module.ts

apps/api/src/shared/
├── events/
│   └── appointment-events.ts                    (new)
└── database/schema/
    └── notification-logs.ts                     (new)
```

---

## Self-review checklist

- [x] Events defined as constants in `@shared/events` — no string literals scattered across modules
- [x] All 3 Scheduling use cases emit events after successful save
- [x] Existing specs updated with mock emitter — no test breakage
- [x] Notification use cases: fire-and-forget error handling — gateway failure → FAILED log, never propagates (prevents transaction rollback)
- [x] WhatsApp gateway selected by env var — `EVOLUTION_API_URL` present → real; absent → stub
- [x] BullMQ reminder: only schedules if > 2h in the future (avoids useless jobs for past/imminent appointments)
- [x] `notification_logs` table uses `pgEnum` for type and status
- [x] `NotificationsModule` is already imported in `AppModule` (no change needed)
- [x] No `Co-Authored-By` in any commit
- [x] One commit per task (N1–N7)
