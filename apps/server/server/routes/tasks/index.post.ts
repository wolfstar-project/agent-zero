import { defineHandler } from 'nitro';

import { checkoutRootFromEnvironment } from '../../../src/checkout.js';
import { createTaskResponse } from '../../../src/http.js';

export default defineHandler((event) =>
  createTaskResponse(event.req, { checkoutRoot: checkoutRootFromEnvironment() }),
);
