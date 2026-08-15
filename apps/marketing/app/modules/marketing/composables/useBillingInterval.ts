import { useState } from 'nuxt/app';
// Imported explicitly rather than relying on Nuxt auto-imports: the package's plain `tsc` pass
// checks `app/**/*.ts` without the generated auto-import declarations that `vue-tsc` sees.
import type { Ref } from 'vue';

import type { BillingInterval } from '../../../../config/content.js';

/**
 * The monthly/yearly choice, shared by every pricing surface on the page.
 *
 * Held in `useState` rather than a local ref so the toggle on `/pricing` and the plan cards on the
 * home page agree, and so the choice survives client-side navigation between the two.
 */
export function useBillingInterval(): Ref<BillingInterval> {
  return useState<BillingInterval>('billing-interval', () => 'monthly');
}
