import VersionInjector from '@redstardev/unplugin-version-injector/rolldown';
import { defineConfig, type OutExtensionContext, type UserConfig } from 'tsdown';

const baseConfig = {
  entry: ['src/index.ts'],
  platform: 'node',
  target: 'node24.2',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false,
  failOnWarn: true,
  checks: {
    // v0.0.2 transforms the version marker without returning a source map.
    // Keep source maps enabled while suppressing only Rolldown's plugin-map warning.
    sourcemapBroken: false,
  },
  treeshake: true,
  deps: {
    neverBundle: true,
  },
  plugins: [VersionInjector()],
} satisfies UserConfig;

const packageConfig = {
  ...baseConfig,
  format: ['esm', 'cjs'],
  outExtensions: (context: OutExtensionContext) => ({
    js: context.format === 'es' ? '.mjs' : '.cjs',
    dts: context.format === 'es' ? '.d.mts' : '.d.cts',
  }),
  dts: {
    sourcemap: true,
  },
  attw: {
    entrypoints: ['.'],
    enabled: true,
    level: 'error',
    profile: 'node16',
  },
  publint: {
    enabled: true,
    level: 'error',
  },
} satisfies UserConfig;

const appConfig = {
  ...baseConfig,
  format: ['esm'],
  fixedExtension: false,
  dts: false,
} satisfies UserConfig;

export function definePackageConfig(overrides: UserConfig = {}) {
  return defineConfig({
    ...packageConfig,
    ...overrides,
  });
}

export function defineAppConfig(overrides: UserConfig = {}) {
  return defineConfig({
    ...appConfig,
    ...overrides,
  });
}
