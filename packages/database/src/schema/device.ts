import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { user } from './auth.js';
import { timestampColumns } from './columns.js';

/**
 * The table Better Auth's device-authorization plugin owns (RFC 8628).
 *
 * Kept in its own file for the same reason `enrollment.ts` is: the plugin is optional policy
 * (`AUTH_ENABLE_DEVICE_AUTHORIZATION`), so a deployment that never turns the device flow on still
 * migrates this table but never writes to it. The same column-naming constraint as `auth.ts`
 * applies — the adapter maps model fields by name, so a rename here breaks the flow silently
 * rather than at build time.
 *
 * Rows are short-lived by design: the plugin deletes a record as soon as it is redeemed, denied,
 * or found expired, so this is a pending-authorization queue rather than an audit log.
 */
export const deviceCode = pgTable(
  'device_code',
  {
    id: text('id').primaryKey(),
    /**
     * The secret the device polls with. Never shown to the human approving the request — they see
     * {@link userCode} instead — which is what keeps a shoulder-surfed screen from yielding a
     * token.
     */
    deviceCode: text('device_code').notNull(),
    /** The short code the device displays for a human to type into the verification page. */
    userCode: text('user_code').notNull(),
    /**
     * Set only once someone approves the request; null while it is pending or denied.
     *
     * Cascades: a deleted account must not leave behind an approved code that would still mint a
     * session for it on the next poll.
     */
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** `pending`, `approved`, or `denied`. */
    status: text('status').notNull().default('pending'),
    /** When the device last polled, against which `pollingInterval` enforces `slow_down`. */
    lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
    /** Minimum milliseconds between polls, captured per request so a policy change cannot shorten it. */
    pollingInterval: integer('polling_interval'),
    /** Which client requested authorization, echoed back for the approval page to name. */
    clientId: text('client_id'),
    scope: text('scope'),
    ...timestampColumns,
  },
  (table) => [
    // Both codes are looked up as the sole identifier of a request — the device polls by
    // `device_code`, the human's verification page resolves by `user_code` — and neither may ever
    // match two rows: that uniqueness is what makes redemption a single guarded write.
    uniqueIndex('device_code_device_code_unique').on(table.deviceCode),
    uniqueIndex('device_code_user_code_unique').on(table.userCode),
    index('device_code_user_id_idx').on(table.userId),
    index('device_code_expires_at_idx').on(table.expiresAt),
  ],
);
