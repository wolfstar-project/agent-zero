import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyWebhook } from './index.js';

describe('verifyWebhook', () => {
  it('accepts the exact HMAC and rejects a forged one', () => {
    const body = '{"ok":true}';
    const secret = 'secret';
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyWebhook(body, signature, secret)).toBe(true);
    expect(verifyWebhook(body, `${signature.slice(0, -1)}0`, secret)).toBe(false);
  });
});
