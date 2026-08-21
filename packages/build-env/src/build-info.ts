import {
  type DeploymentMetadata,
  deploymentMetadataFromEnvironment,
  envTypeFromMetadata,
  envTypeOverrideFromEnvironment,
  previewUrlFromMetadata,
  productionUrlFromMetadata,
} from './environment.js';
import { type BuildInfo, type EnvironmentRecord, unknownRevision } from './types.js';

/** Seven characters is what `git rev-parse --short` and every provider's UI abbreviate to. */
const shortCommitLength = 7;

/** Abbreviates a commit SHA, passing the unresolved sentinel through unchanged. */
export function shortenCommit(commit: string): string {
  return commit === unknownRevision ? unknownRevision : commit.slice(0, shortCommitLength);
}

/** Whether a revision field is still carrying the sentinel rather than a resolved value. */
function isUnresolved(value: string): boolean {
  return value === unknownRevision;
}

/**
 * Normalises a nullable field back to `null` when it is empty.
 *
 * Nuxt rewrites every `null` in `runtimeConfig` to `''` so each key stays overridable through its
 * `NUXT_PUBLIC_*` variable, which means the three nullable fields arrive here as empty strings
 * rather than as the `null` the build published. Without this they would read as resolved, and the
 * run-time pass would decline to fill exactly the fields it exists to fill.
 */
function nullable(value: string | null): string | null {
  return value?.trim() ? value : null;
}

/**
 * Completes build metadata from the environment the bundle is *running* in.
 *
 * This is the fallback for every deployment that is not Vercel. On Vercel the build itself runs
 * with `VERCEL_GIT_COMMIT_SHA` and the rest in scope, so the values are already baked in and this
 * pass is a no-op that resolves to the same answers. A container image built in CI and started
 * somewhere else has none of them at build time: the fields arrive at boot instead, from whatever
 * the host exposes, or from the `AGENT_ZERO_BUILD_*` variables an operator sets on the process.
 *
 * A field the build resolved is never overwritten. The commit a bundle was compiled from is a
 * property of the bundle, not of the machine it happens to be running on, and letting a run-time
 * variable rewrite it would make the metadata describe a different build than the one serving the
 * request.
 */
export function runtimeBuildInfo(
  buildInfo: BuildInfo,
  environment: EnvironmentRecord,
  options: { readonly defaultBranch?: string } = {},
): BuildInfo {
  const metadata = deploymentMetadataFromEnvironment(environment);

  const commit = isUnresolved(buildInfo.commit)
    ? (metadata.commit ?? unknownRevision)
    : buildInfo.commit;
  const branch = isUnresolved(buildInfo.branch)
    ? (metadata.branch ?? unknownRevision)
    : buildInfo.branch;
  const prNumber = nullable(buildInfo.prNumber) ?? metadata.prNumber;

  const env = runtimeEnvType(
    buildInfo,
    environment,
    { ...metadata, branch: isUnresolved(branch) ? null : branch, prNumber },
    options.defaultBranch,
  );

  return {
    ...buildInfo,
    commit,
    // Re-derived rather than carried over: a build that resolved neither field publishes both
    // sentinels, and the run-time commit is what the short form has to abbreviate.
    shortCommit: isUnresolved(buildInfo.shortCommit)
      ? shortenCommit(commit)
      : buildInfo.shortCommit,
    branch,
    env,
    prNumber,
    previewUrl: nullable(buildInfo.previewUrl) ?? previewUrlFromMetadata(metadata, env),
    productionUrl: nullable(buildInfo.productionUrl) ?? productionUrlFromMetadata(metadata, env),
  };
}

/**
 * Which deployment the running bundle is, given what the build decided and what the host says.
 *
 * `dev` is never revised: a bundle built by `nuxt dev` is a developer's own machine whatever
 * variables happen to be in its shell. Otherwise a host that reports a production-versus-preview
 * context is authoritative, because it is the only party that knows which domain is answering —
 * and on Vercel it reports at run time exactly what it reported at build time, so the pass is
 * idempotent rather than a second, divergent opinion.
 */
function runtimeEnvType(
  buildInfo: BuildInfo,
  environment: EnvironmentRecord,
  metadata: DeploymentMetadata,
  defaultBranch: string | undefined,
): BuildInfo['env'] {
  const override = envTypeOverrideFromEnvironment(environment);
  if (override) return override;
  if (buildInfo.env === 'dev') return 'dev';
  if (metadata.context === null) return buildInfo.env;
  return envTypeFromMetadata(metadata, {
    isDevelopment: false,
    ...(defaultBranch === undefined ? {} : { defaultBranch }),
  });
}
