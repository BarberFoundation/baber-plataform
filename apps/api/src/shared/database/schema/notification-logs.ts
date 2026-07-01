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
