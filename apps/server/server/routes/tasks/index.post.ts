import { defineHandler } from 'nitro';

import { createTaskResponse } from '../../../src/http.js';

export default defineHandler((event) => createTaskResponse(event.req));
