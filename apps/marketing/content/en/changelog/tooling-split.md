---
title: 'One lint config, split by workspace'
description: 'Oxlint and Oxfmt configuration moved into tooling/oxc, with a shared base plus package- and app-specific extensions, and matching lint:fix scripts everywhere.'
version: 'v0.4.0'
date: '2026-08-17'
---

The repository's single root `.oxlintrc.json` worked, but it could not express that Nuxt apps
need Vue-aware rules and published packages need Node-aware ones without either enabling both
everywhere or hand-tuning every workspace separately.

## What shipped

- `tooling/oxc/base.oxlintrc.json` holds the rules every workspace shares; `packages.oxlintrc.json`
  and `apps.oxlintrc.json` extend it with the `node` and `vue` plugins respectively.
- Every workspace's `lint` script now has a matching `lint:fix`, and the root gained the same pair
  of orchestrating scripts through Turborepo.
- Oxfmt's ignore patterns moved into a plain `.oxfmtignore` file, since its own config format
  anchors `ignorePatterns` to the directory the config file lives in.
