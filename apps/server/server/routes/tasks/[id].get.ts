import { defineHandler } from 'nitro';

import { taskResponse } from '../../../src/http.js';

export default defineHandler((event) => taskResponse(event.context.params?.id));
