# Notifications My-Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Do NOT add `Co-Authored-By` trailers to any commit message.
>
> **Depends on:** `docs/superpowers/plans/2026-07-07-scheduling-my-appointments.md` (needs `appointments.customer_id`).

**Goal:** Add `GET /notifications/my` so a logged-in customer can read the history of WhatsApp notifications (confirmation/cancellation/reminder) sent about their own appointments.

**Architecture:** `notification_logs` has no `customerId`/`userId` column — only `appointmentId` and `phone`. Rather than adding a redundant column, join through `appointments.customer_id` (added in the previous plan). New `ListMyNotificationsUseCase` + a repository method that joins the two tables. First HTTP controller for this module (`notifications.module.ts` currently exports no controller).

**Tech Stack:** NestJS 11, TypeScript strict, Drizzle ORM + postgres-js, Jest.

**Repo:** `C:\Users\gabry\Documents\baber` (`apps/api`).

**Design ref:** `docs/superpowers/specs/2026-07-07-mobile-app-full-design.md` §3.

---

## Task 1: `INotificationRepository.findByCustomer`

**Files:**
- Modify: `apps/api/src/modules/notifications/domain/repositories/notification.repository.ts`
- Modify: `apps/api/src/modules/notifications/infra/repositories/notification-drizzle.repository.ts`
- Test: `apps/api/src/modules/notifications/infra/repositories/notification-drizzle.repository.spec.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `notification-drizzle.repository.spec.ts`:

```ts
import { NotificationDrizzleRepository } from './notification-drizzle.repository';

function makeDb(rows: any[]) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue(rows),
  };
  return chain as any;
}

