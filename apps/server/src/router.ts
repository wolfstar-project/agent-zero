import { AgentZero } from '@agent-zero/agent';
import { loadConfig } from '@agent-zero/config';
import { modelFromEnvironment } from '@agent-zero/models';
import { LocalRunner } from '@agent-zero/runner';
import type { TaskResult } from '@agent-zero/shared';
import { ORPCError, os } from '@orpc/server';
import { z } from 'zod';

export const tasks = new Map<string, TaskResult>();

const taskInput = z.object({
  repository: z.string().min(1),
  feedback: z.string().min(1),
  mode: z.enum(['observe', 'suggest', 'fix', 'autonomous']),
  source: z.string().optional(),
  files: z.array(z.string()).optional(),
});

export const router = {
  health: os.handler(() => ({ status: 'ok' as const, service: 'agent-zero', version: '0.1.0' })),
  tasks: {
    list: os.handler(() => ({ tasks: [...tasks.values()] })),
    get: os.input(z.object({ id: z.string() })).handler(({ input }) => {
      const task = tasks.get(input.id);
      if (!task) throw new ORPCError('NOT_FOUND', { message: 'Task not found' });
      return task;
    }),
    create: os.input(taskInput).handler(async ({ input }) => {
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
    }),
  },
};

export type AppRouter = typeof router;
