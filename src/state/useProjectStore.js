import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createEmptyDocument, nowStamp, readDocumentText, toYaml } from '../domain/document';
import { documentToCsv } from '../domain/csv';
import { newProjectId, revisionOf } from '../domain/ids';
import { createRepository, runSidecar } from '../sidecarBridge';
import { createProjectService, metaOf } from './projectService';
import sampleYaml from '../data/capabilities.yaml?raw';

const LAST_KEY = 'capmatrix:lastProject';
const LEGACY_KEY = 'capmatrix:legacyMigrated';
const storage = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } } };

export function sampleDocument(overrides = {}) {
  const { document } = readDocumentText(sampleYaml);
  const now = nowStamp();
  return { ...document, project: { ...document.project, createdAt: now, updatedAt: now, ...overrides } };
}

export function useProjectStore({ notify }) {
  const repository = useMemo(() => createRepository(), []);
  const [projects, setProjects] = useState([]);
  const [trash, setTrash] = useState([]);
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [exported, setExported] = useState({});
  const [ready, setReady] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const refresh = useCallback(async () => {
    const [list, bin] = await Promise.all([repository.list(), repository.listTrash()]);
    setProjects(list); setTrash(bin);
    return list;
  }, [repository]);
  const refreshRef = useRef(refresh); refreshRef.current = refresh;

  const service = useMemo(() => createProjectService({
    repository,
    sidecar: runSidecar,
    onSaveStatus: ({ id, status, revision, error }) => {
      setActive((a) => (a && a.id === id ? { ...a, status, error: error?.message || null, revision: revision ?? a.revision } : a));
      if (status === 'saved') refreshRef.current();
      if (status === 'error') notify(`Save failed: ${error?.message}. Your work is kept in the app; retry or save a copy.`, 'error');
      if (status === 'conflict') notify('The project file changed outside the app. Reload it or save your version as a copy.', 'error');
    },
  }), [repository]); // eslint-disable-line react-hooks/exhaustive-deps

  const openProject = useCallback(async (id) => {
    try {
      const opened = await service.open(id);
      setHistory([]);
      storage.set(LAST_KEY, id);
      if (opened.kind === 'document' && opened.ok) setActive({ id, doc: opened.document, status: 'saved', revision: opened.revision, location: opened.location, repair: null });
      else setActive({ id, doc: null, status: 'invalid', revision: opened.revision, location: opened.location, repair: { text: opened.text, issues: opened.issues, kind: opened.kind } });
      return true;
    } catch (error) { notify(`Could not open the project: ${error.message}`, 'error'); return false; }
  }, [service, notify]);

  const createProject = useCallback(async ({ name, description = '', fromSample = false }) => {
    const now = nowStamp();
    const doc = fromSample ? sampleDocument({ id: newProjectId(), name, description, createdAt: now }) : createEmptyDocument({ name, description });
    const created = await service.create(doc);
    if (!created.doc) { notify(created.issues[0]?.message || 'The project could not be created.', 'error'); return null; }
    await refresh();
    await openProject(doc.project.id);
    notify(`Project “${name}” created.`);
    return doc.project.id;
  }, [service, refresh, openProject, notify]);

  // Runs once per store (StrictMode mounts effects twice; a second create would rightly conflict).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        let list = await repository.list();
        if (!list.length && repository.kind === 'desktop' && !storage.get(LEGACY_KEY)) {
          const legacy = await repository.loadLegacy();
          storage.set(LEGACY_KEY, '1');
          if (legacy) {
            const preview = await service.previewImport(legacy, { fileName: 'Migrated project.yaml', projects: [] });
            if (preview.ok) { await service.applyImport(preview, 'new'); notify('Your earlier capabilities.yaml was migrated into a managed project. The original file is unchanged.'); }
            else notify('Your earlier capabilities.yaml has validation errors and was not migrated. It is unchanged; import it from Projects to fix it.', 'error');
          }
          list = await repository.list();
        }
        if (!list.length) {
          const doc = sampleDocument();
          await service.create(doc);
          list = await repository.list();
        }
        setProjects(list); setTrash(await repository.listTrash());
        const last = storage.get(LAST_KEY);
        await openProject(list.some((p) => p.id === last) ? last : list[0].id);
      } catch (error) { notify(`Could not load projects: ${error.message}`, 'error'); }
      setReady(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate the whole candidate, apply it, then persist through the serialized queue.
  const commit = useCallback(async (next, message, { undoable = true, quiet = false } = {}) => {
    const current = activeRef.current;
    if (!current) return { ok: false, issues: [] };
    const result = await service.commit(current.id, next);
    if (!result.ok) {
      const first = result.issues.find((i) => i.severity === 'error');
      if (!quiet) notify(`Not applied: ${first?.message || 'validation failed.'}`, 'error');
      return result;
    }
    if (undoable && current.doc) setHistory((h) => [...h.slice(-29), { doc: current.doc, message: message || 'Change' }]);
    // Save status arrives from the queue (saving → saved/error/conflict); it is not guessed here.
    setActive((a) => (a && a.id === current.id ? { ...a, doc: result.doc, repair: null } : a));
    if (result.sidecarNote) notify(result.sidecarNote, 'error');
    else if (message && !quiet) notify(message);
    return result;
  }, [service, notify]);

  const undo = useCallback(async () => {
    const last = history.at(-1);
    if (!last) return;
    const result = await commit(last.doc, `Undid: ${last.message.replace(/\.$/, '')}.`, { undoable: false });
    if (result.ok) setHistory((h) => h.slice(0, -1));
  }, [history, commit]);

  const retrySave = useCallback(async () => {
    const current = activeRef.current;
    if (current?.doc) service.queue.save(current.id, toYaml(current.doc), metaOf(current.doc));
  }, [service]);

  const reloadFromDisk = useCallback(async () => openProject(activeRef.current.id), [openProject]);

  const saveAsCopy = useCallback(async () => {
    const created = await service.saveAsCopy(activeRef.current.doc);
    if (!created.doc) return;
    await refresh();
    await openProject(created.doc.project.id);
    notify(`Saved your version as “${created.doc.project.name}”.`);
  }, [service, refresh, openProject, notify]);

  const deleteProject = useCallback(async (id) => {
    await repository.trash(id);
    const list = await refresh();
    if (activeRef.current?.id === id) {
      if (list.length) await openProject(list[0].id); else setActive(null);
    }
  }, [repository, refresh, openProject]);

  const restoreProject = useCallback(async (trashId) => {
    const id = await repository.restore(trashId);
    await refresh();
    return id;
  }, [repository, refresh]);

  const projectText = useCallback(async (id) => {
    const current = activeRef.current;
    if (current?.id === id && current.doc) return { text: toYaml(current.doc), doc: current.doc };
    const { text } = await repository.load(id);
    const read = readDocumentText(text, { projectId: id });
    return { text, doc: read.ok && read.kind === 'document' ? read.document : null };
  }, [repository]);

  const markExported = useCallback((id) => {
    const project = projects.find((p) => p.id === id);
    const current = activeRef.current;
    const revision = current?.id === id && current.doc ? revisionOf(toYaml(current.doc)) : project?.revision;
    setExported((old) => ({ ...old, [id]: revision }));
  }, [projects]);

  const previewImport = useCallback((text, fileName) => service.previewImport(text, { fileName, projects }), [service, projects]);
  const applyImport = useCallback(async (preview, mode) => {
    const { id } = await service.applyImport(preview, mode);
    await refresh();
    await openProject(id);
    return id;
  }, [service, refresh, openProject]);

  const listed = projects.map((p) => ({ ...p, unexported: repository.kind === 'session' && exported[p.id] !== p.revision }));
  return {
    repository, ready, projects: listed, trash, active, history, desktop: repository.kind === 'desktop',
    refresh, openProject, createProject, commit, undo, retrySave, reloadFromDisk, saveAsCopy, deleteProject, restoreProject,
    projectText, markExported, previewImport, applyImport, documentToCsv, validateWithSidecar: service.validate,
  };
}
