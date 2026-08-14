# Execution boundary

Only `packages/runner` may execute commands or mutate a target repository at runtime. The boundary is responsible for validating working directories, arguments, timeouts, output limits, and execution mode. A transport handler, source-control adapter, model provider, or state transition must request runner work through typed contracts rather than invoking a shell directly.

`observe` is the default mode. It can inspect and report but cannot write. Enabling `fix` requires both an explicit mode and repository policy permission.

## Runners

`RepositoryBoundary` holds the filesystem and git behavior shared by every runner; subclasses decide only how a repository command is executed:

- **`LocalRunner`** runs commands on the host. It is intended for trusted local development only.
- **`ContainerRunner`** runs commands in an ephemeral sandbox (Docker or a compatible engine), with CPU, memory, and network limits from repository policy.

Both report a `RunnerDescription` that is recorded in evidence, so a claim of isolated verification is auditable rather than assumed.

Git inspection runs in the trusting process because its argv is fixed by the runner package. Repository-supplied commands are the untrusted ones, and those are what isolation moves into a sandbox.

`createRunner` and `runnerOptionsFromPolicy` are the only mapping from policy to a concrete boundary. Composition roots call both; nothing else constructs a runner.

## Hosted sandboxes

Hosted execution follows the same rule through the provider-neutral `RunnerPool`:

- every lease has a maximum lifetime;
- global and per-repository quota checks run before provisioning;
- expired sandboxes are stopped by an expiry sweep;
- the agent receives only the ordinary `Runner` contract.

Provider credentials are constructor state of a vendor adapter and never enter a request, lease snapshot, agent state, or log. A composition root may schedule and release a lease, but it cannot execute a command itself. See [Sandbox providers](/reference/sandbox-providers) for the provider evaluation.

## Model transports

`packages/models` follows the same adapter rule for AI providers: one `ModelProvider` contract over OpenAI, Anthropic, Google, AI Gateway, and OpenAI-compatible endpoints. Credentials come only from fixed provider-specific environment variables, and a custom endpoint can only come from the operator-owned `AGENT_ZERO_MODEL_BASE_URL` environment variable. The agent runtime sees neither SDK objects nor credentials. See [Model providers](/reference/model-providers).
