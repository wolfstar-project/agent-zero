import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { user } from './auth.js';
import { timestampColumns } from './columns.js';

/**
 * Tables the Better Auth organization plugin owns.
 *
 * Kept in their own file because the plugin is optional policy (`AUTH_ENABLE_ORGANIZATIONS`): a
 * deployment that never turns organizations on still migrates these tables, but nothing writes to
 * them. The same column-naming constraint as `auth.ts` applies.
 */

export const organization = pgTable(
  'organization',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logo: text('logo'),
    // Better Auth stores this as a JSON-encoded string, not as a jsonb column.
    metadata: text('metadata'),
    ...timestampColumns,
  },
  // The slug addresses an organization in URLs, so collisions have to be rejected by the database
  // rather than by whichever request happened to check first.
  (table) => [uniqueIndex('organization_slug_unique').on(table.slug)],
);

export const member = pgTable(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      // A deleted account must not keep conferring access to an organization.
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    ...timestampColumns,
  },
  (table) => [
    // One membership per user per organization: a duplicate row would make role changes
    // order-dependent and could silently re-grant a revoked role.
    uniqueIndex('member_organization_user_unique').on(table.organizationId, table.userId),
    index('member_user_id_idx').on(table.userId),
  ],
);

export const invitation = pgTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestampColumns,
  },
  (table) => [
    index('invitation_organization_id_idx').on(table.organizationId),
    // Accepting an invitation is a lookup by email; without this it degrades to a scan as the
    // table accumulates expired rows.
    index('invitation_email_idx').on(table.email),
  ],
);
