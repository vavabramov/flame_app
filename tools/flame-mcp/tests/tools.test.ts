import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { validateBlueprint } from '../../../src/features/blueprint/validate-blueprint';
import { CATALOG_VERSION, BLUEPRINT_SCHEMA_VERSION } from '../src/catalog/index';
import { createServer } from '../src/server';

type ToolResult = { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Record<string, any> };

let client: Client;

before(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverSide);
  client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientSide);
});

after(async () => {
  await client.close();
});

const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as ToolResult;

describe('tool list', () => {
  it('exposes exactly the two read-only tools of this phase', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ['get_capabilities', 'get_templates']);
    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} is read-only`);
      assert.equal(tool.annotations?.destructiveHint, false);
      assert.equal(tool.annotations?.openWorldHint, false);
      assert.ok(tool.description && tool.description.length > 40);
    }
  });

  it('has no apply, SQL, shell, file or user-context tools', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name).join(' ');
    assert.doesNotMatch(names, /apply|sql|shell|exec|file|read_|write|delete|user_context|fetch/i);
  });

  it('rejects calls to tools that do not exist', async () => {
    const result = await call('apply_draft', { draftId: 'x' }).catch((e: Error) => ({ isError: true, message: e.message }));
    assert.equal((result as { isError?: boolean }).isError, true);
  });
});

describe('get_capabilities', () => {
  it('reports the real catalog and the manual transfer limits', async () => {
    const result = await call('get_capabilities');
    assert.notEqual(result.isError, true);
    const data = result.structuredContent!;
    assert.deepEqual(JSON.parse(result.content[0].text), data);
    assert.deepEqual(data.blueprint, { kind: 'flame.habit-blueprint', schemaVersion: BLUEPRINT_SCHEMA_VERSION, catalogVersion: CATALOG_VERSION });
    assert.deepEqual(data.templates, [{ id: 'read-more', version: '1.0.0' }]);
    assert.deepEqual(data.tools, ['get_capabilities', 'get_templates']);
    assert.equal(data.supportedTransferMode, 'manual-json');
    for (const limit of ['no-live-phone-database', 'no-cloud-sync', 'no-apply-to-phone', 'no-user-data-access']) {
      assert.ok(data.limitations.includes(limit), limit);
    }
    assert.deepEqual(
      data.modules.map((m: { id: string }) => m.id).sort(),
      ['logic.manual_check_in', 'metric.count', 'metric.duration_minutes', 'widget.metric_entry', 'widget.metric_summary'],
    );
  });

  it('contains no user data or phone state', async () => {
    const text = (await call('get_capabilities')).content[0].text;
    assert.doesNotMatch(text, /habitId|completion"|lapse"|localDate|streak":\s*\d/);
  });

  it('rejects unexpected arguments', async () => {
    const result = await call('get_capabilities', { path: '/etc/passwd' });
    assert.equal(result.isError, true);
  });
});

describe('get_templates', () => {
  it('returns Read More with its fields, defaults, limits and unsupported features', async () => {
    const result = await call('get_templates');
    assert.notEqual(result.isError, true);
    const [template, ...rest] = result.structuredContent!.templates;
    assert.equal(rest.length, 0);
    assert.equal(template.id, 'read-more');
    assert.equal(template.version, '1.0.0');
    assert.deepEqual(template.direction.allowed, ['build']);
    assert.deepEqual(template.defaults, {
      name: 'Read',
      scheduleDays: [0, 1, 2, 3, 4, 5, 6],
      reminder: null,
      dailyTargetMinutes: 15,
      icon: 'book-open',
      colorToken: 'ember',
    });
    assert.equal(template.checkIn.targetAutomaticallyCompletesHabit, false);
    assert.ok(template.unsupported.some((u: string) => /timer/.test(u)));
    assert.ok(template.unsupported.some((u: string) => /weekly quota/.test(u)));
    assert.ok(template.clarifyingQuestions.every((q: { options: string[] }) => q.options.length >= 2 && q.options.length <= 5));
  });

  it('filters by an exact template ID', async () => {
    const result = await call('get_templates', { templateId: 'read-more' });
    assert.equal(result.structuredContent!.templates.length, 1);
  });

  it('rejects unknown template IDs and extra keys', async () => {
    assert.equal((await call('get_templates', { templateId: 'quit-smoking' })).isError, true);
    assert.equal((await call('get_templates', { templateId: 'read-more', include: 'everything' })).isError, true);
  });

  it('advertises defaults and metrics that the app validator accepts', async () => {
    const { templates } = (await call('get_templates')).structuredContent!;
    const t = templates[0];
    const blueprint = {
      schemaVersion: '1.0.0',
      kind: 'flame.habit-blueprint',
      blueprintId: 'test_from_templates',
      catalogVersion: '1.0.0',
      template: { id: t.id, version: t.version },
      habit: { name: t.defaults.name, direction: 'build', schedule: { kind: 'weekdays', days: t.defaults.scheduleDays }, reminder: null },
      metrics: t.metrics.map((m: Record<string, unknown>) => ({
        ...m,
        goal: m.id === 'reading_minutes' ? { kind: 'daily_target', value: t.defaults.dailyTargetMinutes } : null,
      })),
      widgets: [
        { id: 'daily_metric_entry', moduleId: 'widget.metric_entry', version: '1.0.0', config: { metricIds: ['reading_minutes', 'pages_read'], allowEditToday: true } },
        { id: 'metric_summary', moduleId: 'widget.metric_summary', version: '1.0.0', config: { metricIds: ['reading_minutes', 'pages_read'], period: 'last_30_days_and_all_time' } },
      ],
      checkIn: {
        moduleId: t.checkIn.moduleId,
        version: t.checkIn.version,
        completionPolicy: t.checkIn.completionPolicy,
        targetAutomaticallyCompletesHabit: t.checkIn.targetAutomaticallyCompletesHabit,
      },
      presentation: { icon: t.defaults.icon, colorToken: t.defaults.colorToken },
    };
    const result = validateBlueprint(blueprint);
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid, true);
  });
});
