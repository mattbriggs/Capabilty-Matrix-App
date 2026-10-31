// Repository adapters, serialized saves and the project service (R1–R2 / gates A1, A8).
import assert from 'node:assert/strict';
import test from 'node:test';
import { toYaml } from '../../src/domain/document.js';
import { documentToCsv } from '../../src/domain/csv.js';
import { revisionOf } from '../../src/domain/ids.js';
import { ConflictError, createDesktopRepository, createSessionRepository } from '../../src/storage/repository.js';
import { createSaveQueue } from '../../src/storage/saveQueue.js';
import { createProjectService, mergeIssues } from '../../src/state/projectService.js';
import { base, readText } from './helpers.mjs';

const meta = { name: 'P', description: '', updatedAt: '2026-10-29T00:00:00Z' };

test('session repository: CRUD, conflicts, trash and restore', async () => {
  const repo = createSessionRepository();
  const { revision } = await repo.save('p1', 'one', null, meta);
  await assert.rejects(repo.save('p1', 'again', null, meta), ConflictError);
  await assert.rejects(repo.save('p2', 'x', 'stale', meta), ConflictError);
  const second = await repo.save('p1', 'two', revision, meta);
  await assert.rejects(repo.save('p1', 'stale', revision, meta), (e) => e instanceof ConflictError && e.currentRevision === second.revision);
  await repo.save('p2', 'other', null, { ...meta, name: 'Other', updatedAt: '2026-10-30T00:00:00Z' });
  assert.deepEqual((await repo.list()).map((p) => p.id), ['p2', 'p1']);
  const trashId = await repo.trash('p1');
  assert.deepEqual((await repo.list()).map((p) => p.id), ['p2']);
  assert.equal((await repo.load('p2')).text, 'other', 'other projects are unchanged');
  assert.equal((await repo.listTrash())[0].id, 'p1');
  await repo.save('p1', 'replacement', null, meta);
  await assert.rejects(repo.restore(trashId), /already exists/);
  await repo.trash('p1');
  assert.equal(await repo.restore(trashId), 'p1');
  assert.equal((await repo.load('p1')).text, 'two');
  await assert.rejects(repo.restore('nope'), /no longer/);
  await assert.rejects(repo.load('missing'), /not in this session/);
  await assert.rejects(repo.trash('missing'), /not in this session/);
  await repo.backup('p1', 'original-v1.yaml', 'v1');
  assert.equal(repo.getBackup('p1', 'original-v1.yaml'), 'v1');
  assert.equal(await repo.loadLegacy(), null);
});

test('desktop repository maps Tauri commands and conflict strings', async () => {
  const calls = [];
  const invoke = async (command, args) => {
    calls.push([command, args]);
    if (command === 'project_save' && args.expectedRevision === 'old') throw 'conflict:abc';
    if (command === 'project_trash') throw new Error('disk full');
    return command === 'project_save' ? 'rev2' : 'ok';
  };
  const repo = createDesktopRepository(invoke);
  assert.deepEqual(await repo.save('p', 'text', null, meta), { revision: 'rev2' });
  await assert.rejects(repo.save('p', 'text', 'old', meta), (e) => e instanceof ConflictError && e.currentRevision === 'abc');
  await assert.rejects(repo.trash('p'), /disk full/);
  await Promise.all([repo.list(), repo.listTrash(), repo.load('p'), repo.restore('t'), repo.backup('p', 'f', 't'), repo.loadLegacy()]);
  assert.deepEqual(calls.map(([c]) => c), ['project_save', 'project_save', 'project_trash', 'projects_list', 'projects_trash_list', 'project_load', 'project_restore', 'project_backup', 'load_yaml']);
  assert.deepEqual(calls[0][1], { id: 'p', yamlText: 'text', expectedRevision: null, meta });
  assert.match(new ConflictError('missing').message, /removed/);
});

test('save queue serializes writes and coalesces fast edits so old commits never overwrite new work', async () => {
  const writes = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const repo = createSessionRepository();
  const slow = { ...repo, save: async (...args) => { writes.push(args[1]); if (writes.length === 1) await gate; return repo.save(...args); } };
  const statuses = [];
  const queue = createSaveQueue(slow, (s) => statuses.push(s.status));
  const first = queue.save('p', 'v1', meta);
  const second = queue.save('p', 'v2', meta);
  const third = queue.save('p', 'v3', meta);
  release();
  const results = await Promise.all([first, second, third]);
  assert.deepEqual(writes, ['v1', 'v3'], 'v2 was superseded before it was written');
  assert.ok(results.every((r) => r.ok));
  assert.equal(results[1].revision, results[2].revision);
  assert.equal((await repo.load('p')).text, 'v3');
  assert.equal(statuses.at(-1), 'saved');
  assert.equal(queue.revision('p'), revisionOf('v3'));
  await queue.idle('p');
});

