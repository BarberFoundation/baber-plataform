import { pgTable, uuid, integer, boolean, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const stampCardConfigs = pgTable(
  'stamp_card_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    eligibleServiceIds: jsonb('eligible_service_ids').$type<string[]>().notNull().default([]),
    stampsRequired: integer('stamps_required').notNull(),
    creditValueInCents: integer('credit_value_in_cents').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('stamp_card_configs_tenant_unique').on(t.tenantId),
  ],
);

export const stampCards = pgTable(
  'stamp_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id),
    currentStamps: integer('current_stamps').notNull().default(0),
    creditBalanceInCents: integer('credit_balance_in_cents').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('stamp_cards_tenant_client_unique').on(t.tenantId, t.clientId),
  ],
);

export type StampCardConfigRow = typeof stampCardConfigs.$inferSelect;
export type NewStampCardConfigRow = typeof stampCardConfigs.$inferInsert;
export type StampCardRow = typeof stampCards.$inferSelect;
export type NewStampCardRow = typeof stampCards.$inferInsert;
