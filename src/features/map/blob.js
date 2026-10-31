// Organic region outlines in graph coordinates. A region is the convex hull of its members' padded
// rectangles, gently perturbed outward and smoothed into a closed Catmull-Rom/Bezier path, so it always
// contains its cards and pans/zooms with them.
import { mulberry32 } from './layout.js';

function hull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = []; const upper = [];
  sorted.forEach((p) => { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); });
  [...sorted].reverse().forEach((p) => { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); });
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

// rects: [{ x, y, width, height }] top-left. Returns outline points (clockwise) around all rects.
export function blobOutline(rects, padding = 28, seed = 1) {
  if (!rects.length) return [];
  const random = mulberry32(seed);
  const corners = rects.flatMap((r) => {
    const x0 = r.x - padding; const y0 = r.y - padding; const x1 = r.x + r.width + padding; const y1 = r.y + r.height + padding;
    return [{ x: x0, y: y0 }, { x: (x0 + x1) / 2, y: y0 }, { x: x1, y: y0 }, { x: x1, y: (y0 + y1) / 2 }, { x: x1, y: y1 }, { x: (x0 + x1) / 2, y: y1 }, { x: x0, y: y1 }, { x: x0, y: (y0 + y1) / 2 }];
  });
  const points = hull(corners);
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  // Push each vertex outward a little for an organic, never-shrinking outline.
  return points.map((p) => {
    const dx = p.x - cx; const dy = p.y - cy; const d = Math.hypot(dx, dy) || 1;
    const bump = padding * (0.25 + 0.55 * random());
    return { x: p.x + (dx / d) * bump, y: p.y + (dy / d) * bump };
  });
}

export function blobPath(points) {
  if (!points.length) return '';
  if (points.length < 3) return `M${points[0].x},${points[0].y}Z`;
  const n = points.length;
  const at = (i) => points[(i + n) % n];
  let d = `M${at(0).x.toFixed(1)},${at(0).y.toFixed(1)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1); const p1 = at(i); const p2 = at(i + 1); const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return `${d}Z`;
}

// Sample the smoothed outline (for containment tests).
export function sampleBlob(points, steps = 12) {
  const n = points.length; const out = [];
  if (n < 3) return points;
  const at = (i) => points[(i + n) % n];
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1); const p1 = at(i); const p2 = at(i + 1); const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps; const u = 1 - t;
      out.push({ x: u ** 3 * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * p2.x, y: u ** 3 * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * p2.y });
    }
  }
  return out;
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]; const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
