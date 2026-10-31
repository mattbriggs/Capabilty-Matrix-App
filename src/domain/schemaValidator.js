// Structural validation against the JSON Schema generated from the Pydantic contract.
// Implements exactly the keyword subset that schema uses (see SUPPORTED_KEYWORDS); a test fails if
// the generated schema starts using a keyword this validator does not understand.

export const SUPPORTED_KEYWORDS = new Set([
  '$schema', '$id', '$defs', '$ref', 'title', 'description', 'default',
  'type', 'properties', 'required', 'additionalProperties', 'items', 'anyOf',
  'enum', 'const', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum',
  'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems',
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  if (isObject(a)) {
    if (!isObject(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && deepEqual(a[key], b[key]));
  }
  return false;
}
const typeOk = {
  string: (v) => typeof v === 'string',
  integer: (v) => typeof v === 'number' && Number.isInteger(v),
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  boolean: (v) => typeof v === 'boolean',
  null: (v) => v === null,
  array: Array.isArray,
  object: isObject,
};
const advice = {
  'schema.required': 'Add the missing field.',
  'schema.type': 'Use the expected value type.',
  'schema.enum': 'Choose one of the allowed values.',
  'schema.pattern': 'Use the expected format.',
  'schema.minLength': 'Enter a longer value.',
  'schema.maxLength': 'Shorten the value.',
  'schema.minItems': 'Add more entries.',
  'schema.maxItems': 'Remove some entries.',
  'schema.minimum': 'Use a larger number.',
  'schema.maximum': 'Use a smaller number.',
  'schema.exclusiveMinimum': 'Use a larger number.',
  'schema.exclusiveMaximum': 'Use a smaller number.',
};

export function createSchemaTools(schema) {
  const regexCache = new Map();
  const regex = (pattern) => { if (!regexCache.has(pattern)) regexCache.set(pattern, new RegExp(pattern, 'u')); return regexCache.get(pattern); };
  const deref = (node) => {
    let current = node;
    while (current && current.$ref) {
      const name = current.$ref.replace(/^#\/\$defs\//, '');
      current = schema.$defs?.[name];
      if (!current) throw new Error(`Unresolvable schema reference ${node.$ref}`);
    }
    return current;
  };
  // Nullable fields are `anyOf: [X, {type: null}]`; return X (or the node itself).
  const unwrap = (node, value) => {
    const target = deref(node);
    if (!target.anyOf) return { node: target, isNull: false };
    const branches = target.anyOf.map(deref);
    const nonNull = branches.filter((b) => b.type !== 'null');
    if (value === null && branches.some((b) => b.type === 'null')) return { node: null, isNull: true };
    return { node: nonNull.length === 1 ? nonNull[0] : target, isNull: false };
  };

  function check(rawNode, value, parts, errors) {
    const { node, isNull } = unwrap(rawNode, value);
    if (isNull) return;
    const field = [...parts].reverse().find((part) => typeof part === 'string') || 'document';
    const fail = (code, detail) => errors.push({ code, parts, message: `${field}: ${detail}. ${advice[code] || 'Correct the value.'}` });
    if (node.anyOf) {
      const passing = node.anyOf.some((branch) => { const tmp = []; check(branch, value, parts, tmp); return !tmp.length; });
      if (!passing) fail('schema.type', 'value does not match any allowed shape');
      return;
    }
    if ('const' in node) { if (value !== node.const) fail('schema.enum', `expected ${JSON.stringify(node.const)}`); return; }
    if (node.enum) { if (!node.enum.includes(value)) fail('schema.enum', `expected one of ${node.enum.map((v) => JSON.stringify(v)).join(', ')}`); return; }
    if (node.type && !typeOk[node.type](value)) { fail('schema.type', `expected ${node.type === 'integer' ? 'a whole number' : `a ${node.type}`}`); return; }
    if (typeof value === 'string') {
      const length = [...value].length;
      if (node.minLength !== undefined && length < node.minLength) return fail('schema.minLength', `must have at least ${node.minLength} characters`);
      if (node.maxLength !== undefined && length > node.maxLength) return fail('schema.maxLength', `must have at most ${node.maxLength} characters`);
      if (node.pattern !== undefined && !regex(node.pattern).test(value)) return node.pattern === '\\S' ? fail('schema.pattern', 'cannot be blank; enter a value') : fail('schema.pattern', `does not match the expected format (${node.pattern})`);
      return;
    }
    if (typeof value === 'number') {
      if (node.minimum !== undefined && value < node.minimum) return fail('schema.minimum', `must be at least ${node.minimum}`);
      if (node.maximum !== undefined && value > node.maximum) return fail('schema.maximum', `must be at most ${node.maximum}`);
      if (node.exclusiveMinimum !== undefined && value <= node.exclusiveMinimum) return fail('schema.exclusiveMinimum', `must be greater than ${node.exclusiveMinimum}`);
      if (node.exclusiveMaximum !== undefined && value >= node.exclusiveMaximum) return fail('schema.exclusiveMaximum', `must be less than ${node.exclusiveMaximum}`);
      return;
    }
    if (Array.isArray(value)) {
      const before = errors.length;
      if (node.items) value.forEach((item, index) => check(node.items, item, [...parts, index], errors));
      if (errors.length > before) return;
      if (node.minItems !== undefined && value.length < node.minItems) return fail('schema.minItems', `needs at least ${node.minItems} entries`);
      if (node.maxItems !== undefined && value.length > node.maxItems) return fail('schema.maxItems', `allows at most ${node.maxItems} entries`);
      return;
    }
    if (isObject(value) && node.properties) {
      (node.required || []).forEach((key) => { if (!(key in value)) errors.push({ code: 'schema.required', parts: [...parts, key], message: `${key}: this required field is missing from ${parts.join('.') || 'the document'}. Add the missing field.` }); });
      Object.entries(node.properties).forEach(([key, child]) => { if (key in value) check(child, value[key], [...parts, key], errors); });
    }
  }

  // Report fields the contract does not define (they are kept, never dropped).
  function unsupported(rawNode, value, parts, found) {
    const { node, isNull } = unwrap(rawNode, value);
    if (isNull || !node) return found;
    if (Array.isArray(value) && node.items) value.forEach((item, index) => unsupported(node.items, item, [...parts, index], found));
    else if (isObject(value) && node.properties) {
      Object.keys(value).forEach((key) => {
        if (node.properties[key]) unsupported(node.properties[key], value[key], [...parts, key], found);
        else found.push([...parts, key]);
      });
    }
    return found;
  }

  // Fill defaults exactly as Pydantic's model_dump does, keeping unknown fields after known ones.
  function withDefaults(rawNode, value) {
    const { node, isNull } = unwrap(rawNode, value);
    if (isNull || !node) return value;
    if (Array.isArray(value)) return node.items ? value.map((item) => withDefaults(node.items, item)) : structuredClone(value);
    if (!isObject(value)) return value;
    if (!node.properties) return structuredClone(value);
    const out = {};
    Object.entries(node.properties).forEach(([key, child]) => {
      if (key in value) out[key] = withDefaults(child, value[key]);
      else if ('default' in child) out[key] = withDefaults(child, structuredClone(child.default));
    });
    Object.keys(value).forEach((key) => { if (!(key in node.properties)) out[key] = structuredClone(value[key]); });
    return out;
  }

  // Drop properties equal to their schema default (Pydantic's exclude_defaults) for readable YAML.
  function compact(rawNode, value) {
    const { node, isNull } = unwrap(rawNode, value);
    if (isNull || !node) return value;
    if (Array.isArray(value)) return node.items ? value.map((item) => compact(node.items, item)) : value;
    if (!isObject(value) || !node.properties) return value;
    const out = {};
    Object.entries(value).forEach(([key, child]) => {
      const prop = node.properties[key];
      if (!prop) { out[key] = child; return; }
      if ('default' in prop && deepEqual(child, prop.default)) return;
      out[key] = compact(prop, child);
    });
    return out;
  }

  return {
    validate: (value) => { const errors = []; check(schema, value, [], errors); return errors; },
    unsupported: (value) => unsupported(schema, value, [], []),
    withDefaults: (value) => withDefaults(schema, value),
    compact: (value) => compact(schema, value),
  };
}

export function schemaKeywords(schema) {
  const found = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!isObject(node)) return;
    Object.entries(node).forEach(([key, value]) => {
      found.add(key);
      if (key === 'properties' || key === '$defs') Object.values(value).forEach(walk);
      else if (key !== 'default' && key !== 'const' && key !== 'enum') walk(value);
    });
  };
  walk(schema);
  return found;
}
