export const audiences = [
  { id: 'client', label: 'Client', description: 'Uses and funds the capability' },
  { id: 'consultant', label: 'Consultant', description: 'Advises, designs and enables' },
  { id: 'product-team', label: 'Product team', description: 'Builds and operates the product' },
  { id: 'leadership', label: 'Leadership', description: 'Sets direction and allocates resources' },
  { id: 'wider-domain', label: 'Wider domain', description: 'Extends value across the ecosystem' },
];

export const initialCapabilities = [
  {
    id: 'contextual-guidance', name: 'Contextual guidance', current: 3, target: 5,
    owner: 'appliance', futureOwner: 'federated',
    summary: 'Relevant, in-device and external guidance at the point of need.',
    decision: 'Define the handoff from product-owned guidance to a federated content service.',
    dependencies: ['deployment-metadata', 'content-service'],
    dita: { audience: ['client', 'consultant'], maturity: 'phase-3', ownership: 'appliance-native' },
  },
  {
    id: 'deployment-metadata', name: 'Deployment metadata', current: 3, target: 5,
    owner: 'appliance', futureOwner: 'appliance',
    summary: 'Structured product, task and deployment context for downstream services.',
    decision: 'Agree on a stable metadata contract before expanding content delivery.',
    dependencies: [],
    dita: { audience: ['consultant', 'product-team'], maturity: 'phase-3', ownership: 'appliance-native' },
  },
  {
    id: 'audit-trail', name: 'Audit trail', current: 4, target: 6,
    owner: 'federated', futureOwner: 'federated',
    summary: 'Evidence of actions and changes across the wider environment.',
    decision: 'Assign event ownership and retention responsibilities across systems.',
    dependencies: ['identity-service'],
    dita: { audience: ['client', 'leadership'], maturity: 'phase-4', ownership: 'federated-infra' },
  },
  {
    id: 'identity-service', name: 'Identity service', current: 4, target: 6,
    owner: 'federated', futureOwner: 'federated',
    summary: 'Shared identity and access context across the estate.',
    decision: 'Clarify which system is authoritative for identity and permissions.',
    dependencies: [],
    dita: { audience: ['product-team', 'consultant'], maturity: 'phase-4', ownership: 'federated-infra' },
  },
  {
    id: 'content-service', name: 'Content service', current: 2, target: 5,
    owner: 'federated', futureOwner: 'federated',
    summary: 'Governed content served across products, channels and devices.',
    decision: 'Map a single DITA content stock to embedded help and PDF manuals.',
    dependencies: ['deployment-metadata'],
    dita: { audience: ['client', 'consultant'], maturity: 'phase-2', ownership: 'federated-infra' },
  },
  {
    id: 'domain-insight', name: 'Domain insight', current: 2, target: 5,
    owner: 'federated', futureOwner: 'federated',
    summary: 'Cross-domain reporting, insight and optimization opportunities.',
    decision: 'Identify useful signals without expanding the appliance boundary.',
    dependencies: ['audit-trail', 'content-service'],
    dita: { audience: ['leadership', 'wider-domain'], maturity: 'phase-2', ownership: 'federated-infra' },
  },
];

export const audienceNeeds = {
  client: 'Clear outcomes, usable guidance and a dependable operating experience.',
  consultant: 'Practical guidance for tailoring the product to a client context.',
  'product-team': 'A clear product boundary, data contract and implementation ownership.',
  leadership: 'A defensible scope decision with visible dependencies and risk.',
  'wider-domain': 'How local capabilities contribute to the evolving domain solution.',
};

export const matrixRows = [
  { audience: 'client', bars: [{ id: 'deployment-metadata', start: 1, end: 5 }, { id: 'audit-trail', start: 3, end: 7 }] },
  { audience: 'consultant', bars: [{ id: 'contextual-guidance', start: 1, end: 6 }] },
  { audience: 'product-team', bars: [{ id: 'deployment-metadata', start: 1, end: 5 }, { id: 'audit-trail', start: 3, end: 8 }] },
  { audience: 'leadership', bars: [{ id: 'contextual-guidance', start: 4, end: 8 }] },
  { audience: 'wider-domain', bars: [{ id: 'audit-trail', start: 5, end: 8.7 }] },
];

export function normalizeCapabilities(value) {
  const list = Array.isArray(value) ? value : value?.capabilities;
  if (!Array.isArray(list) || list.length === 0) throw new Error('Expected a nonempty capabilities list.');
  const ids = new Set();
  return list.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Capability ${index + 1} must be an object.`);
    const id = String(item.id || '').trim();
    const name = String(item.name || '').trim();
    const current = Number(item.current);
    const target = Number(item.target);
    if (!id || !name || !Number.isFinite(current) || !Number.isFinite(target) || current < 0 || target < 0) {
      throw new Error(`Capability ${index + 1} needs an id, name and nonnegative maturity values.`);
    }
    if (ids.has(id)) throw new Error(`Duplicate capability id: ${id}`);
    ids.add(id);
    return {
      ...item, id, name, current, target,
      owner: item.owner === 'federated' ? 'federated' : 'appliance',
      futureOwner: item.futureOwner === 'federated' ? 'federated' : 'appliance',
      summary: String(item.summary || ''), decision: String(item.decision || ''),
      dependencies: Array.isArray(item.dependencies) ? item.dependencies.map(String) : [],
      dita: item.dita && typeof item.dita === 'object' ? item.dita : {},
    };
  });
}
