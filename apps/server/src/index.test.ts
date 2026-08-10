import { describe, expect, it } from 'vitest';

import { portFromEnvironment } from './index.js';

const PORT_ERROR = /PORT must be an integer/;

describe('portFromEnvironment', () => {
  it('falls back to the dashboard-free default when PORT is unset', () => {
    expect(portFromEnvironment(undefined)).toBe(3001);
    expect(portFromEnvironment('')).toBe(3001);
  });

  it('accepts an explicit port, including the ephemeral 0', () => {
    expect(portFromEnvironment('8080')).toBe(8080);
    expect(portFromEnvironment('0')).toBe(0);
  });

  it('refuses a malformed port rather than silently listening on the default', () => {
    expect(() => portFromEnvironment('http')).toThrow(PORT_ERROR);
    expect(() => portFromEnvironment('8080.5')).toThrow(PORT_ERROR);
    expect(() => portFromEnvironment('-1')).toThrow(PORT_ERROR);
    expect(() => portFromEnvironment('70000')).toThrow(PORT_ERROR);
  });
});
