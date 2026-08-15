import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import Header from '~/modules/shared/components/site/Header.vue';

describe('SiteHeader', () => {
  it('labels its navigation landmarks', async () => {
    const wrapper = await mountSuspended(Header);

    for (const nav of wrapper.findAll('nav')) {
      expect(nav.attributes('aria-label')).toBe('Main navigation');
    }
  });

  it('opens external links in a new tab without leaking the referrer', async () => {
    const wrapper = await mountSuspended(Header);
    const external = wrapper.findAll('a').filter((link) => link.attributes('target') === '_blank');

    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      expect(link.attributes('rel')).toContain('noreferrer');
    }
  });

  it('keeps the mobile menu collapsed until it is asked for', async () => {
    const wrapper = await mountSuspended(Header);
    const toggle = wrapper.get('[aria-controls="site-mobile-menu"]');

    expect(toggle.attributes('aria-expanded')).toBe('false');

    await toggle.trigger('click');

    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(toggle.attributes('aria-label')).toBe('Close menu');
  });
});
