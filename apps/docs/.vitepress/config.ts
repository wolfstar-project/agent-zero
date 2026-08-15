import { defineConfig } from 'vitepress';

// The documentation site for Agent Zero. Content lives beside this config as
// plain markdown; the canonical architecture and provider references stay in
// the repository-root docs/ directory and are pulled in with @include so
// agents and the site read the same source.
export default defineConfig({
  title: 'Agent Zero',
  description:
    'An open-source autonomous engineer that finds, fixes, and verifies problems in pull requests.',
  // GitHub Pages serves project sites from a sub-path; local builds stay at /.
  base: process.env.DOCS_BASE ?? '/',
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Reference', link: '/reference/cli' },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/wolfstar-project/agent-zero' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/wolfstar-project/agent-zero/edit/main/apps/docs/:path',
      text: 'Edit this page on GitHub',
    },
    outline: { level: [2, 3] },
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Agent Zero?', link: '/guide/introduction' },
            { text: 'Tech stack', link: '/guide/tech-stack' },
          ],
        },
        {
          text: 'Getting started',
          items: [
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Environment variables', link: '/guide/environment-variables' },
          ],
        },
        {
          text: 'Codebase',
          items: [
            { text: 'Structure', link: '/guide/codebase/structure' },
            { text: 'Dependencies', link: '/guide/codebase/dependencies' },
            { text: 'Formatting and linting', link: '/guide/codebase/formatting-linting' },
            { text: 'Agent Skills', link: '/guide/codebase/agent-skills' },
          ],
        },
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/guide/architecture/overview' },
            { text: 'State machine', link: '/guide/architecture/state-machine' },
            { text: 'Execution boundary', link: '/guide/architecture/execution-boundary' },
            { text: 'Issue-to-PR workflow', link: '/guide/architecture/issue-to-pr' },
            { text: 'Adding a capability', link: '/guide/architecture/adding-a-capability' },
          ],
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Repository policy', link: '/guide/configuration' },
            { text: 'Safety model', link: '/guide/safety' },
          ],
        },
        {
          text: 'Database',
          items: [{ text: 'Postgres and Drizzle', link: '/guide/database' }],
        },
        {
          text: 'API',
          items: [
            { text: 'Overview', link: '/guide/api/overview' },
            { text: 'Define endpoints', link: '/guide/api/define-endpoints' },
            { text: 'Use the API from a client', link: '/guide/api/use-from-client' },
            { text: 'Protect endpoints', link: '/guide/api/protect-endpoints' },
          ],
        },
        {
          text: 'Authentication',
          items: [
            { text: 'Overview', link: '/guide/authentication/overview' },
            { text: 'GitHub OAuth', link: '/guide/authentication/oauth' },
            { text: 'Permissions', link: '/guide/authentication/permissions' },
          ],
        },
        {
          text: 'Organizations',
          items: [{ text: 'Organizations', link: '/guide/organizations' }],
        },
        {
          text: 'Frontend',
          items: [{ text: 'Dashboard app', link: '/guide/frontend' }],
        },
        {
          text: 'Mails',
          items: [{ text: 'Mail templates and providers', link: '/guide/mails' }],
        },
        {
          text: 'Internationalization',
          items: [{ text: 'Locales and tooling', link: '/guide/internationalization' }],
        },
        {
          text: 'Going to production',
          items: [{ text: 'Deployment', link: '/guide/deployment' }],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'CLI', link: '/reference/cli' },
            { text: 'Model providers', link: '/reference/model-providers' },
            { text: 'Source-control providers', link: '/reference/source-control-providers' },
            { text: 'Sandbox providers', link: '/reference/sandbox-providers' },
          ],
        },
      ],
    },
  },
});
