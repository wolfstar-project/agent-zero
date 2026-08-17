export interface NavigationLink {
  /** Stable list key, also the suffix of its `marketing.nav.*` label key. */
  readonly id: string;
  /** Resolved href. Already locale-prefixed for internal routes. */
  readonly to: string;
  /** Rendered with `target="_blank"` and `rel="noreferrer"`. */
  readonly external: boolean;
}

/**
 * Header navigation for one locale.
 *
 * Written as a plain function over `localePath` rather than a composable so it can be checked by
 * the package's plain `tsc` pass and exercised in the `unit` Vitest project: `useLocalePath` has
 * no public export from `@nuxtjs/i18n`, so a composable form would only type-check under
 * `vue-tsc`. Callers pass `useLocalePath()` in, and — for the same reason — the docs URL from
 * `links` rather than reading it here.
 *
 * The two section entries are anchors on the home page rather than routes of their own. They
 * exist to move a visitor down one page, and giving them URLs would split the landing page's
 * ranking across three thin documents.
 */
export function siteNavigation(
  localePath: (path: string) => string,
  docsUrl: string,
): readonly NavigationLink[] {
  const home = localePath('/');
  // `localePath('/')` is "/" for the default locale and "/it" otherwise; both need exactly one
  // separator before the fragment.
  const anchor = (fragment: string): string => `${home === '/' ? '' : home}/#${fragment}`;

  return [
    { id: 'features', to: anchor('features'), external: false },
    { id: 'pricing', to: localePath('/pricing'), external: false },
    { id: 'faq', to: anchor('faq'), external: false },
    { id: 'blog', to: localePath('/blog'), external: false },
    { id: 'contact', to: localePath('/contact'), external: false },
    { id: 'docs', to: docsUrl, external: true },
  ];
}
