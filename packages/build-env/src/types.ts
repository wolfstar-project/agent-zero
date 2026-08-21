/**
 * Which deployment of the project a running bundle is: the four names every surface that shows
 * build metadata switches on.
 *
 * `canary` is the default branch deployed outside a pull request but not yet promoted to the
 * production domain; `preview` is any other non-production deploy (a pull request, a branch
 * deploy); `release` is production; `dev` is a developer's own machine.
 */
export type EnvType = 'dev' | 'preview' | 'canary' | 'release';

/**
 * The build metadata a deployment publishes about itself.
 *
 * Every field is always present, and an unresolved one carries a sentinel rather than being
 * omitted: the values travel through `runtimeConfig.public.buildInfo`, whose per-key environment
 * overrides (`NUXT_PUBLIC_BUILD_INFO_*`) only apply to keys the build actually declared.
 */
export interface BuildInfo {
  /** The deployed package's own version, read from its `package.json` at build time. */
  version: string;
  /** Full commit SHA, or {@link unknownRevision} when neither the host nor git could name one. */
  commit: string;
  /** First seven characters of {@link BuildInfo.commit}, or {@link unknownRevision}. */
  shortCommit: string;
  /** Git branch, or {@link unknownRevision}. */
  branch: string;
  /** Which deployment this is. */
  env: EnvType;
  /** Build timestamp in milliseconds since the epoch. */
  time: number;
  /** Pull request number when this is a pull-request deploy, `null` otherwise. */
  prNumber: string | null;
  /** URL of this specific deploy, only when it is not the production one. */
  previewUrl: string | null;
  /** URL of the production domain, only when this deploy serves it. */
  productionUrl: string | null;
}

/**
 * What an unresolved revision field carries.
 *
 * A sentinel rather than `null` because these three are rendered as text wherever build metadata
 * is shown, and because it is what {@link runtimeBuildInfo} tests to decide which fields a
 * non-Vercel deployment is still allowed to fill in at run time.
 */
export const unknownRevision = 'unknown';

/** A read-only view of an environment, so resolvers never reach for `process.env` themselves. */
export type EnvironmentRecord = Readonly<Record<string, string | undefined>>;
