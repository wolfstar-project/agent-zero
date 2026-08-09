import { destr } from 'destr';
import { anyOf, charIn, createRegExp, digit, letter } from 'magic-regexp';

/** The repository-native check kinds a verified run is expected to execute. */
export const checkKinds = ['lint', 'typecheck', 'test', 'build'] as const;
export type CheckKind = (typeof checkKinds)[number];

/** Package managers Agent Zero can invoke a repository script through. */
export type PackageManager = 'pnpm' | 'yarn' | 'npm' | 'bun';

/** What the runtime observed about a checkout, used to derive its native check commands. */
export interface RepositoryProbe {
  /** Raw `package.json` contents, or null when the checkout has none. */
  packageJson: string | null;
  /** Lockfile names present at the checkout root. */
  lockfiles: readonly string[];
}

/** Script names accepted for each kind, in preference order. */
const scriptCandidates: Readonly<Record<CheckKind, readonly string[]>> = {
  lint: ['lint', 'lint:ci', 'eslint'],
  typecheck: ['typecheck', 'type-check', 'types', 'tsc'],
  test: ['test', 'test:unit', 'tests'],
  build: ['build'],
};

const lockfileManagers: readonly (readonly [string, PackageManager])[] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
];

/** Lockfiles worth probing for in a checkout, in the order they take precedence. */
export const knownLockfiles: readonly string[] = lockfileManagers.map(([lockfile]) => lockfile);

/** Script names Agent Zero is willing to invoke. Anything else is untrusted repository content. */
const SAFE_SCRIPT_NAME = createRegExp(
  anyOf(letter, digit)
    .at.lineStart()
    .and(anyOf(letter, digit, charIn(':._-')).times.any())
    .at.lineEnd(),
);

/** Identify the package manager a checkout pins, defaulting to npm. */
export function packageManagerFromLockfiles(lockfiles: readonly string[]): PackageManager {
  const present = new Set(lockfiles);
  for (const [lockfile, manager] of lockfileManagers) if (present.has(lockfile)) return manager;
  return 'npm';
}

/**
 * Derive the checkout's own lint, typecheck, test, and build commands.
 *
 * Only scripts the repository actually declares are returned, so a run never claims to have
 * executed a check the repository does not define. Script names that are not plain identifiers are
 * skipped rather than quoted, because the runner does not use a shell.
 */
export function discoverChecks(probe: RepositoryProbe): string[] {
  const scripts = readScripts(probe.packageJson);
  if (scripts.length === 0) return [];
  const manager = packageManagerFromLockfiles(probe.lockfiles);
  const available = new Set(scripts);
  const commands: string[] = [];
  for (const kind of checkKinds) {
    const script = scriptCandidates[kind].find(
      (candidate) => available.has(candidate) && SAFE_SCRIPT_NAME.test(candidate),
    );
    if (script) commands.push(`${manager} run ${script}`);
  }
  return commands;
}

/**
 * Choose the commands a run will verify with.
 *
 * Explicit configuration always wins. An empty list means "use whatever this repository defines",
 * which keeps Agent Zero usable across checkouts without inventing commands.
 */
export function resolveChecks(configured: readonly string[], probe: RepositoryProbe): string[] {
  return configured.length > 0 ? [...configured] : discoverChecks(probe);
}

/**
 * Validate only the configuration-level invariant here.
 *
 * Command syntax and shell semantics are deliberately owned by `packages/runner`, where ViteHub
 * Shell performs the authoritative analysis immediately before execution. Keeping that decision in
 * one layer avoids the config and runner drifting into two subtly different shell parsers.
 */
export function assertExecutableCommand(command: string): void {
  if (command.trim().length === 0) throw new Error('Check commands must not be empty');
}

function readScripts(packageJson: string | null): string[] {
  if (!packageJson) return [];
  const parsed: unknown = destr(packageJson);
  if (!isRecord(parsed) || !isRecord(parsed.scripts)) return [];
  return Object.entries(parsed.scripts)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([name]) => name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
