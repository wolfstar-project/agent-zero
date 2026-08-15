import process from 'node:process';

import { afterEach, describe, expect, it } from 'vitest';

import { defaultSiteUrl, links, siteUrlFromEnvironment } from '../../config/app.js';

const originalSiteUrl = process.env.MARKETING_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.MARKETING_SITE_URL;
  else process.env.MARKETING_SITE_URL = originalSiteUrl;
});

describe('siteUrlFromEnvironment', () => {
  it('falls back to the local origin when unset', () => {
    delete process.env.MARKETING_SITE_URL;

    expect(siteUrlFromEnvironment()).toBe(defaultSiteUrl);
  });

  it('uses the configured origin', () => {
    process.env.MARKETING_SITE_URL = 'https://agent-zero.dev';

    expect(siteUrlFromEnvironment()).toBe('https://agent-zero.dev');
  });

  it('treats a blank value as unset, so a stray empty var cannot break canonical URLs', () => {
    process.env.MARKETING_SITE_URL = '   ';

    expect(siteUrlFromEnvironment()).toBe(defaultSiteUrl);
  });
});

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/u;

describe('outbound links', () => {
  const { contactEmail, ...urls } = links;

  // Nothing on a public page should ever be able to downgrade a visitor to plain HTTP, and a link
  // that fails to parse renders as a dead anchor rather than an error anyone would notice.
  it.each(Object.entries(urls))('%s is an absolute https URL', (_name, value) => {
    expect(URL.canParse(value)).toBe(true);
    expect(new URL(value).protocol).toBe('https:');
  });

  it('exposes a contact address rather than a URL', () => {
    expect(contactEmail).toMatch(EMAIL_PATTERN);
  });
});
