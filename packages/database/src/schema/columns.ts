import { timestamp } from 'drizzle-orm/pg-core';

/**
 * Row bookkeeping every table carries.
 *
 * Declared once so a new table cannot quietly acquire a different timezone handling or default
 * than the rest of the store; `withTimezone` keeps a session expiry comparable across deployments
 * that do not share a server timezone.
 */
export const timestampColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
