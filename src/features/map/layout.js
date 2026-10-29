// Deterministic, bounded organic layout. Pure: no DOM, safe in a Web Worker and in Node tests.
// Forces: dependency springs, attraction to the owner/domain group, group attraction to its owner anchor,
// group separation and rectangle collision avoidance using measured card sizes. Fixed nodes never move.
export const LAYOUT_VERSION = 1;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MARGIN = 26;

// Resolve rectangle overlaps among movable nodes; returns the number of overlapping pairs found.
function separate(items, strength = 1) {
  let overlaps = 0;
  const cell = Math.max(...items.map((n) => Math.max(n.w, n.h))) + MARGIN;
  const grid = new Map();
  items.forEach((n, index) => {
    const key = `${Math.floor(n.x / cell)},${Math.floor(n.y / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(index);
  });
  items.forEach((a, i) => {
    const gx = Math.floor(a.x / cell); const gy = Math.floor(a.y / cell);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
      (grid.get(`${gx + dx},${gy + dy}`) || []).forEach((j) => {
        if (j <= i) return;
        const b = items[j];
        if (a.fixed && b.fixed) return;
        const ox = (a.w + b.w) / 2 + MARGIN - Math.abs(a.x - b.x);
        const oy = (a.h + b.h) / 2 + MARGIN - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) return;
        overlaps += 1;
        const share = a.fixed || b.fixed ? 1 : 0.5;
        if (ox < oy) {
          const push = ox * strength * share * (a.x < b.x || (a.x === b.x && i < j) ? -1 : 1);
          if (!a.fixed) a.x += push;
          if (!b.fixed) b.x -= push;
        } else {
          const push = oy * strength * share * (a.y < b.y || (a.y === b.y && i < j) ? -1 : 1);
          if (!a.fixed) a.y += push;
          if (!b.fixed) b.y -= push;
        }
      });
    }
  });
  return overlaps;
}

/**
 * nodes: [{ id, kind: 'capability'|'group'|'anchor', group?, owner, width, height }]
 * edges: [{ source, target, kind }]
 * fixed: { [id]: { x, y } } top-left positions that must not move (pinned or remembered).
 * Returns { positions: { [id]: { x, y } } } as top-left coordinates.
 */
export function organicLayout({ nodes, edges = [], fixed = {}, seed = 1, shouldCancel = () => false }) {
  if (!nodes.length) return { positions: {}, cancelled: false };
  const random = mulberry32(seed * 7919 + nodes.length);
  const count = nodes.length;
  const spread = 300 + 85 * Math.sqrt(count);
  const items = nodes.map((node) => {
    const f = fixed[node.id];
    return { id: node.id, kind: node.kind, owner: node.owner, group: node.group, w: node.width, h: node.height, fixed: Boolean(f), x: f ? f.x + node.width / 2 : NaN, y: f ? f.y + node.height / 2 : NaN };
  });
  const byId = new Map(items.map((item) => [item.id, item]));

  // Anchors: appliance on the left, federated on the right.
  const anchorHome = { appliance: { x: -spread, y: 0 }, federated: { x: spread, y: 0 } };
  items.filter((n) => n.kind === 'anchor').forEach((n) => { if (!n.fixed) { n.x = anchorHome[n.owner].x; n.y = anchorHome[n.owner].y; } });
  const anchorOf = (owner) => byId.get(`owner:${owner}`) || anchorHome[owner];

  // Seed each group's centre around its owner anchor, biased toward the owner's side.
  const groups = new Map();
  items.forEach((n) => { if (n.group) { if (!groups.has(n.group)) groups.set(n.group, { key: n.group, owner: n.owner, members: [] }); groups.get(n.group).members.push(n); } });
  const ownerGroups = { appliance: [], federated: [] };
  [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).forEach((g) => ownerGroups[g.owner]?.push(g));
  Object.entries(ownerGroups).forEach(([owner, list]) => {
    const side = owner === 'appliance' ? -1 : 1;
    const anchor = anchorOf(owner);
    list.forEach((g, index) => {
      const size = g.members.length;
      const ring = 260 + 60 * Math.sqrt(list.length) + 40 * Math.sqrt(size);
      const angle = (list.length === 1 ? 0 : -Math.PI / 2 + (Math.PI * index) / (list.length - 1)) * 0.9;
      g.cx = anchor.x + side * ring * Math.cos(angle) * 0.6 + side * 120;
      g.cy = anchor.y + ring * Math.sin(angle);
      g.radius = 120 + 90 * Math.sqrt(size);
      g.members.forEach((n) => {
        if (n.fixed) return;
        const r = g.radius * Math.sqrt(random()); const a = random() * Math.PI * 2;
        n.x = g.cx + r * Math.cos(a); n.y = g.cy + r * Math.sin(a) + (n.kind === 'group' ? -g.radius : 0);
      });
    });
  });
  items.forEach((n) => { if (Number.isNaN(n.x)) { n.x = (random() - 0.5) * spread; n.y = (random() - 0.5) * spread; } });

  const springs = edges.filter((e) => e.kind === 'dependency' && byId.has(e.source) && byId.has(e.target)).map((e) => [byId.get(e.source), byId.get(e.target)]);
  const iterations = Math.max(60, Math.min(260, Math.round(26000 / count)));
  const movable = items.filter((n) => !n.fixed && n.kind !== 'anchor');
  for (let step = 0; step < iterations; step += 1) {
    if (step % 20 === 0 && shouldCancel()) return { positions: {}, cancelled: true };
    const heat = 1 - step / iterations;
    const centroids = new Map();
    groups.forEach((g) => {
      let x = 0; let y = 0; let top = Infinity;
      g.members.forEach((n) => { x += n.x; y += n.y; if (n.kind === 'capability') top = Math.min(top, n.y - n.h / 2); });
      centroids.set(g.key, { x: x / g.members.length, y: y / g.members.length, top: Number.isFinite(top) ? top : y / g.members.length, radius: g.radius, owner: g.owner });
    });
    movable.forEach((n) => {
      const c = centroids.get(n.group);
      if (!c) return;
      const anchor = anchorOf(n.owner);
      let fx = (c.x - n.x) * 0.06 + (anchor.x - n.x) * 0.012;
      let fy = (c.y - n.y) * 0.06 + (anchor.y - n.y) * 0.012;
      if (n.kind === 'group') { fx += (c.x - n.x) * 0.1; fy += (c.top - n.h - MARGIN - n.y) * 0.25; }
      // Keep groups apart from one another.
      centroids.forEach((other, key) => {
        if (key === n.group) return;
        const dx = n.x - other.x; const dy = n.y - other.y;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = other.radius + 140;
        if (dist < reach) { fx += (dx / dist) * (reach - dist) * 0.05; fy += (dy / dist) * (reach - dist) * 0.05; }
      });
      // Keep each owner's groups on its side of the responsibility boundary.
      if (n.owner === 'appliance' && n.x > -40) fx -= (n.x + 40) * 0.08;
      if (n.owner === 'federated' && n.x < 40) fx += (40 - n.x) * 0.08;
      n.vx = fx; n.vy = fy;
    });
    springs.forEach(([a, b]) => {
      const dx = b.x - a.x; const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = (dist - 340) * 0.012;
      if (!a.fixed && a.vx !== undefined) { a.vx += (dx / dist) * force; a.vy += (dy / dist) * force; }
      if (!b.fixed && b.vx !== undefined) { b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force; }
    });
    const limit = 18 + 60 * heat;
    movable.forEach((n) => {
      const speed = Math.hypot(n.vx || 0, n.vy || 0);
      const scale = speed > limit ? limit / speed : 1;
      n.x += (n.vx || 0) * scale; n.y += (n.vy || 0) * scale;
    });
    separate(items, 0.6);
  }
  // Final collision-only passes so generated cards never overlap.
  for (let pass = 0; pass < 2000; pass += 1) {
    if (pass % 50 === 0 && shouldCancel()) return { positions: {}, cancelled: true };
    if (!separate(items, 1)) break;
  }
  const positions = {};
  items.forEach((n) => { positions[n.id] = { x: Math.round(n.x - n.w / 2), y: Math.round(n.y - n.h / 2) }; });
  return { positions, cancelled: false };
}

export function rectsOverlap(a, b, margin = 0) {
  return a.x < b.x + b.width + margin && b.x < a.x + a.width + margin && a.y < b.y + b.height + margin && b.y < a.y + a.height + margin;
}
