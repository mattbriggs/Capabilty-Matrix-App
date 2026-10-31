// Serialized, revision-aware saves per project. Fast edits coalesce: while a write is in flight only the
// newest pending text is kept, so an older commit can never overwrite newer work. Each write carries the
// revision the app last persisted; the repository rejects it if the file changed underneath.
import { ConflictError } from './repository.js';

export function createSaveQueue(repository, onStatus = () => {}) {
  const entries = new Map();
  const entry = (id) => {
    if (!entries.has(id)) entries.set(id, { revision: null, pending: null, running: null });
    return entries.get(id);
  };
  async function drain(id) {
    const state = entry(id);
    while (state.pending) {
      const job = state.pending;
      state.pending = null;
      onStatus({ id, status: 'saving' });
      try {
        const { revision } = await repository.save(id, job.text, state.revision, job.meta);
        state.revision = revision;
        job.resolvers.forEach((resolve) => resolve({ ok: true, revision }));
        if (!state.pending) onStatus({ id, status: 'saved', revision });
      } catch (error) {
        const conflict = error instanceof ConflictError;
        job.resolvers.forEach((resolve) => resolve({ ok: false, conflict, error }));
        onStatus({ id, status: conflict ? 'conflict' : 'error', error });
        if (state.pending) continue;
      }
    }
    state.running = null;
  }
  return {
    // Revision of the file as last read or written by this app.
    setRevision(id, revision) { entry(id).revision = revision; },
    revision: (id) => entry(id).revision,
    save(id, text, meta) {
      const state = entry(id);
      return new Promise((resolve) => {
        const resolvers = [...(state.pending?.resolvers || []), resolve];
        state.pending = { text, meta, resolvers };
        if (!state.running) state.running = drain(id);
      });
    },
    idle: (id) => entry(id).running || Promise.resolve(),
    forget(id) { entries.delete(id); },
  };
}
