# anti-slop

Oxlint rules that reject low-evidence TypeScript patterns, vendored from
[dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) at `6d538555cb15` (MIT, see LICENSE).

Upstream ships these to be vendored rather than depended on, so these files are ours to edit.
`tooling/oxc/base.oxlintrc.json` loads the plugin through the existing workspace `lint` and
`lint:fix` scripts. Rules that the repository already passes are enforced; the remaining rules
stay listed as `off` until their existing findings are addressed. Re-sync this directory
deliberately when updating the upstream pin.
