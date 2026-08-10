import { defineHandler } from 'nitro';

import { evidenceResponse } from '../../../../src/http.js';

export default defineHandler((event) => evidenceResponse(event.context.params?.id));