describe('NotificationDrizzleRepository.findByCustomer', () => {
  it('returns rows shaped as NotificationLog reconstitution props', async () => {
    const rows = [{
      id: 'log-1', tenantId: 'tenant-1', appointmentId: 'appt-1', type: 'CONFIRMATION',
      phone: '+5511999999999', message: 'Confirmado!', status: 'SENT',
      sentAt: new Date('2026-01-01'), error: null, createdAt: new Date('2026-01-01'),
    }];
    const db = makeDb(rows);
    const repo = new NotificationDrizzleRepository(db);
    const result = await repo.findByCustomer('user-1', 'tenant-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('log-1');
    expect(result[0].status).toBe('SENT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/notifications/infra/repositories/notification-drizzle.repository.spec.ts`
Expected: FAIL — `findByCustomer` is not a function.

- [ ] **Step 3: Add the method to the port**

In `notification.repository.ts`, replace the full contents:

```ts
import { NotificationLog } from '../entities/notification-log.entity';

export const NOTIFICATION_REPOSITORY = Symbol('INotificationRepository');

export interface INotificationRepository {
  save(log: NotificationLog): Promise<NotificationLog>;
  findByCustomer(customerId: string, tenantId: string): Promise<NotificationLog[]>;
}
```

- [ ] **Step 4: Implement in the Drizzle repository**

In `notification-drizzle.repository.ts`, add the import and method:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';
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

  async findByCustomer(customerId: string, tenantId: string): Promise<NotificationLog[]> {
    const rows = await this.db
      .select({
        id:            schema.notificationLogs.id,
        tenantId:      schema.notificationLogs.tenantId,
        appointmentId: schema.notificationLogs.appointmentId,
        type:          schema.notificationLogs.type,
        phone:         schema.notificationLogs.phone,
        message:       schema.notificationLogs.message,
        status:        schema.notificationLogs.status,
        sentAt:        schema.notificationLogs.sentAt,
        error:         schema.notificationLogs.error,
        createdAt:     schema.notificationLogs.createdAt,
      })
      .from(schema.notificationLogs)
      .innerJoin(schema.appointments, eq(schema.appointments.id, schema.notificationLogs.appointmentId))
      .where(and(
        eq(schema.appointments.customerId, customerId),
        eq(schema.notificationLogs.tenantId, tenantId),
      ))
      .orderBy(desc(schema.notificationLogs.createdAt));

    return rows.map((r) =>
      NotificationLog.reconstitute({
        id:            r.id,
        tenantId:      r.tenantId,
        appointmentId: r.appointmentId,
        type:          r.type as NotificationType,
        phone:         r.phone,
        message:       r.message,
        status:        r.status as NotificationStatus,
        sentAt:        r.sentAt,
        error:         r.error,
        createdAt:     r.createdAt,
      }),
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/notifications/infra/repositories/notification-drizzle.repository.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/notifications/domain/repositories/notification.repository.ts apps/api/src/modules/notifications/infra/repositories/notification-drizzle.repository.ts apps/api/src/modules/notifications/infra/repositories/notification-drizzle.repository.spec.ts
git commit -m "feat(notifications): add findByCustomer joining notification_logs to appointments"
```

---

## Task 2: `ListMyNotificationsUseCase`

**Files:**
- Create: `apps/api/src/modules/notifications/application/use-cases/list-my-notifications.use-case.ts`
- Test: `apps/api/src/modules/notifications/application/use-cases/list-my-notifications.use-case.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `list-my-notifications.use-case.spec.ts`:

```ts
import { ListMyNotificationsUseCase } from './list-my-notifications.use-case';
import { INotificationRepository } from '../../domain/repositories/notification.repository';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

describe('ListMyNotificationsUseCase', () => {
  it('delegates to repo.findByCustomer', async () => {
    const log = NotificationLog.reconstitute({
      id: 'log-1', tenantId: 'tenant-1', appointmentId: 'appt-1', type: 'CONFIRMATION',
      phone: '+55', message: 'Confirmado!', status: 'SENT', sentAt: new Date(), error: null, createdAt: new Date(),
    });
    const repo: INotificationRepository = {
      save: jest.fn(),
      findByCustomer: jest.fn().mockResolvedValue([log]),
    };
    const uc = new ListMyNotificationsUseCase(repo);
    const result = await uc.execute({ tenantId: 'tenant-1', customerId: 'user-1' });
    expect(repo.findByCustomer).toHaveBeenCalledWith('user-1', 'tenant-1');
    expect(result).toEqual([log]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest apps/api/src/modules/notifications/application/use-cases/list-my-notifications.use-case.spec.ts`
Expected: FAIL — file doesn't exist yet.

- [ ] **Step 3: Implement**

Create `list-my-notifications.use-case.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY, INotificationRepository } from '../../domain/repositories/notification.repository';
import { NotificationLog } from '../../domain/entities/notification-log.entity';

export interface ListMyNotificationsInput {
  tenantId: string;
  customerId: string;
}

@Injectable()
export class ListMyNotificationsUseCase {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly repo: INotificationRepository) {}

  async execute(input: ListMyNotificationsInput): Promise<NotificationLog[]> {
    return this.repo.findByCustomer(input.customerId, input.tenantId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest apps/api/src/modules/notifications/application/use-cases/list-my-notifications.use-case.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/application/use-cases/list-my-notifications.use-case.ts apps/api/src/modules/notifications/application/use-cases/list-my-notifications.use-case.spec.ts
git commit -m "feat(notifications): add ListMyNotificationsUseCase"
```

---

## Task 3: `NotificationsController` + `GET /notifications/my`

**Files:**
- Create: `apps/api/src/modules/notifications/http/notifications.controller.ts`
- Modify: `apps/api/src/modules/notifications/notifications.module.ts`

- [ ] **Step 1: Implement the controller**

Create `apps/api/src/modules/notifications/http/notifications.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@shared/auth/current-user.decorator';
import { JwtPayload } from '@shared/auth/jwt-token.service';
import { Roles } from '@shared/auth/roles.decorator';
import { ListMyNotificationsUseCase } from '../application/use-cases/list-my-notifications.use-case';
import { NotificationLog } from '../domain/entities/notification-log.entity';

function serializeNotification(n: NotificationLog) {
  return {
    id:            n.id,
    appointmentId: n.appointmentId,
    type:          n.type,
    message:       n.message,
    status:        n.status,
    sentAt:        n.sentAt,
    createdAt:     n.createdAt,
  };
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly listMyNotifications: ListMyNotificationsUseCase) {}

  @Roles('CLIENT')
  @Get('my')
  async myNotifications(@CurrentUser() user: JwtPayload) {
    const logs = await this.listMyNotifications.execute({ tenantId: user.tenantId, customerId: user.userId });
    return logs.map(serializeNotification);
  }
}
```

Note: `id`/`tenantId`/`phone` are intentionally omitted from the serialized response — `phone` is the customer's own number (no new info) and `tenantId` isn't needed client-side.

- [ ] **Step 2: Wire the controller and use case into the module**

Replace the full contents of `notifications.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@shared/database/database.module';
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository';
import { DUE_REMINDER_QUERY }      from './domain/repositories/due-reminder.query';
import { WHATSAPP_GATEWAY }        from './domain/ports/whatsapp-gateway.port';

import { NotificationDrizzleRepository } from './infra/repositories/notification-drizzle.repository';
import { DueReminderDrizzleRepository }  from './infra/repositories/due-reminder-drizzle.repository';
import { EvolutionApiWhatsAppGateway }   from './infra/gateways/evolution-api-whatsapp.gateway';
import { StubWhatsAppGateway }           from './infra/gateways/stub-whatsapp.gateway';
import { AppointmentBookedListener }     from './infra/listeners/appointment-booked.listener';
import { AppointmentConfirmedListener }  from './infra/listeners/appointment-confirmed.listener';
import { AppointmentCancelledListener }  from './infra/listeners/appointment-cancelled.listener';
import { ReminderScheduler }             from './infra/schedulers/reminder.scheduler';

import { NotificationsController } from './http/notifications.controller';

import { SendConfirmationNotificationUseCase } from './application/use-cases/send-confirmation-notification.use-case';
import { SendCancellationNotificationUseCase } from './application/use-cases/send-cancellation-notification.use-case';
import { SendReminderNotificationUseCase }     from './application/use-cases/send-reminder-notification.use-case';
import { ListMyNotificationsUseCase }          from './application/use-cases/list-my-notifications.use-case';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationDrizzleRepository },
    { provide: DUE_REMINDER_QUERY,      useClass: DueReminderDrizzleRepository },
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
    ListMyNotificationsUseCase,
    AppointmentBookedListener,
    AppointmentConfirmedListener,
    AppointmentCancelledListener,
    ReminderScheduler,
  ],
  exports: [WHATSAPP_GATEWAY],
})
export class NotificationsModule {}
```

- [ ] **Step 3: Run the full notifications suite + typecheck**

Run: `npx jest apps/api/src/modules/notifications`
Expected: PASS, no regressions.

Run: `cd apps/api && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notifications/http/notifications.controller.ts apps/api/src/modules/notifications/notifications.module.ts
git commit -m "feat(notifications): add GET /notifications/my endpoint"
```

---

## Task 4: Manual smoke check

- [ ] **Step 1: Run the full backend test suite**

Run: `cd apps/api && npm test`
Expected: PASS, no regressions in other modules.

- [ ] **Step 2: Note results**

Report the actual test output — don't claim success unless the run was observed green.
