import { defineAppConfig } from '../../scripts/tsdown.config.ts';

// `nitro build` emits the HTTP listener into `.output/`; tsdown builds the library surface and
// the start wrapper that maps `AGENT_ZERO_PORT` before that listener boots.
export default defineAppConfig({
  entry: ['src/index.ts', 'src/start.ts'],
});
