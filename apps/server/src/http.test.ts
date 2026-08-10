import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createTaskResponse, evidenceResponse, taskResponse } from './http.js';
import { runTask, tasks } from './router.js';

let checkout: string;

beforeEach(async () => {
  tasks.clear();
  checkout = await mkdtemp(join(tmpdir(), 'agent-zero-server-http-'));
  await writeFile(join(checkout, 'package.json'), JSON.stringify({ scripts: {} }), 'utf8');
});

function postRequest(body: string): Request {
  return new Request('http://localhost/tasks', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
}

/** The HTTP status of an explicit `Response`, or undefined for plain data payloads. */
function statusOf(value: unknown): number | undefined {
  return value instanceof Response ? value.status : undefined;
}

describe('taskResponse', () => {
  it('serves a stored task', async () => {
    const result = await runTask({ repository: checkout, feedback: 'x', mode: 'observe' });
    expect(taskResponse(result.id)).toBe(result);
  });

  it('answers 404 for an unknown or missing id', () => {
    expect(statusOf(taskResponse('az_missing'))).toBe(404);
    expect(statusOf(taskResponse(undefined))).toBe(404);
  });
});

describe('evidenceResponse', () => {
  it('serves the rendered evidence as markdown', async () => {
    const result = await runTask({ repository: checkout, feedback: 'x', mode: 'observe' });
    const response = evidenceResponse(result.id);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/markdown');
    await expect(response.text()).resolves.toContain('## Agent Zero');
  });

  it('answers 404 for an unknown task', () => {
    expect(evidenceResponse('az_missing').status).toBe(404);
  });
});

describe('createTaskResponse', () => {
  it('rejects a body that is not JSON', async () => {
    expect(statusOf(await createTaskResponse(postRequest('not json')))).toBe(400);
  });

  it('rejects input the task schema refuses', async () => {
    const outcome = await createTaskResponse(
      postRequest(JSON.stringify({ repository: checkout, feedback: 'x', mode: 'yolo' })),
    );
    expect(statusOf(outcome)).toBe(400);
    expect(tasks.size).toBe(0);
  });

  it('runs a validated task and stores its evidence', async () => {
    const outcome = await createTaskResponse(
      postRequest(JSON.stringify({ repository: checkout, feedback: 'x', mode: 'observe' })),
    );
    expect(statusOf(outcome)).toBeUndefined();
    expect(tasks.size).toBe(1);
  });
});
