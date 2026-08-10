import { defineHandler } from 'nitro';

import { health } from '../../src/router.js';

export default defineHandler(() => health());
