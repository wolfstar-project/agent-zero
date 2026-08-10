import { describe, expect, it } from 'vitest';

import { applyPortEnvironment } from './port.js';

describe('applyPortEnvironment', () => {
  it('maps AGENT_ZERO_PORT onto NITRO_PORT before the server boots', () => {
    const env: NodeJS.ProcessEnv = { AGENT_ZERO_PORT: '4040' };
    applyPortEnvironment(env);
    expect(env.NITRO_PORT).toBe('4040');
  });

  it('leaves the environment alone when AGENT_ZERO_PORT is absent or blank', () => {
    const absent: NodeJS.ProcessEnv = {};
    applyPortEnvironment(absent);
    expect(absent.NITRO_PORT).toBeUndefined();

    const blank: NodeJS.ProcessEnv = { AGENT_ZERO_PORT: '  ' };
    applyPortEnvironment(blank);
    expect(blank.NITRO_PORT).toBeUndefined();
  });

  it('never overrides an explicitly configured Nitro port', () => {
    const nitro: NodeJS.ProcessEnv = { AGENT_ZERO_PORT: '4040', NITRO_PORT: '5050' };
    applyPortEnvironment(nitro);
    expect(nitro.NITRO_PORT).toBe('5050');

    const generic: NodeJS.ProcessEnv = { AGENT_ZERO_PORT: '4040', PORT: '6060' };
    applyPortEnvironment(generic);
    expect(generic.NITRO_PORT).toBeUndefined();
  });
});
