import { defineHandler } from 'nitro';

import { listTasks } from '../../../src/router.js';

export default defineHandler(() => listTasks());
