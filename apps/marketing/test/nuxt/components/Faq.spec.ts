import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { faqEntries } from '~~/config/content.js';
import Faq from '~~/modules/home/components/Faq.vue';

describe('MarketingFaq', () => {
  it('renders one disclosure per configured entry', async () => {
    const wrapper = await mountSuspended(Faq);

    expect(wrapper.findAll('details')).toHaveLength(faqEntries.length);
  });

  it('renders translated questions rather than raw key paths', async () => {
    const wrapper = await mountSuspended(Faq);
    const questions = wrapper.findAll('summary').map((summary) => summary.text());

    expect(questions).toHaveLength(faqEntries.length);
    for (const question of questions) {
      expect(question).not.toContain('marketing.faq');
      expect(question.length).toBeGreaterThan(0);
    }
  });

  it('starts fully collapsed, so the section is scannable', async () => {
    const wrapper = await mountSuspended(Faq);

    for (const details of wrapper.findAll('details')) {
      expect(details.attributes('open')).toBeUndefined();
    }
  });

  it('anchors the section so the header link can reach it', async () => {
    const wrapper = await mountSuspended(Faq);

    expect(wrapper.get('section').attributes('id')).toBe('faq');
  });
});
