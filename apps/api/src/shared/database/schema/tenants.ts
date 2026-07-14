import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { WorkSchedule, defaultWorkSchedule } from '../../../modules/team/domain/value-objects/work-schedule';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  phone: text('phone'),
  address: text('address'),
  timezone: text('timezone').notNull().default('America/Sao_Paulo'),
  logoUrl: text('logo_url'),
  businessHours: jsonb('business_hours').notNull().$type<WorkSchedule>().default(defaultWorkSchedule()),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
