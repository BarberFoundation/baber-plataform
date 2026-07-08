import { pgTable, pgEnum, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { barbers } from './barbers';
import { services } from './services';
import { users } from './users';

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
]);

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  barberId: uuid('barber_id').notNull().references(() => barbers.id),
  serviceId: uuid('service_id').notNull().references(() => services.id),
  customerId: uuid('customer_id').references(() => users.id),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  status: appointmentStatusEnum('status').notNull().default('PENDING'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AppointmentRow = typeof appointments.$inferSelect;
export type NewAppointmentRow = typeof appointments.$inferInsert;
