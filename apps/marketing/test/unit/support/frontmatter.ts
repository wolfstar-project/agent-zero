import { readFileSync } from 'node:fs';

/**
 * Parses YAML frontmatter directly rather than booting `@nuxt/content`'s database just to assert
 * shape — the same trade the i18n dictionary contract test (`packages/i18n/src/config.test.ts`)
 * makes for JSON, applied to Markdown. Values are flat strings; none of the frontmatter this app's
 * collections declare (`content.config.ts`) is nested or a list.
 */
const FRONTMATTER_BLOCK_PATTERN = /^---\n([\s\S]*?)\n---/u;
const QUOTED_VALUE_PATTERN = /^['"]|['"]$/gu;

export function frontmatter(path: string): Record<string, string> {
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

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
