import { call } from '@orpc/server';
import { describe, expect, it } from 'vitest';

import { router } from './router.js';

describe('oRPC router', () => {
  it('exposes a typed health procedure', async () => {
    await expect(call(router.health, undefined)).resolves.toMatchObject({
      status: 'ok',
      service: 'agent-zero',
    });
  });
});
