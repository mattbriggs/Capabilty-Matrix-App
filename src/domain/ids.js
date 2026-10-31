// Stable identifiers. IDs are generated once and never edited as labels.

export function slug(value) {
  const text = typeof value === 'string' ? value.toLowerCase() : '';
  return text.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}

// A readable, unique ID derived from a label, e.g. "Audit trail" → "audit-trail" or "audit-trail-2".
export function uniqueId(label, taken, fallback = 'item') {
  const used = taken instanceof Set ? taken : new Set(taken);
  const base = slug(label) || fallback;
  let candidate = base; let suffix = 2;
  while (used.has(candidate)) { candidate = `${base}-${suffix}`; suffix += 1; }
  return candidate;
}

export function randomToken(length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

// Project IDs are path-safe; desktop storage constrains project folders to these IDs.
export const newProjectId = () => `prj-${randomToken(12)}`;

// FNV-1a 64-bit hash of the UTF-8 text, hex encoded. Matches `revision_of` in src-tauri/src/projects.rs.
export function revisionOf(text) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}
