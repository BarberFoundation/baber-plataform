import { pgTable, uuid, text, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const roleEnum = pgEnum('role', ['CLIENT', 'BARBER', 'ADMIN']);

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
    firebaseUid: text('firebase_uid').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // NULL values are not considered equal in PG unique indexes, so multiple
    // users per tenant can have phone=NULL or email=NULL — intentional: CLIENT
    // users log in via OTP (phone optional at creation) and ADMIN via Firebase.
    unique('users_tenant_phone_unique').on(t.tenantId, t.phone),
    unique('users_tenant_email_unique').on(t.tenantId, t.email),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
