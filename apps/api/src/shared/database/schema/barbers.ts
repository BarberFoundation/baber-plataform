import { pgTable, uuid, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { WorkSchedule } from '../../../modules/team/domain/value-objects/work-schedule';

export const barbers = pgTable('barbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: text('name').notNull(),
  phone: text('phone'),
  isActive: boolean('is_active').notNull().default(true),
  workSchedule: jsonb('work_schedule').notNull().$type<WorkSchedule>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BarberRow = typeof barbers.$inferSelect;
export type NewBarberRow = typeof barbers.$inferInsert;
