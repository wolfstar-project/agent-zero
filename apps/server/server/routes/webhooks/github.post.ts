import { redactSecrets } from '@agent-zero/shared';
import { defineHandler } from 'nitro';
import type { EventHandlerWithFetch } from 'nitro/h3';

import { githubTokenFromEnvironment, ingestWebhook } from '../../../src/router.js';
import { json, messageOf } from '../../utils/respond.js';
import { deliveryClaimStore, taskStore } from '../../utils/store.js';

/**
 * The production GitHub webhook entry point at `POST /webhooks/github`.
 *
 * This route only adapts transport: it maps headers and body onto the provider-neutral webhook
 * contract and injects the deployment's durable stores. Signature verification, provider
 * routing, policy checks, delivery claims, and everything that can execute repository work stay
 * behind `ingestWebhook`, and the durable `deliveryClaimStore` is what lets a redelivered issue
 * event observe the recorded outcome across restarts and other instances instead of starting a
 * duplicate run. Without a configured secret or checkout the route fails closed and ingests
 * nothing.
 */
const route: EventHandlerWithFetch = defineHandler(async (event) => {
  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return json(503, { error: 'GITHUB_WEBHOOK_SECRET is not configured' });
    const checkoutPath = process.env.AGENT_ZERO_CHECKOUT_PATH;
    if (!checkoutPath) return json(503, { error: 'AGENT_ZERO_CHECKOUT_PATH is not configured' });

    const outcome = await ingestWebhook(
      {
        body: await event.req.text(),
        headers: Object.fromEntries(event.req.headers.entries()),
      },
      {
        providers: [{ kind: 'github', secret }],
        checkoutPath,
        store: taskStore,
        deliveryClaims: deliveryClaimStore,
        github: { token: githubTokenFromEnvironment() },
      },
    );

    // The response never carries the run's evidence or result; GitHub's delivery log only needs
    // the disposition, and everything else is reachable through the authenticated control plane.
    if (outcome.status === 'rejected') return json(400, { status: 'rejected' });
    if (outcome.status === 'ignored')
      return json(200, { status: 'ignored', reason: outcome.reason });
    return json(200, { status: 'accepted', taskId: outcome.result.id });
  } catch (error) {
    return json(500, { error: redactSecrets(messageOf(error)) });
  }
});

export default route;
