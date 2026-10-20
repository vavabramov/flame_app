/**
 * Scripted planner workflows (spec §14): the exact tool sequence the prompt asks
 * the model to follow, end to end, checked against the app's own import path.
 * Model behaviour itself is verified manually in Claude Desktop.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { parseBlueprintJson } from '../../../src/features/blueprint/validate-blueprint';
import { createServer } from '../src/server';

type Result = { isError?: boolean; content: { text: string }[]; structuredContent?: Record<string, any> };

let client: Client;
beforeEach(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverSide);
  client = new Client({ name: 'workflow-test', version: '1.0.0' });
  await client.connect(clientSide);
});

const call = async (name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as Result;

async function discover() {
  const caps = (await call('get_capabilities')).structuredContent!;
  const template = (await call('get_templates')).structuredContent!.templates[0];
  return { caps, template };
}

describe('planner workflows', () => {
  it('1. "I want to read more" → target clarified → valid draft → export → importable', async () => {
    const { caps, template } = await discover();
    assert.deepEqual(caps.templates, [{ id: 'read-more', version: '1.0.0' }]);
    // The model offers the target options from the catalog; the user picks 20.
    assert.ok(template.clarifyingQuestions.find((q: { id: string }) => q.id === 'target').options.includes('20'));

    const draft = (await call('create_draft', { templateId: template.id, templateVersion: template.version, dailyTargetMinutes: 20 }))
      .structuredContent!;
    assert.equal(draft.validationStatus, 'valid');

    // The user then asks for weekday evenings with a reminder.
    await call('update_draft', { draftId: draft.draftId, patch: { scheduleDays: [1, 2, 3, 4, 5], reminderTime: '21:00' } });
    const validated = (await call('validate_draft', { draftId: draft.draftId })).structuredContent!;
    assert.equal(validated.validationStatus, 'valid');
    assert.deepEqual(validated.validation.warnings.map((w: { code: string }) => w.code), ['reminder_needs_permission']);

    const exported = (await call('export_draft', { draftId: draft.draftId, format: 'json' })).structuredContent!;
    const imported = parseBlueprintJson(exported.json);
    assert.equal(imported.valid, true);
    assert.deepEqual(imported.value!.habit.schedule.days, [1, 2, 3, 4, 5]);
    assert.deepEqual(imported.value!.metrics[0].goal, { kind: 'daily_target', value: 20 });
  });

  it('2. "I don’t want to count pages" → pages stay optional, nothing to switch off', async () => {
    const { template } = await discover();
    const pages = template.metrics.find((m: { id: string }) => m.id === 'pages_read');
    assert.equal(pages.required, false);
    assert.ok(template.notes.some((n: string) => /Pages are always optional/.test(n)));
    // There is no field to remove pages; trying is rejected rather than ignored.
    const r = await call('create_draft', { templateId: 'read-more', templateVersion: '1.0.0', trackPages: false });
    assert.equal(r.isError, true);
    const ok = (await call('create_draft', { templateId: 'read-more', templateVersion: '1.0.0' })).structuredContent!;
    assert.equal(ok.blueprint.metrics[1].required, false);
  });

  it('3. a timer or weekly quota → reported as unsupported, with no way to configure it', async () => {
    const { template } = await discover();
    assert.ok(template.unsupported.some((u: string) => /timer/.test(u)));
    assert.ok(template.unsupported.some((u: string) => /weekly quota/.test(u)));
    for (const extra of [{ timer: true }, { weeklyQuota: 3 }, { autoComplete: true }]) {
      const r = await call('create_draft', { templateId: 'read-more', templateVersion: '1.0.0', ...extra });
      assert.equal(r.isError, true, JSON.stringify(extra));
    }
  });

  it('6. Read More as a Break habit → validation explains, export refuses', async () => {
    const draft = (await call('create_draft', { templateId: 'read-more', templateVersion: '1.0.0', direction: 'break' })).structuredContent!;
    assert.equal(draft.validationStatus, 'invalid');
    assert.match(draft.validation.errors[0].message, /Build habit/);
    const exported = await call('export_draft', { draftId: draft.draftId, format: 'json' });
    assert.equal(exported.isError, true);
  });

  it('unknown templates such as quit-smoking are not offered', async () => {
    const { caps } = await discover();
    assert.ok(!caps.templates.some((t: { id: string }) => t.id !== 'read-more'));
    assert.equal((await call('get_templates', { templateId: 'quit-smoking' })).isError, true);
    assert.equal((await call('create_draft', { templateId: 'quit-smoking', templateVersion: '1.0.0' })).isError, true);
  });
});
