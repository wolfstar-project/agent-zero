import { describe, expect, it } from 'vitest';

import { dashboardUrlFromEnvironment } from '../../server/utils/auth-environment.js';

describe('dashboardUrlFromEnvironment', () => {
  it('uses the local Nuxt origin in development when no public site URL is configured', () => {
    expect(dashboardUrlFromEnvironment({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
  });

  it('prefers the configured public site URL in development', () => {
    expect(
      dashboardUrlFromEnvironment({
        NODE_ENV: 'development',
        NUXT_PUBLIC_SITE_URL: ' https://dashboard.example.com ',
      }),
    ).toBe('https://dashboard.example.com');
  });

  it('does not invent a public origin outside development', () => {
    expect(dashboardUrlFromEnvironment({ NODE_ENV: 'production' })).toBeUndefined();
  });
});
