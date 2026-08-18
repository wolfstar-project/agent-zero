import { describe, expect, it } from 'vitest';

import { errors } from '../../server/utils/errors.js';

describe('errors', () => {
  it('answers an unmatched path with a 404 the transports share', async () => {
    const response = errors.notFound();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('names the missing variable without exposing any value', async () => {
    const response = errors.misconfigured('GITHUB_WEBHOOK_SECRET');
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'GITHUB_WEBHOOK_SECRET is not configured',
    });
  });
});
