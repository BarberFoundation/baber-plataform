import { pgTable, uuid, text, timestamp, pgEnum, unique, boolean } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const roleEnum = pgEnum('role', ['CLIENT', 'BARBER', 'ADMIN', 'RECEPTIONIST']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name'),
    role: roleEnum('role').notNull(),
    phone: text('phone'),
    email: text('email'),
    cpf: text('cpf'),
    firebaseUid: text('firebase_uid').unique(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // NULL values are not considered equal in PG unique indexes, so multiple
    // users per tenant can have phone=NULL or email=NULL — CLIENT users always
    // have phone (Firebase phone auth), ADMIN users may have phone or email
    // (Firebase phone or email/password auth).
    unique('users_tenant_phone_unique').on(t.tenantId, t.phone),
    unique('users_tenant_email_unique').on(t.tenantId, t.email),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
