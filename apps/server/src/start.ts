import { applyPortEnvironment } from './port.js';

applyPortEnvironment(process.env);

// The listener is created by the Nitro output, which `nitro build` emits next to this bundle.
// The port mapping above must run in the same process before that entry reads its environment.
await import(new URL('../.output/server/index.mjs', import.meta.url).href);
