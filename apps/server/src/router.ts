import { AgentZero } from '@agent-zero/agent';
import { loadConfig } from '@agent-zero/config';
import { modelFromEnvironment } from '@agent-zero/models';
import { LocalRunner } from '@agent-zero/runner';
import type { TaskResult } from '@agent-zero/shared';
import { z } from 'zod';

export const tasks = new Map<string, TaskResult>();

export const taskInput = z.object({
  repository: z.string().min(1),
  feedback: z.string().min(1),
  mode: z.enum(['observe', 'suggest', 'fix', 'autonomous']),
  source: z.string().optional(),
  files: z.array(z.string()).optional(),
});

export function health() {
  return { status: 'ok' as const, service: 'agent-zero', version: '0.1.0' };
}

export function listTasks() {
  return { tasks: [...tasks.values()] };
}

export function getTask(id: string): TaskResult | undefined {
  return tasks.get(id);
}

export async function createTask(input: z.infer<typeof taskInput>): Promise<TaskResult> {
  const config = await loadConfig(input.repository);
  const agent = new AgentZero({
    model: modelFromEnvironment(config.model.name, config.model.baseUrl),
    runner: new LocalRunner(input.repository),
    config,
  });
  const result = await agent.run({
    repository: input.repository,
    feedback: input.feedback,
    mode: input.mode,
    ...(input.source ? { source: input.source } : {}),
    ...(input.files ? { files: input.files } : {}),
  });
  tasks.set(result.id, result);
  return result;
}
