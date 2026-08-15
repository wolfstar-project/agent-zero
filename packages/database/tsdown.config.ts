import { definePackageConfig } from '../../scripts/tsdown.config.ts';

/**
 * One entry point: the tables and the client are always used together, and a consumer that only
 * needs a column name still resolves it against the same declarations the pool was opened with.
 */
export default definePackageConfig();
