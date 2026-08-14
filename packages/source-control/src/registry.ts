import type { ProviderKind, SourceControlProvider, WebhookHeaders } from './contracts.js';
import { bitbucketCloudProvider } from './providers/bitbucket-cloud.js';
import { bitbucketDataCenterProvider } from './providers/bitbucket-data-center.js';
import { giteaProvider } from './providers/gitea.js';
import { githubProvider } from './providers/github.js';
import { gitlabProvider } from './providers/gitlab.js';

/**
 * Every provider adapter, in recognition order.
 *
 * Gitea and Forgejo send GitHub compatibility headers, so their adapter must be consulted before
 * GitHub's; the GitHub adapter also declines deliveries that carry a Gitea or Forgejo header.
 */
const providers: readonly SourceControlProvider[] = [
  giteaProvider,
  gitlabProvider,
  bitbucketCloudProvider,
  bitbucketDataCenterProvider,
  githubProvider,
];

const byKind = new Map<ProviderKind, SourceControlProvider>(
  providers.map((provider) => [provider.kind, provider]),
);

/** The adapter for one provider. Adapters are stateless; credentials live in publisher options. */
export function createProvider(kind: ProviderKind): SourceControlProvider {
  const provider = byKind.get(kind);
  if (!provider) throw new Error(`Unknown source-control provider: ${kind}`);
  return provider;
}

export function allProviders(): readonly SourceControlProvider[] {
  return providers;
}

/**
 * Route an inbound delivery to the adapter that recognizes its headers.
 *
 * `kinds` restricts routing to the providers a deployment actually configured, so an
 * unconfigured provider's deliveries are rejected instead of half-processed.
 */
export function providerForDelivery(
  headers: WebhookHeaders,
  kinds?: readonly ProviderKind[],
): SourceControlProvider | undefined {
  return providers.find(
    (provider) =>
      (kinds === undefined || kinds.includes(provider.kind)) && provider.recognizes(headers),
  );
}