test('save queue reports conflicts and errors without losing the working copy', async () => {
  const repo = createSessionRepository();
  await repo.save('p', 'disk', null, meta);
  const statuses = [];
  const queue = createSaveQueue(repo, (s) => statuses.push(s.status));
  const conflict = await queue.save('p', 'mine', meta);
  assert.equal(conflict.conflict, true);
  assert.equal((await repo.load('p')).text, 'disk', 'the newer file is untouched');
  const failing = createSaveQueue({ save: async () => { throw new Error('EACCES'); } }, (s) => statuses.push(s.status));
  const failed = await failing.save('p', 'x', meta);
  assert.equal(failed.ok, false); assert.match(failed.error.message, /EACCES/);
  assert.deepEqual(statuses, ['saving', 'conflict', 'saving', 'error']);
  queue.forget('p'); assert.equal(queue.revision('p'), null);
});

test('project service validates before commit and persists the normalized document', async () => {
  const repo = createSessionRepository();
  const service = createProjectService({ repository: repo });
  const created = await service.create(base());
  assert.ok(created.doc);
  const bad = await service.commit('prj-fixture', { ...base(), capabilities: [{ ...base().capabilities[0], target: 99 }] });
  assert.equal(bad.ok, false); assert.equal(bad.doc, null);
  const good = await service.commit('prj-fixture', { ...base(), project: { ...base().project, name: 'Renamed' } });
  assert.ok(good.ok); await good.saved;
  const opened = await service.open('prj-fixture');
  assert.equal(opened.document.project.name, 'Renamed');
  assert.notEqual(opened.document.project.updatedAt, base().project.updatedAt, 'commits stamp updatedAt');
  const invalidCreate = await service.create({ ...base(), capabilities: [{ ...base().capabilities[0], owner: 'typo' }] });
  assert.equal(invalidCreate.doc, null);
});

test('project service: the Python sidecar is consulted after browser validation passes', async () => {
  const seen = [];
  const sidecar = async (operation, payload) => { seen.push(operation); return { ok: false, issues: [{ severity: 'error', code: 'py.only', entityType: 'document', entityId: null, path: 'x', message: 'Python says no.' }] }; };
  const service = createProjectService({ repository: createSessionRepository(), sidecar });
  const result = await service.commit('p', base());
  assert.deepEqual(seen, ['validate']);
  assert.equal(result.ok, false); assert.equal(result.issues[0].code, 'py.only');
  const stale = mergeIssues({ issues: [] }, { ok: false, errors: ['old format'] });
  assert.match(stale.sidecarNote, /unexpected response/);
  const crashed = createProjectService({ repository: createSessionRepository(), sidecar: async () => { throw new Error('spawn failed'); } });
  const note = await crashed.commit('p', base());
  assert.ok(note.ok); assert.match(note.sidecarNote, /spawn failed/);
  assert.deepEqual(mergeIssues({ issues: [{ path: 'a', code: 'c' }] }, { issues: [{ path: 'a', code: 'c' }] }).issues.length, 1);
});

test('import preview and apply: new, same-ID copy/replace, v1 migration with backup, CSV', async () => {
  const repo = createSessionRepository();
  const service = createProjectService({ repository: repo });
  const yaml = toYaml(base());
  const fresh = await service.previewImport(yaml, { fileName: 'fixture.yaml', projects: [] });
  assert.ok(fresh.ok); assert.equal(fresh.existing, null); assert.equal(fresh.counts.capability, 3);
  await service.applyImport(fresh, 'new');
  const projects = await repo.list();
  const same = await service.previewImport(yaml, { fileName: 'fixture.yaml', projects });
  assert.equal(same.existing.id, 'prj-fixture');
  const copy = await service.applyImport(same, 'copy');
  assert.notEqual(copy.id, 'prj-fixture'); assert.match(copy.doc.project.name, /\(copy\)$/);
  const edited = toYaml({ ...base(), project: { ...base().project, name: 'Replaced' } });
  const replace = await service.previewImport(edited, { fileName: 'fixture.yaml', projects: await repo.list() });
  await service.applyImport(replace, 'replace');
  assert.equal((await service.open('prj-fixture')).document.project.name, 'Replaced');
  assert.equal((await repo.list()).length, 2, 'no implicit merge or extra project');

  const v1Text = readText('tests/fixtures/migration/v1-sample.yaml');
  const migration = await service.previewImport(v1Text, { fileName: 'legacy.yaml', projects: await repo.list() });
  assert.equal(migration.kind, 'migration'); assert.equal(migration.existing, null); assert.equal(migration.document.project.name, 'legacy');
  const migrated = await service.applyImport(migration, 'new');
  assert.equal(repo.getBackup(migrated.id, 'original-v1.yaml'), v1Text, 'original bytes are kept');

  const csv = await service.previewImport(documentToCsv(base()), { fileName: 'fixture.csv', projects: [] });
  assert.ok(csv.ok); assert.equal(csv.format, 'csv'); assert.equal(csv.counts.capability, 3);
  const badCsv = await service.previewImport('nope', { fileName: 'x.csv' });
  assert.equal(badCsv.ok, false);
  const invalid = await service.previewImport('version: 2\n', { fileName: 'x.yaml' });
  await assert.rejects(service.applyImport(invalid, 'new'), /Fix the errors/);
  const copyOfOpen = await service.saveAsCopy(base());
  assert.match(copyOfOpen.doc.project.id, /^prj-/);
});
