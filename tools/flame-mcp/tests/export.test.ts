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
  client = new Client({ name: 'export-test', version: '1.0.0' });
  await client.connect(clientSide);
});

const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })) as Result;
const newDraft = async (params: Record<string, unknown> = {}) =>
  (await call('create_draft', { templateId: 'read-more', templateVersion: '1.0.0', ...params })).structuredContent!.draftId as string;

describe('export_draft', () => {
  it('returns JSON text that the app accepts as-is', async () => {
    const draftId = await newDraft({ name: '  Read  before bed ', dailyTargetMinutes: 20, scheduleDays: [5, 1] });
    const r = await call('export_draft', { draftId, format: 'json' });
    assert.notEqual(r.isError, true);

    const data = r.structuredContent!;
    assert.equal(r.content[0].text, data.json); // the JSON itself comes first, verbatim
    assert.equal(data.format, 'json');
    assert.equal(data.transfer, 'manual');
    assert.equal(data.sizeBytes, Buffer.byteLength(data.json, 'utf8'));
    assert.equal(data.suggestedFileName, `flame-${draftId}.json`);

    // Independent check with the app's own import path (size limit + parse + validation).
    const imported = parseBlueprintJson(data.json);
    assert.deepEqual(imported.errors, []);
    assert.equal(imported.valid, true);
    assert.equal(imported.value!.habit.name, 'Read before bed'); // normalized
    assert.deepEqual(imported.value!.habit.schedule.days, [1, 5]);
    assert.deepEqual(imported.value!.metrics[0].goal, { kind: 'daily_target', value: 20 });
  });

  it('always re-validates, including after an update', async () => {
    const draftId = await newDraft();
    await call('update_draft', { draftId, patch: { name: 'Read daily' } });
    const r = await call('export_draft', { draftId, format: 'json' });
    assert.notEqual(r.isError, true);
    assert.equal(r.structuredContent!.revision, 2);
    assert.equal(JSON.parse(r.structuredContent!.json).habit.name, 'Read daily');
    // Export validated the new revision.
    assert.equal((await call('get_draft', { draftId })).structuredContent!.validationStatus, 'valid');
  });

  it('refuses to export an invalid draft and says why', async () => {
    const draftId = await newDraft();
    await call('update_draft', { draftId, patch: { direction: 'break' } });
    const r = await call('export_draft', { draftId, format: 'json' });
    assert.equal(r.isError, true);
    assert.equal(r.structuredContent!.error.code, 'draft_invalid');
    assert.deepEqual(r.structuredContent!.error.details.errors.map((e: { code: string }) => e.code), ['incompatible_direction']);
    assert.equal(r.structuredContent!.json, undefined);
  });

  it('accepts only the json format and server-shaped IDs, and no file paths', async () => {
    const draftId = await newDraft();
    for (const args of [
      { draftId, format: 'yaml' },
      { draftId },
      { draftId, format: 'json', path: '/tmp/out.json' },
      { draftId, format: 'json', fileName: '../../.ssh/authorized_keys' },
      { draftId: '../../etc/passwd', format: 'json' },
    ]) {
      assert.equal((await call('export_draft', args)).isError, true, JSON.stringify(args));
    }
    const missing = await call('export_draft', { draftId: `draft_${'f'.repeat(32)}`, format: 'json' });
    assert.equal(missing.structuredContent!.error.code, 'draft_not_found');
  });

  it('never claims the habit was installed on the phone', async () => {
    const draftId = await newDraft();
    const r = await call('export_draft', { draftId, format: 'json' });
    const text = r.content.map((c) => c.text).join('\n');
    assert.doesNotMatch(text, /\b(installed|imported|added to (your )?(phone|iphone|flame))\b/i);
    assert.match(r.content[1].text, /Import/);
  });
});
