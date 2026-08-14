import { describe, expect, it } from 'vitest';

import { createProvider, providerForDelivery } from './registry.js';
import { verifyHmacSha256 } from './signatures.js';

describe('providerForDelivery', () => {
  it('routes each provider by its own headers', () => {
    expect(providerForDelivery({ 'x-github-event': 'pull_request' })?.kind).toBe('github');
    expect(providerForDelivery({ 'x-gitlab-event': 'Note Hook' })?.kind).toBe('gitlab');
    expect(providerForDelivery({ 'x-event-key': 'pullrequest:created' })?.kind).toBe(
      'bitbucket-cloud',
    );
    expect(providerForDelivery({ 'x-event-key': 'pr:opened' })?.kind).toBe('bitbucket-data-center');
    expect(providerForDelivery({ 'x-gitea-event': 'pull_request' })?.kind).toBe('gitea');
  });

  it('routes Gitea and Forgejo ahead of their GitHub compatibility header', () => {
    expect(
      providerForDelivery({ 'x-github-event': 'pull_request', 'x-gitea-event': 'pull_request' })
        ?.kind,
    ).toBe('gitea');
    expect(
      providerForDelivery({ 'x-github-event': 'pull_request', 'x-forgejo-event': 'pull_request' })
        ?.kind,
    ).toBe('gitea');
  });

  it('reads headers case-insensitively, as proxies rewrite casing', () => {
    expect(providerForDelivery({ 'X-GitHub-Event': 'pull_request' })?.kind).toBe('github');
  });

  it('only routes to providers the deployment configured', () => {
    const headers = { 'x-github-event': 'pull_request' };
    expect(providerForDelivery(headers, ['gitlab'])).toBeUndefined();
    expect(providerForDelivery(headers, ['gitlab', 'github'])?.kind).toBe('github');
  });

  it('returns nothing for an anonymous delivery', () => {
    expect(providerForDelivery({})).toBeUndefined();
  });
});

describe('createProvider', () => {
  it('returns a stateless adapter per kind', () => {
    expect(createProvider('github').kind).toBe('github');
    expect(createProvider('gitea')).toBe(createProvider('gitea'));
  });
});

describe('verifyHmacSha256', () => {
  it('rejects an empty secret so a missing configuration cannot verify anything', () => {
    expect(verifyHmacSha256('body', 'signature', '')).toBe(false);
  });
});
