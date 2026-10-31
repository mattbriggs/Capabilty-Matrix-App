// Domain map graph at a date. Owners are anchor nodes; each owner/domain placement is a group with a
// label node; capabilities belong to one group. Membership edges (anchor → group) are distinct from
// dependency edges (capability → capability). A domain spanning both owners has two linked groups.
import { maturityAt, ownerAt } from '../../domain/timeline.js';

export const CARD = { width: 230, height: 108 };
export const LABEL = { width: 190, height: 46 };
export const ANCHOR = { width: 168, height: 64 };
export const UNASSIGNED_DOMAIN = 'unassigned';
export const owners = ['appliance', 'federated'];

export const groupKey = (owner, domainId) => `${owner}/${domainId || UNASSIGNED_DOMAIN}`;
export const capNodeId = (capId) => `cap:${capId}`;
export const anchorNodeId = (owner) => `owner:${owner}`;
export const groupNodeId = (key) => `group:${key}`;

export function buildGraph(doc, { currentDate, focusDate, filters = {}, sizes = {} }) {
  const { timeline } = doc.settings;
  const domains = new Map(doc.domains.map((d) => [d.id, d]));
  const ownerFilter = new Set(filters.owners || []);
  const domainFilter = new Set((filters.domainIds || []).filter((id) => domains.has(id)));
  const search = (filters.search || '').trim().toLowerCase();
  const size = (id, fallback) => ({ width: sizes[id]?.width || fallback.width, height: sizes[id]?.height || fallback.height });

  const visible = doc.capabilities.filter((cap) => {
    const owner = ownerAt(cap, timeline, focusDate);
    const domain = cap.domainId && domains.has(cap.domainId) ? cap.domainId : UNASSIGNED_DOMAIN;
    return (!ownerFilter.size || ownerFilter.has(owner)) && (!domainFilter.size || domainFilter.has(domain)) && (!search || cap.name.toLowerCase().includes(search));
  });
  const visibleIds = new Set(visible.map((cap) => cap.id));

  const groups = new Map();
  const nodes = [];
  visible.forEach((cap) => {
    const owner = ownerAt(cap, timeline, focusDate);
    const domainId = cap.domainId && domains.has(cap.domainId) ? cap.domainId : null;
    const key = groupKey(owner, domainId);
    if (!groups.has(key)) groups.set(key, { key, owner, domainId, domain: domainId ? domains.get(domainId) : null, members: [] });
    groups.get(key).members.push(capNodeId(cap.id));
    const from = maturityAt(cap, timeline, currentDate);
    const to = maturityAt(cap, timeline, focusDate);
    nodes.push({ id: capNodeId(cap.id), kind: 'capability', capability: cap, owner, group: key, context: key, from, to, ...size(capNodeId(cap.id), CARD) });
  });
  const groupList = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
  groupList.forEach((group) => nodes.push({ id: groupNodeId(group.key), kind: 'group', group: group.key, context: group.key, owner: group.owner, domain: group.domain, count: group.members.length, ...size(groupNodeId(group.key), LABEL) }));
  const anchorOwners = owners.filter((owner) => !ownerFilter.size || ownerFilter.has(owner));
  anchorOwners.forEach((owner) => nodes.push({ id: anchorNodeId(owner), kind: 'anchor', owner, context: 'anchor', ...size(anchorNodeId(owner), ANCHOR) }));

  const edges = [];
  groupList.forEach((group) => {
    if (anchorOwners.includes(group.owner)) edges.push({ id: `member:${group.key}`, kind: 'membership', source: anchorNodeId(group.owner), target: groupNodeId(group.key) });
  });
  const byDomain = new Map();
  groupList.forEach((group) => { if (group.domainId) byDomain.set(group.domainId, [...(byDomain.get(group.domainId) || []), group]); });
  byDomain.forEach((list) => { if (list.length === 2) edges.push({ id: `same:${list[0].domainId}`, kind: 'sameDomain', source: groupNodeId(list[0].key), target: groupNodeId(list[1].key) }); });
  visible.forEach((cap) => cap.dependencies.forEach((dep) => {
    if (visibleIds.has(dep) && dep !== cap.id) edges.push({ id: `dep:${dep}>${cap.id}`, kind: 'dependency', source: capNodeId(dep), target: capNodeId(cap.id) });
  }));
  return { nodes, edges, groups: groupList };
}
