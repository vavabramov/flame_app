import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { validateBlueprint } from '../src/blueprint/index';
import { DraftStore } from '../src/drafts/draft-store';
import { MAX_DRAFTS } from '../src/security/input-limits';
import { createServer } from '../src/server';

type Result = { isError?: boolean; content: { text: string }[]; structuredContent?: Record<string, any> };

let client: Client;

beforeEach(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer(new DraftStore(() => new Date('2026-10-20T09:00:00.000Z'))).connect(serverSide);
  client = new Client({ name: 'drafts-test', version: '1.0.0' });
  await client.connect(clientSide);
});

const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })) as Result;
const create = (params: Record<string, unknown> = {}) =>
  call('create_draft', { templateId: 'read-more', templateVersion: '1.0.0', ...params });
const codes = (r: Result) => (r.structuredContent?.validation?.errors ?? r.structuredContent?.errors ?? []).map((e: { code: string }) => e.code);

describe('create_draft', () => {
  it('creates a valid Read More draft with safe defaults and a server-generated ID', async () => {
    const r = await create();
    assert.notEqual(r.isError, true);
    const d = r.structuredContent!;
    assert.match(d.draftId, /^draft_[a-f0-9]{32}$/);
    assert.equal(d.revision, 1);
    assert.equal(d.validationStatus, 'valid');
    assert.equal(d.blueprint.blueprintId, d.draftId);
    assert.deepEqual(d.blueprint.habit, { name: 'Read', direction: 'build', schedule: { kind: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] }, reminder: null });
    assert.deepEqual(d.blueprint.metrics[0].goal, { kind: 'daily_target', value: 15 });
    assert.equal(d.blueprint.checkIn.targetAutomaticallyCompletesHabit, false);
    assert.deepEqual(d.blueprint.metadata, { createdBy: 'ai-draft', createdAt: '2026-10-20T09:00:00.000Z' });
    // The draft is a real, valid blueprint by the app's own validator.
    assert.equal(validateBlueprint(d.blueprint).valid, true);
  });

  it('applies allowed parameters', async () => {
    const d = (
      await create({ name: 'Evening reading', scheduleDays: [1, 3, 5], reminderTime: '21:00', dailyTargetMinutes: 20, icon: 'sun', colorToken: 'lagoon' })
    ).structuredContent!;
    assert.equal(d.validationStatus, 'valid');
    assert.equal(d.blueprint.habit.name, 'Evening reading');
    assert.deepEqual(d.blueprint.habit.reminder, { localTime: '21:00' });
    assert.deepEqual(d.blueprint.presentation, { icon: 'sun', colorToken: 'lagoon' });
    assert.deepEqual(d.validation.warnings.map((w: { code: string }) => w.code), ['reminder_needs_permission']);
  });

  it('keeps pages optional and lets the target be removed', async () => {
    const d = (await create({ dailyTargetMinutes: null })).structuredContent!;
    assert.equal(d.validationStatus, 'valid');
    assert.equal(d.blueprint.metrics[0].goal, null);
    assert.equal(d.blueprint.metrics[1].required, false);
  });

  it('records invalid choices and explains them instead of rewriting them', async () => {
    const r = await create({ direction: 'break' });
    assert.equal(r.structuredContent!.validationStatus, 'invalid');
    assert.deepEqual(codes(r), ['incompatible_direction']);
    assert.equal(r.structuredContent!.blueprint.habit.direction, 'break');
  });


  for (const [label, params, code] of [
    ['minutes target -1', { dailyTargetMinutes: -1 }, 'out_of_range'],
    ['fractional target', { dailyTargetMinutes: 7.5 }, 'not_integer'],
    ['target above limit', { dailyTargetMinutes: 601 }, 'out_of_range'],
    ['day 7', { scheduleDays: [1, 7] }, 'out_of_range'],
    ['duplicate days', { scheduleDays: [2, 2] }, 'duplicate'],
    ['no days', { scheduleDays: [] }, 'missing_item'],
    ['bad time', { reminderTime: '25:00' }, 'invalid_time'],
    ['long name', { name: 'x'.repeat(41) }, 'too_long'],
    ['blank name', { name: '   ' }, 'invalid_name'],
    ['unknown icon', { icon: 'flame' }, 'unknown_icon'],
    ['raw hex color', { colorToken: '#FF8737' }, 'unknown_color'],
  ] as const) {
    it(`reports ${label} with a stable code`, async () => {
      const r = await create(params);
      assert.equal(r.structuredContent!.validationStatus, 'invalid');
      assert.deepEqual(codes(r), [code]);
    });
  }

  it('rejects unknown templates, versions and extra fields before creating anything', async () => {
    for (const args of [
      { templateId: 'exercise', templateVersion: '1.0.0' },
      { templateId: 'read-more', templateVersion: '2.0.0' },
      { templateId: 'read-more', templateVersion: '1.0.0', widgets: [{ moduleId: 'widget.custom_code' }] },
      { templateId: 'read-more', templateVersion: '1.0.0', postImportCommand: 'rm -rf ~' },
      { templateId: 'read-more', templateVersion: '1.0.0', path: '/etc/passwd' },
      { templateId: 'read-more', templateVersion: '1.0.0', scheduleDays: ['monday'] },
    ]) {
      assert.equal((await call('create_draft', args)).isError, true, JSON.stringify(args));
    }
  });

  it(`refuses more than ${MAX_DRAFTS} drafts per session`, async () => {
    for (let i = 0; i < MAX_DRAFTS; i += 1) assert.notEqual((await create()).isError, true);
    const r = await create();
    assert.equal(r.isError, true);
    assert.equal(r.structuredContent!.error.code, 'too_many_drafts');
  });
});

