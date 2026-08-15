# changelog module (reserved)

Not built yet. Agent Zero already publishes release notes as GitHub Releases
(`marketing.footer.changelog` links there today); this module is reserved for the day a
changelog page on the marketing site itself is worth the upkeep of a second source of truth.

If that day comes, prefer generating this page's content from the GitHub Releases feed at build
time over hand-written Markdown — a manually maintained changelog drifts from the real release
history. Follow the `modules/<feature>/{components,composables}` convention used by `home` and
`contact` for whatever renders it.

Do not add components here until a page actually renders them.
