import { describe, expect, it } from 'vitest';

import { runtimeBuildInfo, shortenCommit } from './build-info.js';
import { type BuildInfo, unknownRevision } from './types.js';

/** What a build that resolved nothing publishes: every revision field carries the sentinel. */
const unresolvedBuild: BuildInfo = {
  version: '0.4.0',
  commit: unknownRevision,
  shortCommit: unknownRevision,
  branch: unknownRevision,
  env: 'release',
  time: 1_700_000_000_000,
  prNumber: null,
  previewUrl: null,
  productionUrl: null,
};

/** What a Vercel build publishes: everything resolved while the build ran. */
const resolvedBuild: BuildInfo = {
  ...unresolvedBuild,
  commit: '1234567890abcdef',
  shortCommit: '1234567',
  branch: 'main',
};

describe('shortenCommit', () => {
  it('abbreviates to the seven characters every provider UI shows', () => {
    expect(shortenCommit('1234567890abcdef')).toBe('1234567');
  });

  it('passes the unresolved sentinel through rather than slicing it', () => {
    expect(shortenCommit(unknownRevision)).toBe(unknownRevision);
  });
});

describe('runtimeBuildInfo', () => {
  it('completes a container image from the environment its host starts it with', () => {
    expect(
      runtimeBuildInfo(unresolvedBuild, {
        AGENT_ZERO_BUILD_COMMIT: 'fedcba0987654321',
        AGENT_ZERO_BUILD_BRANCH: 'main',
      }),
    ).toMatchObject({
      commit: 'fedcba0987654321',
      shortCommit: 'fedcba0',
      branch: 'main',
    });
  });

  it('never rewrites a field the build resolved, since the commit is a property of the bundle', () => {
    expect(
      runtimeBuildInfo(resolvedBuild, {
        AGENT_ZERO_BUILD_COMMIT: 'fedcba0987654321',
        AGENT_ZERO_BUILD_BRANCH: 'somewhere-else',
      }),
    ).toMatchObject({ commit: '1234567890abcdef', shortCommit: '1234567', branch: 'main' });
  });

  it('is a no-op on Vercel, where the build already read the same variables', () => {
    const vercelEnvironment = {
      VERCEL: '1',
      VERCEL_ENV: 'production',
      VERCEL_GIT_COMMIT_REF: 'main',
      VERCEL_GIT_COMMIT_SHA: '1234567890abcdef',
    };
    expect(runtimeBuildInfo(resolvedBuild, vercelEnvironment)).toStrictEqual(resolvedBuild);
  });

  it('lets a host that knows it is serving a preview reclassify a bundle built elsewhere', () => {
    expect(
      runtimeBuildInfo(
        { ...resolvedBuild, branch: 'feat/env' },
        {
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_REF: 'feat/env',
          VERCEL_URL: 'agent-zero-abc123.vercel.app',
        },
      ).env,
    ).toBe('preview');
  });

  it('classifies the default branch on a preview channel as the canary', () => {
    expect(
      runtimeBuildInfo(resolvedBuild, {
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'main',
      }).env,
    ).toBe('canary');
  });

  it('leaves the classification alone when the host reports no context at all', () => {
    expect(runtimeBuildInfo(resolvedBuild, {}).env).toBe('release');
  });

  it('never revises a development build, whatever variables are in the shell', () => {
    expect(
      runtimeBuildInfo({ ...resolvedBuild, env: 'dev' }, { VERCEL_ENV: 'production' }).env,
    ).toBe('dev');
  });

  it('honours an operator that states outright what the deployment is', () => {
    expect(runtimeBuildInfo(resolvedBuild, { AGENT_ZERO_BUILD_ENV: 'preview' }).env).toBe(
      'preview',
    );
  });

  it('treats the empty strings Nuxt rewrites null runtime-config values to as unresolved', () => {
    expect(
      runtimeBuildInfo(
        { ...resolvedBuild, prNumber: '', previewUrl: '', productionUrl: '' },
        {
          VERCEL_ENV: 'preview',
          VERCEL_GIT_COMMIT_REF: 'feat/env',
          VERCEL_GIT_PULL_REQUEST_ID: '7',
          VERCEL_URL: 'agent-zero-abc123.vercel.app',
        },
      ),
    ).toMatchObject({
      prNumber: '7',
      previewUrl: 'https://agent-zero-abc123.vercel.app',
      productionUrl: null,
    });
  });

  it('fills the deploy URLs a build off the host could not know', () => {
    expect(
      runtimeBuildInfo(resolvedBuild, {
        VERCEL_ENV: 'preview',
        VERCEL_GIT_COMMIT_REF: 'feat/env',
        VERCEL_URL: 'agent-zero-abc123.vercel.app',
      }),
    ).toMatchObject({ previewUrl: 'https://agent-zero-abc123.vercel.app', productionUrl: null });
  });
});
