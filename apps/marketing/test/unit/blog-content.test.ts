import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ISO_DATE_PATTERN, frontmatter } from './support/frontmatter.js';

const blogRoot = join(import.meta.dirname, '../../content/en/blog');
const MARKDOWN_EXTENSION_PATTERN = /\.md$/u;

describe('blog content', () => {
  const posts = readdirSync(blogRoot).filter((file) => file.endsWith('.md'));

  it('ships at least one post', () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  it('gives every post a unique slug', () => {
    const slugs = posts.map((file) => file.replace(MARKDOWN_EXTENSION_PATTERN, ''));

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(posts)('%s declares the required frontmatter', (file) => {
    const fields = frontmatter(join(blogRoot, file));

    expect(fields.title).toBeTruthy();
    expect(fields.description).toBeTruthy();
    expect(fields.date).toMatch(ISO_DATE_PATTERN);
    expect(fields.author).toBeTruthy();
    expect(fields.authorInitials).toBeTruthy();
    const tag = fields.tag;
    expect(tag).toBeTruthy();
    // The listing renders this verbatim as a filter chip label; catches an accidental
    // "Safety" or "Safety " sneaking in and silently doubling a chip that should read "safety".
    expect(tag).toBe(tag?.toLowerCase().trim());
  });
});
