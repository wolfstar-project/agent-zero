export default defineAppConfig({
  docus: {
    name: 'Agent Zero',
    description:
      'An open-source autonomous engineer that finds, fixes, and verifies problems in pull requests.',
    socials: {
      github: 'https://github.com/wolfstar-project/agent-zero',
    },
    github: {
      url: 'https://github.com/wolfstar-project/agent-zero',
      branch: 'main',
      rootDir: 'apps/docs',
    },
  },
  ui: {
    colors: {
      primary: 'green',
      neutral: 'neutral',
    },
  },
});
