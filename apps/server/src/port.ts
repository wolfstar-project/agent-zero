// 3000 belongs to the Nuxt dashboard, so `aube run dev` can start both without a port collision.
const DEFAULT_PORT = 3001;

/** Resolve the listen port, refusing a malformed value rather than silently picking a default. */
export function portFromEnvironment(value = process.env.PORT): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535)
    throw new Error('PORT must be an integer between 0 and 65535');
  return port;
}
