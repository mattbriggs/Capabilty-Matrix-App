// Project repository: one interface, two adapters.
// * Desktop: managed YAML files under app data via Tauri commands (atomic, revision-checked, trash/restore).
// * Session: in-memory documents for the browser preview. A refresh loses anything not exported.
import { revisionOf } from '../domain/ids.js';

export class ConflictError extends Error {
  constructor(currentRevision) {
    super(currentRevision === 'missing' ? 'The project file was removed outside the app.' : 'The project file changed outside the app since it was opened.');
    this.name = 'ConflictError';
    this.currentRevision = currentRevision;
  }
}

const toError = (error) => {
  const message = typeof error === 'string' ? error : error?.message || String(error);
  if (message.startsWith('conflict:')) return new ConflictError(message.slice('conflict:'.length));
  return new Error(message);
};

export function createSessionRepository() {
  const projects = new Map();
  const trash = new Map();
  const backups = new Map();
  return {
    kind: 'session',
    async list() {
      return [...projects.entries()].map(([id, p]) => ({ id, ...p.meta, revision: p.revision, location: 'Browser session (not saved to disk)' }))
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    },
    async listTrash() {
      return [...trash.entries()].map(([trashId, p]) => ({ trashId, id: p.id, name: p.meta.name, deletedAtMs: p.deletedAtMs })).sort((a, b) => b.deletedAtMs - a.deletedAtMs);
    },
    async load(id) {
      const p = projects.get(id);
      if (!p) throw new Error(`Project ${id} is not in this session.`);
      return { text: p.text, revision: p.revision, location: 'Browser session' };
    },
    async save(id, text, expectedRevision, meta) {
      const existing = projects.get(id);
      if (existing ? existing.revision !== expectedRevision : expectedRevision) throw new ConflictError(existing ? existing.revision : 'missing');
      const revision = revisionOf(text);
      projects.set(id, { text, revision, meta: { ...meta } });
      return { revision };
    },
    async trash(id) {
      const p = projects.get(id);
      if (!p) throw new Error(`Project ${id} is not in this session.`);
      let deletedAtMs = Date.now();
      while (trash.has(`${id}--${deletedAtMs}`)) deletedAtMs += 1;
      const trashId = `${id}--${deletedAtMs}`;
      trash.set(trashId, { ...p, id, deletedAtMs });
      projects.delete(id);
      return trashId;
    },
    async restore(trashId) {
      const p = trash.get(trashId);
      if (!p) throw new Error('That project is no longer in the trash.');
      if (projects.has(p.id)) throw new Error(`A project with id ${p.id} already exists. Delete it before restoring.`);
      projects.set(p.id, { text: p.text, revision: p.revision, meta: p.meta });
      trash.delete(trashId);
      return p.id;
    },
    async backup(id, fileName, text) { backups.set(`${id}/${fileName}`, text); return `session:${id}/${fileName}`; },
    getBackup: (id, fileName) => backups.get(`${id}/${fileName}`),
    async loadLegacy() { return null; },
  };
}

export function createDesktopRepository(invoke) {
  const call = async (command, args) => { try { return await invoke(command, args); } catch (error) { throw toError(error); } };
  return {
    kind: 'desktop',
    list: () => call('projects_list'),
    listTrash: () => call('projects_trash_list'),
    load: (id) => call('project_load', { id }),
    async save(id, text, expectedRevision, meta) {
      const revision = await call('project_save', { id, yamlText: text, expectedRevision: expectedRevision || null, meta });
      return { revision };
    },
    trash: (id) => call('project_trash', { id }),
    restore: (trashId) => call('project_restore', { trashId }),
    backup: (id, fileName, text) => call('project_backup', { id, fileName, text }),
    loadLegacy: () => call('load_yaml'),
  };
}
