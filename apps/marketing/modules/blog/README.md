# blog module (reserved)

Not built yet. This directory reserves the shape a blog would take, following the same
`modules/<feature>/{components,composables}` convention as `home` and `contact`.

When there is a first post to publish:

1. Content: `content/en/blog/<slug>.md` and `content/it/blog/<slug>.md`, with frontmatter matching
   a new `blog` collection defined in `content.config.ts` (see the `legal` collection there for the
   pattern — one collection per locale, `source.prefix: '/blog'`).
2. Routes: `app/pages/blog/index.vue` (listing) and `app/pages/blog/[slug].vue` (post), querying the
   collection with `queryCollection('blog_' + locale)`.
3. Components: `components/PostCard.vue`, `components/PostList.vue` here.
4. Add `/blog` to `apps/marketing/modules/shared/utils/site-navigation.ts` and to
   `nuxt.config.ts`'s `sitemap.sources` if the routes need dynamic sitemap discovery.

Do not add components here until a page actually renders them — an unused component module is
dead code the same as anywhere else in this repository.
