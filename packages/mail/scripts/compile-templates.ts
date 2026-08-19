// Renders every template under `emails/` to static markup, once, so that sending a message never
// has to. Maizzle renders a Vue SFC by starting a Vite SSR server: that needs a bundler and its
// platform-native binary, a writable working directory, and the package's own directory as the
// working directory — none of which the serverless deployment that sends the mail has. The
// compiled artifact this writes is what `src/mail.ts` ships and substitutes into.
//
// Run through `aube run mail:compile` after editing anything under `emails/`; `mail.test.ts`
// fails when the checked-in artifact no longer matches what the templates render.
import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { render } from '@maizzle/framework';

import {
  mailTemplatePlaceholder,
  type CompiledMailTemplate,
  type CompiledMailTemplates,
} from '../src/util/compiled.ts';
import {
  mailTemplateConditionalFields,
  mailTemplateFields,
  mailTemplateIds,
  mailTemplates,
  type MailTemplateField,
  type MailTemplateId,
} from '../src/util/templates.ts';

/** Templates live beside this script's package, not beside the process that runs it. */
const emailsDirectory = fileURLToPath(new URL('../emails/', import.meta.url));
const compiledArtifactPath = fileURLToPath(
  new URL('../src/util/compiled-templates.json', import.meta.url),
);

/**
 * Every combination of the template's conditional fields being filled, as the subsets of them
 * that are filled — the empty subset first, in declaration order — so each rendered variant is
 * named the way `mailTemplateVariantKey` names the context that selects it.
 */
function fieldSubsets<Id extends MailTemplateId>(
  fields: readonly MailTemplateField<Id>[],
): readonly (readonly MailTemplateField<Id>[])[] {
  return fields.reduce<(readonly MailTemplateField<Id>[])[]>(
    (subsets, field) => [...subsets, ...subsets.map((subset) => [...subset, field])],
    [[]],
  );
}

/**
 * Renders one variant.
 *
 * Filled fields carry a placeholder rather than a sample value: it is non-empty, so the template
 * takes the same branch a real value would, and it survives Vue's escaping, Maizzle's CSS
 * inlining and its plaintext conversion intact, so the sender can substitute into either output.
 */
async function renderVariant<Id extends MailTemplateId>(
  id: Id,
  filled: readonly MailTemplateField<Id>[],
): Promise<CompiledMailTemplate> {
  const { file, fields } = mailTemplates[id];
  const context = Object.fromEntries(
    Object.keys(fields).map((field) => {
      const conditional = fields[field as MailTemplateField<Id>] === 'conditional';
      const empty = conditional && !filled.includes(field as MailTemplateField<Id>);
      return [field, empty ? '' : mailTemplatePlaceholder(field)];
    }),
  );

  const { html, plaintext } = await render(`${emailsDirectory}${file}`, {
    ...context,
    plaintext: true,
  });

  return { html, text: plaintext ?? '' };
}

/** Renders every variant of every template, in registry order. */
export async function compileMailTemplates(): Promise<CompiledMailTemplates> {
  const compiled: Record<string, Record<string, CompiledMailTemplate>> = {};

  for (const id of templateIds) {
    const conditionalFields = mailTemplateConditionalFields(id);
    const variants: Record<string, CompiledMailTemplate> = {};

    for (const filled of fieldSubsets(conditionalFields)) {
      // Sequential rather than concurrent: each render starts its own Vite SSR server, and there
      // are eight of them in total — a pool would cost more to coordinate than it saves.
      variants[filled.join('+')] = await renderVariant(id, filled);
    }

    compiled[id] = variants;
  }

  return compiled as CompiledMailTemplates;
}

if (import.meta.main) {
  const compiled = await compileMailTemplates();
  await writeFile(compiledArtifactPath, `${JSON.stringify(compiled, undefined, 2)}\n`, 'utf8');
  process.stdout.write(
    `Compiled ${templateIds.length} mail templates to ${compiledArtifactPath}\n`,
  );
}
