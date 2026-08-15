import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Legal documents are Markdown with YAML frontmatter, queried through `@nuxt/content` at request
 * time (see `content.config.ts`). Booting the content database just to assert frontmatter shape
 * would be slow and redundant, so this parses the frontmatter block directly — the same contract
 * `packages/i18n/src/config.test.ts` enforces for the JSON dictionaries, applied to Markdown.
 */
const contentRoot = join(import.meta.dirname, '../../content');
const locales = ['en', 'it'];
const sourceLocale = 'en';

const FRONTMATTER_BLOCK_PATTERN = /^---\n([\s\S]*?)\n---/u;
const QUOTED_VALUE_PATTERN = /^['"]|['"]$/gu;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const NOT_LEGAL_ADVICE_PATTERN = /not legal advice|non è consulenza legale/iu;

function frontmatter(path: string): Record<string, string> {
  const source = readFileSync(path, 'utf8');
  const block = FRONTMATTER_BLOCK_PATTERN.exec(source)?.[1];
  if (block === undefined) throw new Error(`${path} has no frontmatter block`);

  const fields: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(QUOTED_VALUE_PATTERN, '');
    fields[key] = value;
  }
  return fields;
}

function legalDocuments(locale: string): string[] {
  return readdirSync(join(contentRoot, locale, 'legal')).filter((file) => file.endsWith('.md'));
}

describe('legal content', () => {
  const sourceDocuments = legalDocuments(sourceLocale);

  it('ships at least one legal document', () => {
    expect(sourceDocuments.length).toBeGreaterThan(0);
  });

  it('ships the same set of documents in every locale', () => {
    for (const locale of locales) {
      expect(legalDocuments(locale).toSorted()).toEqual(sourceDocuments.toSorted());
    }
  });

  describe.each(locales)('%s', (locale) => {
    it.each(sourceDocuments)('%s declares the required frontmatter', (file) => {
      const fields = frontmatter(join(contentRoot, locale, 'legal', file));

      expect(fields.title).toBeTruthy();
      expect(fields.description).toBeTruthy();
      expect(fields.lastUpdated).toMatch(ISO_DATE_PATTERN);
    });

    it.each(sourceDocuments)('%s carries the not-legal-advice notice', (file) => {
      const source = readFileSync(join(contentRoot, locale, 'legal', file), 'utf8');

      expect(source).toMatch(NOT_LEGAL_ADVICE_PATTERN);
    });
  });
});
