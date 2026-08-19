import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * One deployment's stored session, as `zero login` leaves it.
 *
 * Only the bearer token and its expiry: everything else about the session belongs to the
 * deployment that minted it, and a stale local copy of a user's name or role would be a second
 * source of truth for authorization decisions this file has no business influencing.
 */
export interface StoredCredential {
  readonly accessToken: string;
  /** ISO 8601 instant the token stops being accepted, so a stale entry is recognisable offline. */
  readonly expiresAt: string;
}

/**
 * Every deployment the CLI holds a session for, keyed by origin.
 *
 * Keyed rather than singular because one workstation routinely drives a cloud-managed deployment
 * and a self-hosted one, and signing into the second must not silently evict the first.
 */
export type CredentialStore = Readonly<Record<string, StoredCredential>>;

/**
 * Narrows a parsed JSON value to something with readable properties.
 *
 * A type predicate rather than a cast: the file is operator-editable, so the one place it is read
 * should prove its shape instead of asserting it.
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Only the owner may read the token file; a shared workstation is the expected environment. */
const OWNER_ONLY = 0o600;
const DIRECTORY_OWNER_ONLY = 0o700;

/**
 * Where the credential file lives.
 *
 * Follows the XDG base-directory convention rather than writing beside the checkout: a token is a
 * property of the operator, not of the repository they happen to be standing in, and a file inside
 * a working tree is one `git add -A` away from being published.
 *
 * The environment is passed in so callers stay deterministic in tests.
 */
export function credentialsPath(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  home: string = homedir(),
): string {
  const configHome = environment.XDG_CONFIG_HOME?.trim();
  return join(configHome || join(home, '.config'), 'agent-zero', 'credentials.json');
}

/**
 * Normalize a deployment URL to the origin used as a store key.
 *
 * Without this, `https://app.example.test` and `https://app.example.test/` would occupy two
 * entries, and signing in through one would look like being signed out through the other.
 *
 * @throws when the value is not a parseable absolute URL, because the alternative is issuing a
 * device-code request against a silently wrong host.
 */
export function normalizeOrigin(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a valid deployment URL: ${url}`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    throw new Error(`Deployment URL must be http or https: ${url}`);
  return parsed.origin;
}

/**
 * Read the credential store, treating an absent or unreadable file as an empty one.
 *
 * A malformed file is also empty rather than fatal: the recovery for a corrupted token cache is to
 * sign in again, which is exactly what an empty store prompts, and refusing to run at all would
 * make an unrelated command fail for a reason it does not care about.
 */
export async function readCredentials(path = credentialsPath()): Promise<CredentialStore> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const store: Record<string, StoredCredential> = {};
    for (const [origin, value] of Object.entries(parsed)) {
      if (!isRecord(value)) continue;
      const { accessToken, expiresAt } = value;
      if (typeof accessToken !== 'string' || typeof expiresAt !== 'string') continue;
      store[origin] = { accessToken, expiresAt };
    }
    return store;
  } catch {
    return {};
  }
}

/**
 * Record a session for one deployment, leaving every other entry untouched.
 *
 * The file is created owner-only before anything is written to it, and `chmod` runs again
 * afterwards so an existing file created under a laxer umask is tightened rather than trusted.
 */
export async function saveCredential(
  origin: string,
  credential: StoredCredential,
  path = credentialsPath(),
): Promise<void> {
  const store = await readCredentials(path);
  await mkdir(dirname(path), { recursive: true, mode: DIRECTORY_OWNER_ONLY });
  await writeFile(path, `${JSON.stringify({ ...store, [origin]: credential }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: OWNER_ONLY,
  });
  await chmod(path, OWNER_ONLY);
}

/**
 * Forget one deployment's session, or every one of them.
 *
 * Removing the last entry deletes the file rather than leaving an empty object behind, so
 * "signed out" is indistinguishable from "never signed in" on disk.
 *
 * @returns whether anything was actually removed, so the caller can tell the operator the
 * difference between forgetting a session and having none to forget.
 */
export async function forgetCredential(
  origin: string | undefined,
  path = credentialsPath(),
): Promise<boolean> {
  const store = await readCredentials(path);
  const origins = origin === undefined ? Object.keys(store) : [origin];
  const remaining = Object.fromEntries(
    Object.entries(store).filter(([key]) => !origins.includes(key)),
  );
  if (Object.keys(remaining).length === Object.keys(store).length) return false;

  if (Object.keys(remaining).length === 0) {
    await rm(path, { force: true });
    return true;
  }

  await writeFile(path, `${JSON.stringify(remaining, null, 2)}\n`, {
    encoding: 'utf8',
    mode: OWNER_ONLY,
  });
  await chmod(path, OWNER_ONLY);
  return true;
}
