import { describe, expect, it } from 'vitest';

import { siteNavigation } from '../../app/modules/shared/utils/site-navigation.js';

/** Stand-in for `useLocalePath()` under the `prefix_except_default` strategy. */
function localePathFor(prefix: string): (path: string) => string {
  return (path) => (path === '/' ? prefix || '/' : `${prefix}${path}`);
}

describe('siteNavigation', () => {
  it('keeps every entry unique and labelled', () => {
    const ids = siteNavigation(localePathFor('')).map((link) => link.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('pricing');
  });

  it('builds home anchors without a doubled separator on the default locale', () => {
    const navigation = siteNavigation(localePathFor(''));

    expect(navigation.find((link) => link.id === 'features')?.to).toBe('/#features');
    expect(navigation.find((link) => link.id === 'faq')?.to).toBe('/#faq');
  });

  it('prefixes home anchors with the active locale', () => {
    const navigation = siteNavigation(localePathFor('/it'));

    expect(navigation.find((link) => link.id === 'features')?.to).toBe('/it/#features');
  });

  it('routes internal pages through localePath', () => {
    const navigation = siteNavigation(localePathFor('/it'));

    expect(navigation.find((link) => link.id === 'pricing')?.to).toBe('/it/pricing');
    expect(navigation.find((link) => link.id === 'contact')?.to).toBe('/it/contact');
  });

  it('leaves external destinations untouched by the locale', () => {
    const english = siteNavigation(localePathFor(''));
    const italian = siteNavigation(localePathFor('/it'));
    const docs = english.find((link) => link.id === 'docs');

    expect(docs?.external).toBe(true);
    expect(docs?.to).toBe(italian.find((link) => link.id === 'docs')?.to);
  });

  it('marks only off-site destinations as external', () => {
    for (const link of siteNavigation(localePathFor(''))) {
      expect(link.external).toBe(link.to.startsWith('http'));
    }
  });
});
