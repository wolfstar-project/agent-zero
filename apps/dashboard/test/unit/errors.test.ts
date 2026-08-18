import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import { errors } from '../../server/utils/errors.js';

describe('errors', () => {
  it('answers an unmatched path with a 404 the transports share', () => {
    const error = errors.notFound();
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not found');
  });

  it('names the missing variable without exposing any value', () => {
    const error = errors.misconfigured('GITHUB_WEBHOOK_SECRET');
    expect(error.statusCode).toBe(503);
    expect(error.message).toBe('GITHUB_WEBHOOK_SECRET is not configured');
  });

  it('redacts an unexpected failure, leaving the credential nowhere on the error', () => {
    const token = 'ghp_0123456789abcdefghijklmnopqrstuvwxyz12';
    const error = errors.internal(new Error(`token ${token} leaked`));
    expect(error.statusCode).toBe(500);
    expect(error.message).toBe('token [redacted] leaked');
    // Nitro logs the thrown error whole, so nothing reachable from it may carry the original
    // message — including the `cause` chain a naive `createError({ cause })` would attach.
    expect(inspect(error, { depth: null })).not.toContain(token);
  });

  it('accepts a thrown non-Error value', () => {
    expect(errors.internal('plain failure').message).toBe('plain failure');
  });
});
