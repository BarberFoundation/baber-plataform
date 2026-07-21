import { pgTable, uuid, text, integer, boolean, jsonb, date, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';

export const subscriptionTierNameEnum = pgEnum('subscription_tier_name', ['ESSENCIAL', 'JOGADOR', 'LENDARIO']);
export const clubSubscriptionStatusEnum = pgEnum('club_subscription_status', ['ACTIVE', 'PAST_DUE', 'CANCELED']);

export const subscriptionTiers = pgTable(
  'subscription_tiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    tier: subscriptionTierNameEnum('tier').notNull(),
    services: jsonb('services').$type<{ serviceId: string; quantity: number }[]>().notNull().default([]),
    discountPercentage: integer('discount_percentage').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('subscription_tiers_tenant_tier_unique').on(t.tenantId, t.tier),
  ],
);

export const clubSubscriptions = pgTable(
  'club_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => subscriptionTiers.id),
    status: clubSubscriptionStatusEnum('status').notNull().default('ACTIVE'),
    asaasCustomerId: text('asaas_customer_id').notNull(),
    asaasSubscriptionId: text('asaas_subscription_id').notNull(),
    currentCycleStart: date('current_cycle_start').notNull(),
    currentCycleEnd: date('current_cycle_end').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('club_subscriptions_tenant_client_unique').on(t.tenantId, t.clientId),
  ],
);

export const clubSubscriptionQuotas = pgTable(
  'club_subscription_quotas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => clubSubscriptions.id),
    serviceId: uuid('service_id').notNull(),
    quantityTotal: integer('quantity_total').notNull(),
    quantityConsumed: integer('quantity_consumed').notNull().default(0),
  },
  (t) => [
    unique('club_subscription_quotas_subscription_service_unique').on(t.subscriptionId, t.serviceId),
  ],
);

export type SubscriptionTierRow = typeof subscriptionTiers.$inferSelect;
export type NewSubscriptionTierRow = typeof subscriptionTiers.$inferInsert;
export type ClubSubscriptionRow = typeof clubSubscriptions.$inferSelect;
export type NewClubSubscriptionRow = typeof clubSubscriptions.$inferInsert;
export type ClubSubscriptionQuotaRow = typeof clubSubscriptionQuotas.$inferSelect;
export type NewClubSubscriptionQuotaRow = typeof clubSubscriptionQuotas.$inferInsert;
