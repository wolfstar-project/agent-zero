---
layout: home

hero:
  name: Agent Zero
  text: An autonomous engineer for pull requests
  tagline: Finds, fixes, and verifies problems in pull requests — with evidence, not assertions.
  image:
    src: https://cdn.wolfstar.rocks/wolfstar-assets/wolfstar.png
    alt: WolfStar logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/installation
    - theme: alt
      text: What is Agent Zero?
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/wolfstar-project/agent-zero

features:
  - title: Evidence over assertion
    details: Every fix carries the commands that verified it. Feedback is never treated as truth merely because it came from a human or an AI reviewer.
  - title: Safe by default
    details: The observe mode inspects and reports and never writes to a target repository. Automatic fixes require confidence, an allowed change-risk class, repository permission, and verification.
  - title: One execution boundary
    details: A single runner package is the only code allowed to run commands or mutate a checkout, locally or inside an isolated sandbox.
  - title: Provider-neutral
    details: GitHub, GitLab, Bitbucket, and Gitea adapters on one side; OpenAI, Anthropic, Google, and OpenAI-compatible model providers on the other. The runtime depends on neither.
  - title: Issues become pull requests
    details: A labeled, repository-scoped issue can be investigated, implemented on an isolated branch, verified, and published as a pull request carrying its acceptance criteria and evidence.
  - title: One deployable app
    details: A single Nuxt dashboard serves the UI, a typed oRPC control plane, an OpenAPI surface, and authentication from one origin.
---
