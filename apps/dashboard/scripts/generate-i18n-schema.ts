/* oxlint-disable no-console -- generation reporting */
// JSON Schema generator for the locale feature files, ported from wolfstar.rocks (Apache 2.0
// license). Generates `i18n/schemas/{feature}.schema.json` from each `en/*` reference file and
// points every locale's copy at the matching schema, so editors validate structure and key names.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { styleText } from 'node:util';

import {
  FEATURE_FILES,
  LOCALES_DIRECTORY,
  REFERENCE_LOCALE,
  localeFeatureAbsolutePath,
} from './utils/i18n-locale-files.ts';

const SCHEMAS_DIRECTORY = join(import.meta.dirname, '../i18n/schemas');

type Json = Record<string, unknown>;
type LocaleJson = Json & { $schema?: string };

interface JsonSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type: string;
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
}

function generateSubSchema(obj: Json): JsonSchema {
  const properties: Record<string, JsonSchema> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === '$schema') continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      properties[key] = generateSubSchema(value as Json);
    } else {
      properties[key] = { type: 'string' };
    }
  }

  return { type: 'object', properties, additionalProperties: false };
}

function generateSchema(obj: LocaleJson, featureFile: string): JsonSchema {
  const baseSchema = generateSubSchema(obj);
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: `Agent Zero dashboard i18n locale file (${featureFile})`,
    description: `Schema for ${featureFile}. Generated from ${REFERENCE_LOCALE}/${featureFile} — do not edit manually.`,
    ...baseSchema,
    properties: {
      ...baseSchema.properties,
      $schema: { type: 'string' },
    },
  };
}

async function main(): Promise<void> {
  await mkdir(SCHEMAS_DIRECTORY, { recursive: true });

  const localeDirectories = (await readdir(LOCALES_DIRECTORY, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const featureFile of FEATURE_FILES) {
    const referenceFilePath = localeFeatureAbsolutePath(REFERENCE_LOCALE, featureFile);
    const referenceContent = JSON.parse(await readFile(referenceFilePath, 'utf-8')) as LocaleJson;
    const schema = generateSchema(referenceContent, featureFile);
    const schemaFileName = featureFile.replace(/\.json$/, '.schema.json');
    const schemaFilePath = join(SCHEMAS_DIRECTORY, schemaFileName);
    await writeFile(schemaFilePath, `${JSON.stringify(schema, null, 2)}\n`, 'utf-8');

    // Point every locale's copy of this feature at the matching schema. The `$schema` key never
    // reaches the bundle: config/i18n-empty-placeholders.ts strips it at build time.
    const schemaRef = `../../schemas/${schemaFileName}`;
    for (const localeDirectory of localeDirectories) {
      const featurePath = join(LOCALES_DIRECTORY, localeDirectory, featureFile);
      const { $schema: _, ...content } = JSON.parse(
        await readFile(featurePath, 'utf-8'),
      ) as LocaleJson;
      await writeFile(
        featurePath,
        `${JSON.stringify({ $schema: schemaRef, ...content }, null, 2)}\n`,
        'utf-8',
      );
    }

    console.log(styleText('green', `Generated schema at ${schemaFilePath}`));
  }
}

await main();
