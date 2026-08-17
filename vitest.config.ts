import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest 4 only excludes node_modules and .git by default. Preserve the v3 behaviour so the
    // root watch command never discovers generated tests or configuration files.
    exclude: [
      ...configDefaults.exclude,
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'threads',
  },
});
