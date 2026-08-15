import { account, session, user, verification } from './auth.js';
import { invitation, member, organization } from './organization.js';

export { account, session, user, verification } from './auth.js';
export { timestampColumns } from './columns.js';
export { invitation, member, organization } from './organization.js';

/**
 * Every table in the store, as one object.
 *
 * This is the shape Drizzle resolves relational queries against and the shape the Better Auth
 * Drizzle adapter resolves models against, so a table that is not listed here exists in SQL but
 * is invisible to both.
 */
export const schema = { user, session, account, verification, organization, member, invitation };

/** The set of tables the database client is opened with. */
export type Schema = typeof schema;
