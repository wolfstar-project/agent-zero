import { describe, expect, it } from 'vitest';

import { links } from '../../app/app.config.js';

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
