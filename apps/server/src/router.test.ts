import { describe, expect, it } from 'vitest';

import { health, listTasks, taskInput } from './router.js';

describe('server task API', () => {
  it('exposes health metadata for Nitro handlers', () => {
    expect(health()).toMatchObject({ status: 'ok', service: 'agent-zero' });
  });

  it('starts with an empty task collection', () => {
    expect(listTasks()).toEqual({ tasks: [] });
  });

  it('keeps task input validation independent from HTTP transport', () => {
    expect(
      taskInput.parse({
        repository: '.',
        feedback: 'Check error handling',
        mode: 'observe',
      }),
    ).toMatchObject({ repository: '.', mode: 'observe' });
  });
});
