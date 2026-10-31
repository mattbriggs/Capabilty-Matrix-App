// Project application service: pure-ish orchestration over a repository, save queue and validators.
// No React here so the transactional rules (validate before commit, serialized saves, same-ID imports,
// migration backups) are testable in Node.
import { csvToDocument } from '../domain/csv.js';
import { nowStamp, readDocumentText, stamp, toYaml } from '../domain/document.js';
import { newProjectId } from '../domain/ids.js';
import { hasErrors, sortIssues } from '../domain/issues.js';
import { normalizeDocument, validateDocument } from '../domain/validate.js';
import { createSaveQueue } from '../storage/saveQueue.js';

export const metaOf = (doc) => ({ name: doc.project.name, description: doc.project.description, updatedAt: doc.project.updatedAt });

// Combine browser issues with the desktop sidecar's. A sidecar that does not speak the issue contract
// (for example a stale binary) is reported rather than allowed to block or silently pass.
export function mergeIssues(browser, sidecar) {
  if (!sidecar) return { issues: browser.issues, sidecarNote: null };
  if (!Array.isArray(sidecar.issues)) return { issues: browser.issues, sidecarNote: `The validation sidecar returned an unexpected response${sidecar.error ? `: ${sidecar.error}` : ''}. Browser validation was used; rebuild the sidecar.` };
  const seen = new Set(browser.issues.map((i) => `${i.path}|${i.code}`));
  return { issues: sortIssues([...browser.issues, ...sidecar.issues.filter((i) => !seen.has(`${i.path}|${i.code}`))]), sidecarNote: null };
}

export function createProjectService({ repository, sidecar = async () => null, onSaveStatus = () => {} }) {
  const queue = createSaveQueue(repository, onSaveStatus);

  async function validate(doc) {
    const browser = validateDocument(doc);
    let sidecarResult = null;
    if (!hasErrors(browser.issues)) {
      try { sidecarResult = await sidecar('validate', { document: doc }); } catch (error) { sidecarResult = { error: error.message || String(error) }; }
    }
    const { issues, sidecarNote } = mergeIssues(browser, sidecarResult);
    return { ok: !hasErrors(issues), issues, sidecarNote };
  }

  return {
    queue,
    validate,
    // Validate the complete candidate before it is applied; errors block, warnings do not.
    async commit(id, candidate) {
      const doc = stamp(candidate);
      const report = await validate(doc);
      if (!report.ok) return { ...report, doc: null, saved: Promise.resolve(null) };
      const normalized = normalizeDocument(doc);
      const saved = queue.save(id, toYaml(normalized), metaOf(normalized));
      return { ...report, doc: normalized, saved };
    },
    async open(id) {
      const { text, revision, location } = await repository.load(id);
      queue.setRevision(id, revision);
      return { ...readDocumentText(text, { projectId: id }), text, revision, location };
    },
    async create(doc) {
      const normalized = normalizeDocument(doc);
      const report = await validate(normalized);
      if (!report.ok) return { ...report, doc: null };
      queue.forget(normalized.project.id);
      const result = await queue.save(normalized.project.id, toYaml(normalized), metaOf(normalized));
      if (!result.ok) throw result.error;
      return { ...report, doc: normalized, revision: result.revision };
    },
    // Preview an import without side effects: kind, counts, issues and any same-ID project.
    async previewImport(text, { fileName = '', format = /\.csv$/i.test(fileName) ? 'csv' : 'yaml', projects = [] } = {}) {
      let preview;
      if (format === 'csv') {
        const parsed = csvToDocument(text);
        if (!parsed.document) preview = { kind: 'csv', ok: false, issues: parsed.issues, counts: parsed.counts, document: null };
        else { const report = validateDocument(parsed.document); preview = { kind: 'csv', ...report, counts: parsed.counts, document: report.ok ? normalizeDocument(parsed.document) : parsed.document }; }
      } else {
        preview = readDocumentText(text, { projectId: newProjectId(), name: fileName.replace(/\.(ya?ml)$/i, '') || undefined });
        preview.counts = preview.document?.capabilities ? { capability: preview.document.capabilities.length, domain: preview.document.domains?.length || 0, 'map-view': preview.document.mapViews?.length || 0 } : {};
      }
      const projectId = preview.document?.project?.id;
      const existing = preview.kind !== 'migration' && projectId ? projects.find((p) => p.id === projectId) || null : null;
      return { ...preview, format, fileName, originalText: text, existing };
    },
    // mode: 'new' | 'replace' | 'copy'. Never merges; 'replace' requires the caller to have shown the preview.
    async applyImport(preview, mode) {
      if (!preview.ok) throw new Error('Fix the errors before importing.');
      let doc = preview.document;
      if (mode === 'copy') {
        const now = nowStamp();
        doc = { ...doc, project: { ...doc.project, id: newProjectId(), name: `${doc.project.name} (copy)`, createdAt: now, updatedAt: now } };
      }
      if (mode === 'replace') {
        queue.setRevision(preview.existing.id, preview.existing.revision);
        const result = await queue.save(doc.project.id, toYaml(normalizeDocument(stamp(doc))), metaOf(doc));
        if (!result.ok) throw result.error;
        return { doc, id: doc.project.id };
      }
      const created = await this.create(doc);
      if (!created.doc) throw new Error(created.issues[0]?.message || 'Import failed validation.');
      if (preview.kind === 'migration') await repository.backup(doc.project.id, 'original-v1.yaml', preview.originalText);
      return { doc: created.doc, id: doc.project.id };
    },
    async saveAsCopy(doc) {
      const now = nowStamp();
      return this.create({ ...doc, project: { ...doc.project, id: newProjectId(), name: `${doc.project.name} (copy)`, createdAt: now, updatedAt: now } });
    },
  };
}
