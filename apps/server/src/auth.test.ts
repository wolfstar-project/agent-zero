import { describe, expect, it } from 'vitest';

import {
  accessFromEnvironment,
  authenticate,
  mayTargetRepository,
  type ControlPlaneAccess,
} from './auth.js';

const TOKEN_FORMAT_ERROR = /name:token/;

function access(overrides: Partial<ControlPlaneAccess> = {}): ControlPlaneAccess {
  return {
    principals: new Map([['token-value', 'release-manager']]),
    repositories: ['/srv/checkout'],
    ...overrides,
  };
}

describe('accessFromEnvironment', () => {
  it('fails closed when no tokens are configured', () => {
    expect(accessFromEnvironment(undefined, '/srv/checkout')).toBeUndefined();
    expect(accessFromEnvironment('', '/srv/checkout')).toBeUndefined();
    expect(accessFromEnvironment(' , ', '/srv/checkout')).toBeUndefined();
  });

  it('parses name:token pairs and the repository allow-list', () => {
    const parsed = accessFromEnvironment('release-manager:tok1, ci:tok2', '/srv/app, ./checkout');
    expect(parsed?.principals.get('tok1')).toBe('release-manager');
    expect(parsed?.principals.get('tok2')).toBe('ci');
    expect(parsed?.repositories).toEqual(['/srv/app', './checkout']);
  });

  it('keeps tokens containing separators intact after the first colon', () => {
    const parsed = accessFromEnvironment('ops:v1:secret');
    expect(parsed?.principals.get('v1:secret')).toBe('ops');
  });

  it('refuses malformed entries rather than silently dropping them', () => {
    expect(() => accessFromEnvironment('missing-separator')).toThrow(TOKEN_FORMAT_ERROR);
    expect(() => accessFromEnvironment(':token-only')).toThrow(TOKEN_FORMAT_ERROR);
    expect(() => accessFromEnvironment('name-only:')).toThrow(TOKEN_FORMAT_ERROR);
  });

  it('defaults to an empty repository allow-list', () => {
    expect(accessFromEnvironment('ops:tok', undefined)?.repositories).toEqual([]);
  });
});

describe('authenticate', () => {
  it('resolves the principal for a valid bearer token', () => {
    expect(authenticate('Bearer token-value', access())).toEqual({ name: 'release-manager' });
  });

  it('rejects missing, malformed, and unknown credentials', () => {
    expect(authenticate(undefined, access())).toBeUndefined();
    expect(authenticate('token-value', access())).toBeUndefined();
    expect(authenticate('Basic token-value', access())).toBeUndefined();
    expect(authenticate('Bearer wrong-token', access())).toBeUndefined();
    expect(authenticate('Bearer token-valu', access())).toBeUndefined();
  });

  it('fails closed when no access policy is configured', () => {
    expect(authenticate('Bearer token-value', undefined)).toBeUndefined();
  });
});

describe('mayTargetRepository', () => {
  it('authorizes only allow-listed repository paths', () => {
    expect(mayTargetRepository('/srv/checkout', access())).toBe(true);
    expect(mayTargetRepository('/srv/other', access())).toBe(false);
  });

  it('compares resolved paths so traversal cannot dodge the allow-list', () => {
    expect(mayTargetRepository('/srv/checkout/../checkout', access())).toBe(true);
    expect(mayTargetRepository('/srv/checkout/../other', access())).toBe(false);
  });

  it('fails closed without a policy or with an empty allow-list', () => {
    expect(mayTargetRepository('/srv/checkout', undefined)).toBe(false);
    expect(mayTargetRepository('/srv/checkout', access({ repositories: [] }))).toBe(false);
  });
});
