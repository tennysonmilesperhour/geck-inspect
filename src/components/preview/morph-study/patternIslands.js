// Select complete pigment islands. Never cut a moving geometric boundary through
// a painted patch or vary its opacity. This is an illustration study, not a
// biological growth model or a reconstruction of one animal in two views.
export function pigmentIslands(pixels, width, height) {
  const count = width * height;
  const connected = new Uint8Array(count);
  // Bridge the fine ink lines inside a patch when grouping it. Only the original
  // pigment pixels are rendered; the expanded grouping area never adds pigment.
  for (let at = 0; at < count; at++) {
    if (pixels[at * 4 + 3] < 32) continue;
    const x = at % width, y = Math.floor(at / width);
    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
      for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) connected[yy * width + xx] = 1;
    }
  }
  const labels = new Uint32Array(count);
  const queue = new Uint32Array(count);
  const groups = [];
  let id = 0;
  for (let start = 0; start < count; start++) {
    if (!connected[start] || labels[start]) continue;
    id++;
    let head = 0, tail = 1, area = 0, sumX = 0, sumY = 0;
    queue[0] = start; labels[start] = id;
    while (head < tail) {
      const at = queue[head++], x = at % width, y = Math.floor(at / width);
      if (pixels[at * 4 + 3] >= 32) { area++; sumX += x; sumY += y; }
      const neighbors = [x ? at - 1 : -1, x < width - 1 ? at + 1 : -1, y ? at - width : -1, y < height - 1 ? at + width : -1];
      for (const next of neighbors) {
        if (next >= 0 && connected[next] && !labels[next]) { labels[next] = id; queue[tail++] = next; }
      }
    }
    if (area) groups.push({ id, area, x: sumX / area, y: sumY / area });
  }
  return { labels, groups };
}

const hash = n => ((Math.imul(n, 2654435761) >>> 0) % 1000) / 1000;
export function orderedIslands(groups, region, view) {
  const score = g => region === 'lateral'
    ? (view === 'side' ? -g.y : -Math.abs(g.y - 333)) + hash(g.id) * 40
    : hash(Math.round(g.x * 17 + g.y * 31)) * 1000;
  return [...groups].sort((a, b) => score(a) - score(b));
}

export function selectedIslands(groups, stage) {
  const step = Math.max(0, Math.min(4, Math.round(Number(stage) || 0)));
  const threshold = [0, .18, .4, .7, 1][step] * groups.reduce((sum, g) => sum + g.area, 0);
  const selected = new Set();
  let area = 0;
  for (const group of groups) {
    if (area >= threshold) break;
    selected.add(group.id); area += group.area;
  }
  return selected;
}

export function isolatePigment(pixels, labels, selected) {
  const result = new Uint8ClampedArray(pixels);
  for (let at = 0; at < labels.length; at++) {
    if (!selected.has(labels[at])) result[at * 4 + 3] = 0;
  }
  return result;
}

// Small, uneven units with clustered interruptions. Side view uses row zero,
// so changing view preserves that row's longitudinal selection. These windows
// reveal existing drawn pigment; they do not draw replacement crest scales.
const SCALE_WIDTHS = Array.from({ length: 76 }, (_, i) => .7 + hash(i + 127) * .8);
const TOTAL_WIDTH = SCALE_WIDTHS.reduce((sum, width) => sum + width, 0);
export function studyPinSegments(stage, row = 0) {
  const amount = [0, .16, .37, .62, .87, 1][Math.max(0, Math.min(5, Math.round(Number(stage) || 0)))];
  if (!amount) return [];
  if (amount === 1) return [{ start: 0, length: 100 }];
  const clusters = row ? [9, 34, 59, 72] : [5, 27, 48, 66];
  const units = SCALE_WIDTHS.map((width, i) => ({
    index: i, width: width / TOTAL_WIDTH * 100,
    rank: Math.min(...clusters.map(c => Math.abs(c - i))) + hash(i + row * 137) * 4,
  }));
  const chosen = new Set([...units].sort((a, b) => a.rank - b.rank).slice(0, Math.round(units.length * amount)).map(u => u.index));
  const segments = [];
  let start = 0;
  for (const unit of units) {
    if (chosen.has(unit.index)) {
      const previous = segments.at(-1);
      if (previous && Math.abs(previous.start + previous.length - start) < .00001) previous.length += unit.width;
      else segments.push({ start, length: unit.width });
    }
    start += unit.width;
  }
  return segments;
}

export const STUDY_CONTROLS = [
  { key: 'dorsal', label: 'Dorsal pattern', steps: ['None', 'A few patches', 'Some patches', 'Broad pattern', 'All drawn patches'], hint: 'The broad field between the crest rows.' },
  { key: 'lateral', label: 'Flank & limb pattern', steps: ['None', 'A few patches', 'Some patches', 'Broad pattern', 'All drawn patches'], hint: 'Whole patches, beginning on the lower sides and limbs.' },
  { key: 'pinstripe', label: 'Pinstripe continuity', steps: ['None', 'Isolated clusters', 'Interrupted', 'Many connected scales', 'Few interruptions', 'Continuous drawing'], hint: 'Changes the crest rows only; body color stays fixed.' },
  { key: 'spots', label: 'Discrete spots', steps: ['None', 'A few spots', 'Scattered spots', 'Many spots', 'All drawn spots'], hint: 'Whole spots at their original pigment strength.' },
  { key: 'tiger', label: 'Transverse banding', steps: ['Hidden', 'Shown'], hint: 'A comparison layer. This does not turn tiger into brindle.' },
];
export const EMPTY_STAGES = Object.freeze(Object.fromEntries(STUDY_CONTROLS.map(c => [c.key, 0])));
export const normalizeStages = input => Object.fromEntries(STUDY_CONTROLS.map(c => [c.key, Math.max(0, Math.min(c.steps.length - 1, Math.round(Number(input?.[c.key]) || 0)))]));
