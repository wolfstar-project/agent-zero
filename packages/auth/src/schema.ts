import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Better Auth's core schema, declared in Drizzle so the session store is owned by this repository
 * rather than generated behind the library's own migration tool.
 *
 * Column names must match what Better Auth queries: the adapter maps model fields by name, so
 * renaming anything here silently breaks sign-in rather than failing at build time.
 */

const timestampColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    ...timestampColumns,
  },
  (table) => [uniqueIndex('user_email_unique').on(table.email)],
);

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      // Signing out a deleted account must not leave a usable session behind.
      .references(() => user.id, { onDelete: 'cascade' }),
    // Which organization the session is currently acting in. Written by the organization plugin
    // when the user switches context; null means no organization is selected.
    activeOrganizationId: text('active_organization_id'),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex('session_token_unique').on(table.token),
    index('session_user_id_idx').on(table.userId),
  ],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    ...timestampColumns,
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestampColumns,
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

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

/** The object shape the Better Auth Drizzle adapter resolves models against. */
export const schema = { user, session, account, verification, organization, member, invitation };
