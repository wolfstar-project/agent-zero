/**
 * Map the documented `AGENT_ZERO_PORT` onto `NITRO_PORT`, the variable the built Nitro entry
 * actually reads, so the configuration contract in `.env.example` controls the listener.
 *
 * Nitro's native variables win when both are set: an operator who configures `NITRO_PORT` or
 * `PORT` explicitly is speaking Nitro's own contract, and this mapping must not override it.
 */
export function applyPortEnvironment(env: NodeJS.ProcessEnv): void {
  const port = env.AGENT_ZERO_PORT?.trim();
  if (!port) return;
  if (env.NITRO_PORT !== undefined || env.PORT !== undefined) return;
  env.NITRO_PORT = port;
}
