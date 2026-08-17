import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ISO_DATE_PATTERN, frontmatter } from './support/frontmatter.js';

const legalRoot = join(import.meta.dirname, '../../content/en/legal');
const NOT_LEGAL_ADVICE_PATTERN = /not legal advice|non è consulenza legale/iu;

describe('legal content', () => {
  const documents = readdirSync(legalRoot).filter((file) => file.endsWith('.md'));

  it('ships at least one legal document', () => {
    expect(documents.length).toBeGreaterThan(0);
  });

  it.each(documents)('%s declares the required frontmatter', (file) => {
    const fields = frontmatter(join(legalRoot, file));

    expect(fields.title).toBeTruthy();
    expect(fields.description).toBeTruthy();
    expect(fields.lastUpdated).toMatch(ISO_DATE_PATTERN);
  });

  it.each(documents)('%s carries the not-legal-advice notice', (file) => {
    const source = readFileSync(join(legalRoot, file), 'utf8');

    expect(source).toMatch(NOT_LEGAL_ADVICE_PATTERN);
  });
});
