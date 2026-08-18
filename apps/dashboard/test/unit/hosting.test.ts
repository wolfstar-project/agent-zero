import { describe, expect, it } from 'vitest';

import { defaultViteHubPreset, viteHubPresetFromEnvironment } from '../../config/hosting.js';

describe('viteHubPresetFromEnvironment', () => {
  it('builds the self-hosted bundle when no deployment target is configured', () => {
    expect(viteHubPresetFromEnvironment({})).toBe(defaultViteHubPreset);
    expect(viteHubPresetFromEnvironment({ VITEHUB_HOSTING: '', NITRO_PRESET: '  ' })).toBe('node');
  });

  it('maps Nitro preset spellings onto ViteHub deployment presets', () => {
    expect(viteHubPresetFromEnvironment({ NITRO_PRESET: 'vercel' })).toBe('vercel');
    expect(viteHubPresetFromEnvironment({ NITRO_PRESET: ' Vercel-Edge ' })).toBe('vercel');
    expect(viteHubPresetFromEnvironment({ NITRO_PRESET: 'node-server' })).toBe('node');
    expect(viteHubPresetFromEnvironment({ NITRO_PRESET: 'cloudflare_module' })).toBe('cloudflare');
    expect(viteHubPresetFromEnvironment({ NITRO_PRESET: 'deno-deploy' })).toBe('deno');
    expect(viteHubPresetFromEnvironment({ NITRO_PRESET: 'netlify' })).toBe('netlify');
  });

  it('prefers the ViteHub hosting variable over the Nitro one', () => {
    expect(
      viteHubPresetFromEnvironment({ VITEHUB_HOSTING: 'vercel', NITRO_PRESET: 'node-server' }),
    ).toBe('vercel');
  });

  it('rejects a target it has no plan for instead of emitting an unservable bundle', () => {
    expect(() => viteHubPresetFromEnvironment({ NITRO_PRESET: 'bun' })).toThrow(
      /Unsupported deployment target "bun"/u,
    );
  });
});
