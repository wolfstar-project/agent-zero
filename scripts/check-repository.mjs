import { lstat, readFile, readlink, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const requiredFiles = [
  'AGENTS.md',
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
];
const errors = [];

for (const path of requiredFiles) {
  try {
    await lstat(new URL(path, root));
  } catch {
    errors.push(`missing required repository file: ${path}`);
  }
}

const skillsRoot = new URL('.skills/', root);
const entries = await readdir(skillsRoot, { withFileTypes: true });
const skillNames = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (skillNames.length === 0) errors.push('no project Agent Skills found in .skills/');

for (const name of skillNames) {
  const skillPath = new URL(`${name}/SKILL.md`, skillsRoot);
  let source = '';
  try {
    source = await readFile(skillPath, 'utf8');
  } catch {
    errors.push(`missing SKILL.md for ${name}`);
    continue;
  }

  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? '';
  const declaredName = frontmatter.match(/^name:\s*(.+)$/mu)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/mu)?.[1]?.trim();
  if (declaredName !== name) errors.push(`${name}: frontmatter name must match its directory`);
  if (!description) errors.push(`${name}: frontmatter description is required`);
  if (source.split('\n').length > 500) errors.push(`${name}: SKILL.md must stay under 500 lines`);

  const unsafePatterns = [
    /ignore (all |any )?(previous|prior) instructions/iu,
    /rm\s+-rf\s+(?:\/|~|\$HOME)/u,
    /curl[^\n|]*\|\s*(?:sh|bash)/u,
    /print .*?(?:secret|token|credential)/iu,
  ];
  for (const pattern of unsafePatterns) {
    if (pattern.test(source)) errors.push(`${name}: unsafe instruction matched ${pattern}`);
  }

  const linkPath = new URL(`.agents/skills/${name}`, root);
  try {
    const stat = await lstat(linkPath);
    if (!stat.isSymbolicLink()) errors.push(`${name}: .agents/skills entry must be a symlink`);
    const target = (await readlink(linkPath)).replaceAll('\\', '/');
    if (target !== `../../.skills/${name}`)
      errors.push(`${name}: unexpected skill symlink target ${target}`);
  } catch {
    errors.push(`${name}: missing .agents/skills symlink`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Repository metadata valid; ${skillNames.length} Agent Skills available.`);
}
