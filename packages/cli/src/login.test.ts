import { describe, expect, it } from 'vitest';

import { DEVICE_CLIENT_ID, pollDeviceToken, requestDeviceCode, type DeviceFetch } from './login.js';

const ORIGIN = 'https://zero.internal.test';

const DISABLED_FLOW_ERROR = /device flow enabled/i;
const INCOMPLETE_ERROR = /incomplete/i;
const STORE_DOWN_ERROR = /the store is down/;
const NO_TOKEN_ERROR = /returned no token/i;

/** One canned response, plus a record of what the flow actually asked for. */
function stubFetch(
  responses: readonly { status: number; body: unknown }[],
): DeviceFetch & { calls: { url: string; body: unknown }[] } {
  const calls: { url: string; body: unknown }[] = [];
  let index = 0;
  const implementation = (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(typeof init.body === 'string' ? init.body : '{}') });
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return Promise.resolve(
      new Response(JSON.stringify(next?.body ?? {}), {
        status: next?.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return Object.assign(implementation, { calls });
}

const completeCodeResponse = {
  device_code: 'dev-code',
  user_code: 'ABCD-EFGH',
  verification_uri: '/device',
  verification_uri_complete: '/device?user_code=ABCD-EFGH',
  expires_in: 600,
  interval: 5,
};

describe('requestDeviceCode', () => {
  it('resolves the verification path against the deployment origin', async () => {
    const fetchImplementation = stubFetch([{ status: 200, body: completeCodeResponse }]);

    const request = await requestDeviceCode(ORIGIN, fetchImplementation);

    expect(request).toMatchObject({
      deviceCode: 'dev-code',
      userCode: 'ABCD-EFGH',
      verificationUri: `${ORIGIN}/device`,
      verificationUriComplete: `${ORIGIN}/device?user_code=ABCD-EFGH`,
      expiresInSeconds: 600,
      intervalSeconds: 5,
    });
    expect(fetchImplementation.calls[0]).toMatchObject({
      url: `${ORIGIN}/api/auth/device/code`,
      body: { client_id: DEVICE_CLIENT_ID },
    });
  });

  it('says the flow may be disabled rather than surfacing a bare status', async () => {
    const fetchImplementation = stubFetch([{ status: 404, body: {} }]);

    await expect(requestDeviceCode(ORIGIN, fetchImplementation)).rejects.toThrow(
      DISABLED_FLOW_ERROR,
    );
  });

  it('refuses a response missing the codes it has to display and poll with', async () => {
    const fetchImplementation = stubFetch([
      { status: 200, body: { device_code: 'dev-code', expires_in: 600 } },
    ]);

    await expect(requestDeviceCode(ORIGIN, fetchImplementation)).rejects.toThrow(INCOMPLETE_ERROR);
  });

  it('falls back to RFC 8628 defaults when the deployment omits the timings', async () => {
    const fetchImplementation = stubFetch([
      {
        status: 200,
        body: { device_code: 'dev-code', user_code: 'ABCD', verification_uri: '/device' },
      },
    ]);

    const request = await requestDeviceCode(ORIGIN, fetchImplementation);

    expect(request.expiresInSeconds).toBe(600);
    expect(request.intervalSeconds).toBe(5);
    expect(request.verificationUriComplete).toBeUndefined();
  });
});

describe('pollDeviceToken', () => {
  it('returns the minted session once the request is approved', async () => {
    const fetchImplementation = stubFetch([
      { status: 200, body: { access_token: 'session-token', expires_in: 3_600 } },
    ]);

    await expect(pollDeviceToken(ORIGIN, 'dev-code', fetchImplementation)).resolves.toEqual({
      kind: 'token',
      token: { accessToken: 'session-token', expiresInSeconds: 3_600 },
    });
    expect(fetchImplementation.calls[0]).toMatchObject({
      url: `${ORIGIN}/api/auth/device/token`,
      body: {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: 'dev-code',
        client_id: DEVICE_CLIENT_ID,
      },
    });
  });

  it.each([
    ['authorization_pending', 'pending'],
    ['slow_down', 'slowDown'],
    ['access_denied', 'denied'],
    ['expired_token', 'expired'],
  ])('maps %s to a %s outcome rather than throwing', async (error, kind) => {
    const fetchImplementation = stubFetch([{ status: 400, body: { error } }]);

    await expect(pollDeviceToken(ORIGIN, 'dev-code', fetchImplementation)).resolves.toEqual({
      kind,
    });
  });

  it('throws for a failure the device flow does not define, so it cannot look like waiting', async () => {
    const fetchImplementation = stubFetch([
      { status: 500, body: { error: 'server_error', error_description: 'the store is down' } },
    ]);

    await expect(pollDeviceToken(ORIGIN, 'dev-code', fetchImplementation)).rejects.toThrow(
      STORE_DOWN_ERROR,
    );
  });

  it('refuses a success that carries no token', async () => {
    const fetchImplementation = stubFetch([{ status: 200, body: { expires_in: 3_600 } }]);

    await expect(pollDeviceToken(ORIGIN, 'dev-code', fetchImplementation)).rejects.toThrow(
      NO_TOKEN_ERROR,
    );
  });
});