describe('get_draft', () => {
  it('returns the stored draft', async () => {
    const { draftId } = (await create({ name: 'Read daily' })).structuredContent!;
    const d = (await call('get_draft', { draftId })).structuredContent!;
    assert.equal(d.draftId, draftId);
    assert.equal(d.blueprint.habit.name, 'Read daily');
    assert.equal(d.validationStatus, 'valid');
  });

  it('only accepts server-shaped IDs and reports unknown ones', async () => {
    assert.equal((await call('get_draft', { draftId: '../../etc/passwd' })).isError, true);
    assert.equal((await call('get_draft', { draftId: 'draft_x' })).isError, true);
    const missing = await call('get_draft', { draftId: `draft_${'0'.repeat(32)}` });
    assert.equal(missing.isError, true);
    assert.equal(missing.structuredContent!.error.code, 'draft_not_found');
  });

  it('keeps drafts private to one server session', async () => {
    const { draftId } = (await create()).structuredContent!;
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createServer().connect(serverSide);
    const other = new Client({ name: 'other', version: '1.0.0' });
    await other.connect(clientSide);
    const r = (await other.callTool({ name: 'get_draft', arguments: { draftId } })) as Result;
    assert.equal(r.structuredContent!.error.code, 'draft_not_found');
  });
});

describe('update_draft', () => {
  it('applies the patch, bumps the revision and invalidates the previous validation', async () => {
    const { draftId } = (await create()).structuredContent!;
    const u = (await call('update_draft', { draftId, patch: { dailyTargetMinutes: 30, scheduleDays: [6, 0] } })).structuredContent!;
    assert.equal(u.revision, 2);
    assert.equal(u.validationStatus, 'not_validated');
    assert.equal(u.validation, null);
    assert.deepEqual(u.blueprint.metrics[0].goal, { kind: 'daily_target', value: 30 });
    assert.deepEqual(u.blueprint.habit.schedule.days, [6, 0]);
    assert.equal((await call('get_draft', { draftId })).structuredContent!.validationStatus, 'not_validated');
  });

  it('can clear the reminder and target with null, and leaves other fields alone', async () => {
    const { draftId } = (await create({ reminderTime: '08:00', name: 'Read' })).structuredContent!;
    const u = (await call('update_draft', { draftId, patch: { reminderTime: null, dailyTargetMinutes: null } })).structuredContent!;
    assert.equal(u.blueprint.habit.reminder, null);
    assert.equal(u.blueprint.metrics[0].goal, null);
    assert.equal(u.blueprint.habit.name, 'Read');
  });

  it('rejects unknown patch keys and anything outside the allowlist', async () => {
    const { draftId } = (await create()).structuredContent!;
    for (const patch of [
      { widgets: [] },
      { metrics: [{ moduleId: 'metric.distance' }] },
      { checkIn: { targetAutomaticallyCompletesHabit: true } },
      { template: { id: 'exercise' } },
      { blueprintId: 'mine' },
      { op: 'replace', path: '/habit/name', value: 'x' },
    ]) {
      assert.equal((await call('update_draft', { draftId, patch })).isError, true, JSON.stringify(patch));
    }
    // The rejected patches changed nothing.
    const d = (await call('get_draft', { draftId })).structuredContent!;
    assert.equal(d.revision, 1);
    assert.equal(d.validationStatus, 'valid');
  });

  it('reports a missing draft', async () => {
    const r = await call('update_draft', { draftId: `draft_${'a'.repeat(32)}`, patch: { name: 'x' } });
    assert.equal(r.structuredContent!.error.code, 'draft_not_found');
  });
});

describe('validate_draft', () => {
  it('re-validates after an update and returns the normalized blueprint', async () => {
    const { draftId } = (await create()).structuredContent!;
    await call('update_draft', { draftId, patch: { name: '  Read   more  ', scheduleDays: [5, 1, 3] } });
    const v = (await call('validate_draft', { draftId })).structuredContent!;
    assert.equal(v.validationStatus, 'valid');
    assert.equal(v.validation.revision, 2);
    assert.equal(v.normalizedBlueprint.habit.name, 'Read more');
    assert.deepEqual(v.normalizedBlueprint.habit.schedule.days, [1, 3, 5]);
    assert.equal((await call('get_draft', { draftId })).structuredContent!.validationStatus, 'valid');
  });

  it('turns invalid after a bad update and valid again after a fix', async () => {
    const { draftId } = (await create()).structuredContent!;
    await call('update_draft', { draftId, patch: { direction: 'break' } });
    const bad = (await call('validate_draft', { draftId })).structuredContent!;
    assert.equal(bad.validationStatus, 'invalid');
    assert.equal(bad.normalizedBlueprint, null);
    assert.deepEqual(bad.validation.errors.map((e: { code: string }) => e.code), ['incompatible_direction']);
    for (const e of bad.validation.errors) assert.ok(e.message.length > 5 && e.path.startsWith('/'));

    await call('update_draft', { draftId, patch: { direction: 'build' } });
    assert.equal((await call('validate_draft', { draftId })).structuredContent!.validationStatus, 'valid');
  });

  it('is idempotent for an unchanged draft', async () => {
    const { draftId } = (await create()).structuredContent!;
    const a = (await call('validate_draft', { draftId })).structuredContent!;
    const b = (await call('validate_draft', { draftId })).structuredContent!;
    assert.deepEqual(a, b);
  });
});
