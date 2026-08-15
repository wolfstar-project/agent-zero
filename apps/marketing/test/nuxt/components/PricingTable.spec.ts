import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';
import { pricingPlans } from '~~/config/content.js';
import PricingTable from '~~/modules/home/components/PricingTable.vue';

describe('MarketingPricingTable', () => {
  it('renders one card per configured plan', async () => {
    const wrapper = await mountSuspended(PricingTable);

    expect(wrapper.findAll('h3')).toHaveLength(pricingPlans.length);
  });

  it('exposes the billing interval as a radiogroup', async () => {
    const wrapper = await mountSuspended(PricingTable);
    const radios = wrapper.findAll('[role="radio"]');

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Billing interval');
    expect(radios).toHaveLength(2);
    expect(radios[0]?.attributes('aria-checked')).toBe('true');
    expect(radios[1]?.attributes('aria-checked')).toBe('false');
  });

  it('switches the displayed price when the interval changes', async () => {
    const wrapper = await mountSuspended(PricingTable);

    expect(wrapper.text()).toContain('$49');

    await wrapper.findAll('[role="radio"]')[1]?.trigger('click');

    expect(wrapper.text()).toContain('$490');
    expect(wrapper.text()).not.toContain('$49 ');

    // The interval lives in shared state, so restore it for the next spec in this file.
    await wrapper.findAll('[role="radio"]')[0]?.trigger('click');
  });

  it('shows "Custom" instead of an amount for plans without a list price', async () => {
    const wrapper = await mountSuspended(PricingTable);

    expect(wrapper.text()).toContain('Custom');
  });

  it('marks exactly one plan as recommended', async () => {
    const wrapper = await mountSuspended(PricingTable);

    expect(wrapper.findAll('span').filter((node) => node.text() === 'Recommended')).toHaveLength(1);
  });
});
