import type { AuditEvent } from '@agent-zero/api';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import AuditTable from '~~/modules/audit/components/Table.vue';

const RECORDED: AuditEvent[] = [
  {
    id: 'audit_1',
    occurredAt: '2026-08-09T10:00:00.000Z',
    actor: { kind: 'principal', name: 'release-manager' },
    action: 'task.created',
    outcome: 'success',
    subject: { type: 'task', id: 'az_1' },
    metadata: { repository: 'acme/app', mode: 'observe' },
  },
  {
    id: 'audit_2',
    occurredAt: '2026-08-09T09:59:00.000Z',
    actor: { kind: 'principal', name: 'ci' },
    action: 'task.create',
    outcome: 'denied',
    metadata: { reason: 'mode-not-granted' },
  },
];

describe('AuditTable', () => {
  it('renders one row per recorded action, with actor and outcome', async () => {
    const wrapper = await mountSuspended(AuditTable, { props: { events: RECORDED } });

    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.text()).toContain('release-manager');
    expect(wrapper.text()).toContain('task.created');
    expect(wrapper.text()).toContain('task:az_1');
    expect(wrapper.text()).toContain('denied');
  });

  it('explains an empty trail rather than rendering a bare table', async () => {
    const wrapper = await mountSuspended(AuditTable, { props: { events: [] } });

    expect(wrapper.find('tbody').exists()).toBe(false);
    expect(wrapper.text()).toContain('No actions recorded yet');
  });

  it('offers a retry for a failure the reader can do something about', async () => {
    const wrapper = await mountSuspended(AuditTable, {
      props: { events: [], error: 'generic' as const },
    });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('offers no retry when the refusal is the reader’s own role', async () => {
    const wrapper = await mountSuspended(AuditTable, {
      props: { events: [], error: 'forbidden' as const },
    });

    // Retrying cannot grant a role, so the button that implies it would is absent.
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.text()).toContain('admin role');
  });
  it('reorders the trail when a column header is used', async () => {
    const wrapper = await mountSuspended(AuditTable, { props: { events: RECORDED } });

    // Second header is Actor; ascending puts `ci` above `release-manager`.
    await wrapper.findAll('thead button')[1]?.trigger('click');

    await vi.waitFor(() => {
      expect(wrapper.findAll('tbody tr')[0]?.text()).toContain('ci');
    });
    expect(wrapper.findAll('thead th')[1]?.attributes('aria-sort')).toBe('ascending');
  });

  it('narrows the trail to what the filter matches', async () => {
    const wrapper = await mountSuspended(AuditTable, { props: { events: RECORDED } });

    await wrapper.get('input[type="search"]').setValue('release-manager');

    await vi.waitFor(() => {
      expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    });
    expect(wrapper.text()).toContain('task.created');
  });

  it('says so when the filter matches nothing, rather than looking empty', async () => {
    const wrapper = await mountSuspended(AuditTable, { props: { events: RECORDED } });

    await wrapper.get('input[type="search"]').setValue('nothing-matches-this');

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('No rows match this filter.');
    });
    // The empty-trail copy would be a lie here: the trail has entries, the filter hides them.
    expect(wrapper.text()).not.toContain('No actions recorded yet');
  });
});
