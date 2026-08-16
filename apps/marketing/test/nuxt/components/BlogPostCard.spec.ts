import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import PostCard from '~~/modules/blog/components/PostCard.vue';

const post = {
  path: '/blog/observe-mode-first',
  title: 'Observe mode first, always',
  description: 'Why every run starts read-only.',
  date: '2026-08-06',
  author: 'Amelia Ortiz',
  authorInitials: 'AO',
  tag: 'safety',
};

describe('BlogPostCard', () => {
  it('renders the post title, excerpt, tag, and author', async () => {
    const wrapper = await mountSuspended(PostCard, { props: { post } });

    expect(wrapper.text()).toContain(post.title);
    expect(wrapper.text()).toContain(post.description);
    expect(wrapper.text()).toContain(post.tag);
    expect(wrapper.text()).toContain(post.author);
    expect(wrapper.text()).toContain(post.authorInitials);
  });

  it('links the title and the "read more" affordance to the post path', async () => {
    const wrapper = await mountSuspended(PostCard, { props: { post } });
    const hrefs = wrapper.findAll('a').map((link) => link.attributes('href'));

    // PostCard wraps paths with localePath() to preserve the visitor's active locale; the i18n
    // strategy (`prefix_except_default`) means the default-locale test environment renders hrefs
    // unchanged, but this assertion stays robust if config ever switches to `prefix`.
    expect(hrefs.some((href) => href?.endsWith(post.path))).toBe(true);
  });
});
