// Shared helpers for the i18n tooling scripts, ported from wolfstar.rocks (Apache 2.0 license).
// Every locale splits into feature files under `locales/{locale}/{feature}`.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import localeFeatures from '../../locales/locale-features.json' with { type: 'json' };

export const LOCALES_DIRECTORY = join(import.meta.dirname, '../../locales');
export const REFERENCE_LOCALE = 'en';
export const FEATURE_FILES = localeFeatures.features as readonly string[];

export type NestedObject = Record<string, unknown>;

/**
 * True for a JSON object (not null, not an array) — the shape every locale and schema file uses.
 * A type guard rather than a cast: `JSON.parse` returns `any`, and these files are hand-edited, so
 * a malformed one (an array, a bare string) should fail loudly instead of being trusted.
 */
export function isJsonRecord(value: unknown): value is NestedObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Absolute path to a locale feature file. */
export function localeFeatureAbsolutePath(localeCode: string, featureFile: string): string {
  return join(LOCALES_DIRECTORY, localeCode, featureFile);
}

export function listLocaleCodes(): string[] {
  if (!existsSync(LOCALES_DIRECTORY)) return [];
  return readdirSync(LOCALES_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted((a, b) => a.localeCompare(b));
}

export function readFeatureFile(localeCode: string, featureFile: string): NestedObject {
  const filePath = localeFeatureAbsolutePath(localeCode, featureFile);
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (!isJsonRecord(parsed)) throw new Error(`expected ${filePath} to contain a JSON object`);
  return parsed;
}

/** Deep-merge all feature files for a locale into one object (for tooling reports). */
export function loadMergedLocale(localeCode: string): NestedObject {
  const merged: NestedObject = {};
  for (const feature of FEATURE_FILES) {
    const content = readFeatureFile(localeCode, feature);
    for (const [key, value] of Object.entries(content)) {
      if (key === '$schema') continue;
      merged[key] = value;
    }
  }
  return merged;
}

/** `$schema` is editor tooling metadata, not a translatable message. */
export function withoutSchema(obj: NestedObject): NestedObject {
  const { $schema: _, ...rest } = obj;
  return rest;
}
