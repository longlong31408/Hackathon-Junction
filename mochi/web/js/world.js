/* Mochi — Whisker Isles: a top-down ¾ open world of small islands joined by
   bridges. Tap-to-walk (A*), optional joystick, balloon fast travel, couch
   mode, soft fog of war, collectibles, friendly NPC cats, day/night.
   Terrain is rendered in cached chunks that stream in and out with the camera. */
'use strict';
(function (M) {
  const T = 32, WW = 128, WH = 100, CH = 8; // tile px, world tiles, chunk tiles
  const WATER = 0, SAND = 1, GRASS = 2, MEADOW = 3, FOREST = 4, PATH = 5, BRIDGE = 6, STONE = 7;
  const OUT = '#5B4636';
  const ISLANDS = [
    { id: 'home', name: 'Home Isle', icon: '🏡', cx: 40, cy: 52, rx: 12, ry: 10, ground: GRASS, edge: 0.74 },
    { id: 'meadow', name: 'Sleepy Meadow', icon: '🌾', cx: 42, cy: 20, rx: 18, ry: 11, ground: MEADOW, edge: 0.8 },
    { id: 'woods', name: 'Whispering Woods', icon: '🌳', cx: 90, cy: 46, rx: 19, ry: 15, ground: FOREST, edge: 0.84 },
    { id: 'beach', name: 'Bottle Beach', icon: '🏖️', cx: 52, cy: 84, rx: 22, ry: 9, ground: SAND, edge: 0 },
    { id: 'islet', name: 'Pebble Islet', icon: '🪨', cx: 17, cy: 53, rx: 4.5, ry: 3.5, ground: GRASS, edge: 0.6 },
  ];
  const BRIDGES = [[39, 27, 2, 19], [49, 51, 27, 2], [43, 58, 2, 21], [62, 90, 2, 8]]; // x, y, w, h (only over water)
  const STONES = [[19, 53, 12, 1]];
  const PATHS = [
    [[40, 48.5], [35.5, 47.5], [35.5, 42], [39.5, 39]], [[40, 48], [45, 50], [52, 51.5]], [[40, 48], [43.5, 54], [43.5, 60]], [[40, 48], [34, 52], [28, 53]],
    [[39.5, 30], [40, 24], [47, 18]], [[40, 24], [33, 22]], [[40, 24], [38, 16]],
    [[73, 51.5], [80, 52], [87, 41]], [[80, 52], [79, 55]], [[87, 41], [98, 48]], [[80, 52], [89, 57], [92, 59]], [[87, 41], [84, 45]],
    [[43.5, 77], [44, 82], [50, 89]], [[44, 82], [36, 84]], [[50, 89], [62, 89.5], [62.5, 91]], [[50, 89], [66, 86], [72, 86]],
  ];
  const POIS = [
    { id: 'door', name: 'Mansion door', icon: '🚪', x: 40, y: 47.6, action: 'home', travel: true, label: 'Home' },
    { id: 'balloon-home', name: 'Home balloon', icon: '🎈', x: 46.5, y: 47.5, action: 'balloon', balloon: '#FF9EB5' },
    { id: 'balloon-meadow', name: 'Meadow balloon', icon: '🎈', x: 33, y: 22, action: 'balloon', balloon: '#FFE08A', travel: true, label: 'Sleepy Meadow' },
    { id: 'balloon-woods', name: 'Woods balloon', icon: '🎈', x: 79, y: 55.5, action: 'balloon', balloon: '#BDE6CF', travel: true, label: 'Whispering Woods' },
    { id: 'balloon-beach', name: 'Beach balloon', icon: '🎈', x: 36, y: 84, action: 'balloon', balloon: '#A9D6F5', travel: true, label: 'Bottle Beach' },
    { id: 'shore', name: 'The shoreline', icon: '🍾', x: 50, y: 89.5, action: 'bottles', travel: true, label: 'Bottle shore' },
    { id: 'pier', name: 'Fishing pier', icon: '🎣', x: 62.5, y: 96.5, action: 'fish', travel: true, label: 'Fishing pier' },
    { id: 'picnic', name: 'Cloud-watching blanket', icon: '☁️', x: 47, y: 17.5, action: 'clouds', travel: true, label: 'Cloud blanket' },
    { id: 'worrytree', name: 'The whispering tree', icon: '🍃', x: 87.5, y: 41.5, action: 'leaf', travel: true, label: 'Whispering tree' },
    { id: 'garden', name: 'Hope garden', icon: '🌱', x: 98.5, y: 48.5, action: 'seed', travel: true, label: 'Hope garden' },
    { id: 'dock-beach', name: 'Paper-boat dock', icon: '⛵', x: 72, y: 86.5, action: 'boat', to: 'dock-woods' },
    { id: 'dock-woods', name: 'Paper-boat dock', icon: '⛵', x: 92, y: 59.5, action: 'boat', to: 'dock-beach' },
  ];
  const NPCS = [
    { id: 'pebble', name: 'Pebble', x: 46, y: 51, coat: 'tuxedo', acc: 'bow' },
    { id: 'biscuit', name: 'Biscuit', x: 37, y: 15.5, coat: 'cream', acc: 'straw' },
    { id: 'sage', name: 'Old Sage', x: 83.5, y: 45.5, coat: 'mist', acc: 'glasses' },
    { id: 'pudding', name: 'Pudding', x: 46.5, y: 87, coat: 'ginger', acc: 'sailor' },
  ];
  const COLLECT_SPOTS = {
    shell: [[34, 82], [40, 88], [48, 79], [56, 91], [64, 82], [70, 84], [58, 77]],
    leaf: [[78, 38], [84, 34], [96, 36], [104, 44], [100, 54], [86, 56], [76, 46]],
    stamp: [[30, 16], [52, 12], [56, 24], [33, 47], [48, 58]],
    statue: [[16, 52.5], [106, 40], [26, 23]],
  };

  // ------------------------------------------------------------------ world generation
  const bdir = new Uint8Array(WW * WH); // 1 = bridge runs north-south, 2 = east-west
  const tiles = new Uint8Array(WW * WH), isl = new Int8Array(WW * WH).fill(-1), solid = new Uint8Array(WW * WH), wdist = new Uint8Array(WW * WH);
  const idx = (x, y) => y * WW + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < WW && y < WH;
  const tileAt = (x, y) => (inb(x, y) ? tiles[idx(x, y)] : WATER);
  const walkable = (x, y) => inb(x, y) && tiles[idx(x, y)] !== WATER && !solid[idx(x, y)];
  const isLand = (t) => t === SAND || t === GRASS || t === MEADOW || t === FOREST || t === PATH;

  function vnoise(x, y, s) {
    const xi = Math.floor(x / s), yi = Math.floor(y / s), xf = x / s - xi, yf = y / s - yi;
    const a = M.hash2(xi, yi), b = M.hash2(xi + 1, yi), c = M.hash2(xi, yi + 1), d = M.hash2(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return M.lerp(M.lerp(a, b, u), M.lerp(c, d, u), v);
  }

  const objects = []; // static props {type, x, y, v}
  const buckets = new Map(); // chunk key -> props
  let collectibles = [], pois = [], npcs = [];

  function generate() {
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      let best = -1, bd = 9;
      ISLANDS.forEach((I, i) => {
        let d = Math.pow((x + 0.5 - I.cx) / I.rx, 2) + Math.pow((y + 0.5 - I.cy) / I.ry, 2);
        d += (vnoise(x, y, 4) - 0.5) * 0.34 + (vnoise(x + 50, y + 50, 2) - 0.5) * 0.12;
        if (d < bd) { bd = d; best = i; }
      });
      if (bd < 1) {
        const I = ISLANDS[best];
        tiles[idx(x, y)] = I.ground === SAND || bd > I.edge ? SAND : I.ground;
        isl[idx(x, y)] = best;
      }
    }
    for (const [bx, by, bw, bh] of BRIDGES) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (tileAt(x, y) === WATER) { tiles[idx(x, y)] = BRIDGE; bdir[idx(x, y)] = bh > bw ? 1 : 2; }
    for (const [bx, by, bw, bh] of STONES) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (tileAt(x, y) === WATER) tiles[idx(x, y)] = STONE;
    // paths (only over land)
    for (const line of PATHS) for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1];
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
      let px0 = null, py0 = null;
      const paint = (tx, ty) => { if (inb(tx, ty) && isLand(tiles[idx(tx, ty)])) tiles[idx(tx, ty)] = PATH; };
      for (let k = 0; k <= n; k++) {
        const tx = Math.floor(M.lerp(ax, bx, k / n)), ty = Math.floor(M.lerp(ay, by, k / n));
        if (px0 !== null && tx !== px0 && ty !== py0) paint(tx, py0); // keep the path 4-connected
        paint(tx, ty); px0 = tx; py0 = ty;
      }
    }
    // distance to land for shallow water
    const q = [];
    for (let i = 0; i < tiles.length; i++) { if (tiles[i] !== WATER) { wdist[i] = 0; q.push(i); } else wdist[i] = 9; }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % WW, y = (i / WW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
        const j = idx(nx, ny); if (wdist[j] > wdist[i] + 1) { wdist[j] = wdist[i] + 1; if (wdist[j] < 4) q.push(j); }
      }
    }
    // the mansion façade
    addProp('mansion', 40.5, 46.9, 0);
    for (let y = 43; y <= 46; y++) for (let x = 37; x <= 43; x++) solid[idx(x, y)] = 1;
    // POIs, NPCs (snap to land, keep their surroundings clear)
    pois = POIS.map((p) => Object.assign({}, p));
    npcs = NPCS.map((n) => Object.assign({ line: 0 }, n));
    const keepClear = [];
    pois.forEach((p) => keepClear.push([p.x, p.y, 2.6]));
    npcs.forEach((n) => keepClear.push([n.x, n.y, 2]));
    Object.values(COLLECT_SPOTS).forEach((arr) => arr.forEach(([x, y]) => keepClear.push([x, y, 1.5])));
    keepClear.push([101, 40, 1.5]);
    const clear = (x, y) => !keepClear.some(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r);
    const nearPath = (x, y, r) => { for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) { const t = tileAt(x + ox, y + oy); if (t === PATH || t === BRIDGE || t === STONE) return true; } return false; };
    const rnd = M.rng(2026);
    for (let y = 1; y < WH - 1; y++) for (let x = 1; x < WW - 1; x++) {
      const t = tiles[idx(x, y)], r = rnd(), r2 = rnd();
      if (solid[idx(x, y)] || !clear(x, y)) continue;
      const I = isl[idx(x, y)] >= 0 ? ISLANDS[isl[idx(x, y)]].id : '';
      let type = null;
      if (t === FOREST && !nearPath(x, y, 1) && r < 0.36) type = r2 < 0.3 ? 'pine' : 'tree';
      else if (t === MEADOW && !nearPath(x, y, 1) && r < 0.022) type = 'tree';
      else if (t === MEADOW && !nearPath(x, y, 1) && r < 0.05) type = 'bush';
      else if (t === GRASS && I === 'home' && !nearPath(x, y, 1) && r < 0.05) type = r2 < 0.5 ? 'tree' : 'bush';
      else if (t === SAND && I === 'beach' && !nearPath(x, y, 1) && r < 0.025) type = 'palm';
      else if (t === SAND && I !== 'beach' && wdist[idx(x, y)] === 0 && r < 0.03) type = 'rock';
      if (type) { addProp(type, x + 0.5, y + 0.85, Math.floor(r2 * 5)); solid[idx(x, y)] = 1; }
    }
    // landmark props
    addProp('worrytree', 87.5, 40.2, 0); solid[idx(87, 40)] = 1; solid[idx(88, 40)] = 1;
    // reachability from the mansion door
    const reach = reachable(40, 48);
    const snap = (x, y) => {
      const tx = Math.floor(x), ty = Math.floor(y);
      if (reach[idx(tx, ty)]) return [x, y];
      for (let r = 1; r < 8; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        const nx = tx + ox, ny = ty + oy;
        if (inb(nx, ny) && reach[idx(nx, ny)]) return [nx + 0.5, ny + 0.5];
      }
      return [x, y];
    };
    pois.forEach((p) => { [p.x, p.y] = snap(p.x, p.y); });
    npcs.forEach((n) => { [n.x, n.y] = snap(n.x, n.y); });
    collectibles = [];
    Object.entries(COLLECT_SPOTS).forEach(([kind, arr]) => arr.forEach(([x, y], i) => {
      const [sx, sy] = snap(x, y);
      collectibles.push({ id: kind + '-' + i, kind, name: M.data.COLLECTIBLES[kind].names[i], x: sx * T, y: sy * T });
    }));
    const [scx, scy] = snap(101, 40);
    collectibles.push({ id: 'scarf', kind: 'scarf', name: "Biscuit's striped scarf", x: scx * T, y: scy * T });
    pois.forEach((p) => { p.px = p.x * T; p.py = p.y * T; });
    npcs.forEach((n) => { n.px = n.x * T; n.py = n.y * T; });
    world.debug = { reach, pois, npcs, collectibles };
  }

  function addProp(type, x, y, v) {
    const p = { type, x: x * T, y: y * T, v };
    objects.push(p);
    const key = Math.floor(p.x / (CH * T)) + ',' + Math.floor(p.y / (CH * T));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  }

  function reachable(sx, sy) {
    const seen = new Uint8Array(WW * WH), q = [idx(sx, sy)]; seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % WW, y = (i / WW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (walkable(nx, ny) && !seen[idx(nx, ny)]) { seen[idx(nx, ny)] = 1; q.push(idx(nx, ny)); }
      }
    }
    return seen;
  }

  // ------------------------------------------------------------------ pathfinding (A*, 8-way, no corner cutting)
  function findPath(sx, sy, gx, gy) {
    if (!walkable(gx, gy)) return null;
    const N = WW * WH, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = []; // [f, i]
    const push = (f, i) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const hfn = (x, y) => { const dx = Math.abs(x - gx), dy = Math.abs(y - gy); return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    const s = idx(sx, sy), goal = idx(gx, gy);
    g[s] = 0; push(hfn(sx, sy), s);
    let iter = 0;
    while (heap.length && iter++ < 30000) {
      const [, i] = pop();
      if (i === goal) break;
      if (closed[i]) continue; closed[i] = 1;
      const x = i % WW, y = (i / WW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!walkable(nx, ny)) continue;
        if (dx && dy && (!walkable(x + dx, y) || !walkable(x, y + dy))) continue;
        const j = idx(nx, ny), ng = g[i] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + hfn(nx, ny), j); }
      }
    }
    if (from[goal] === -1 && goal !== s) return null;
    const out = [];
    for (let i = goal; i !== s && i !== -1; i = from[i]) out.push([(i % WW + 0.5) * T, (((i / WW) | 0) + 0.5) * T]);
    return out.reverse();
  }
  function lineClear(ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
    for (let k = 0; k <= n; k++) {
      const x = M.lerp(ax, bx, k / n), y = M.lerp(ay, by, k / n);
      for (const [ox, oy] of [[-7, 0], [7, 0], [0, -5], [0, 5]]) if (!walkable(Math.floor((x + ox) / T), Math.floor((y + oy) / T))) return false;
    }
    return true;
  }
  function smooth(path, sx, sy) {
    if (!path || path.length < 3) return path;
    const out = []; let cx = sx, cy = sy, i = 0;
    while (i < path.length) {
      let j = path.length - 1;
      while (j > i && !lineClear(cx, cy, path[j][0], path[j][1])) j--;
      out.push(path[j]); cx = path[j][0]; cy = path[j][1]; i = j + 1;
    }
    return out;
  }
  function nearestWalkable(tx, ty, maxR) {
    if (walkable(tx, ty)) return [tx, ty];
    for (let r = 1; r <= (maxR || 4); r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
      if (walkable(tx + ox, ty + oy)) return [tx + ox, ty + oy];
    }
    return null;
  }

  // ------------------------------------------------------------------ terrain chunks
  const chunks = new Map();
  let chunkScale = 1;
  const COL = {
    deep: '#94C9EE', mid: '#A9D6F5', shallow: '#C2E7F8', lip: '#D9BE8A', sand: '#F6E3B4',
    grass: '#B5E0A5', meadow: '#C9EBB0', forest: '#9ED19A', path: '#EFD9B0', greenLip: '#8FC58E',
  };
  function layer(c, x0, y0, pred, colorFn, dy) {
    for (let y = y0 - 1; y < y0 + CH + 1; y++) for (let x = x0 - 1; x < x0 + CH + 1; x++) {
      if (!pred(x, y)) continue;
      const r = T * 0.46;
      const L = pred(x - 1, y), Rr = pred(x + 1, y), U = pred(x, y - 1), Dn = pred(x, y + 1);
      c.fillStyle = colorFn(x, y);
      M.rr(c, x * T - 0.3, y * T + (dy || 0) - 0.3, T + 0.6, T + 0.6, [!L && !U ? r : 0, !Rr && !U ? r : 0, !Rr && !Dn ? r : 0, !L && !Dn ? r : 0]);
      c.fill();
    }
  }
  function renderChunk(cx, cy) {
    const cv = document.createElement('canvas');
    const px = CH * T;
    cv.width = cv.height = Math.ceil(px * chunkScale);
    const c = cv.getContext('2d');
    c.scale(chunkScale, chunkScale); c.translate(-cx * px, -cy * px);
    const x0 = cx * CH, y0 = cy * CH;
    for (let y = y0; y < y0 + CH; y++) for (let x = x0; x < x0 + CH; x++) {
      const d = inb(x, y) ? wdist[idx(x, y)] : 9;
      c.fillStyle = d >= 3 ? COL.deep : COL.mid; c.fillRect(x * T, y * T, T, T);
    }
    const land = (x, y) => isLand(tileAt(x, y));
    const green = (x, y) => { const t = tileAt(x, y); if (t === GRASS || t === MEADOW || t === FOREST) return true; if (t === PATH) { const i = inb(x, y) ? isl[idx(x, y)] : -1; return i >= 0 && ISLANDS[i].ground !== SAND; } return false; };
    layer(c, x0, y0, (x, y) => land(x, y) || (inb(x, y) && wdist[idx(x, y)] <= 1), () => COL.shallow);
    layer(c, x0, y0, land, () => COL.lip, 5);
    layer(c, x0, y0, land, () => COL.sand);
    layer(c, x0, y0, green, () => COL.greenLip, 3);
    layer(c, x0, y0, green, (x, y) => { const i = isl[idx(x, y)]; const g = i >= 0 ? ISLANDS[i].ground : GRASS; return g === MEADOW ? COL.meadow : g === FOREST ? COL.forest : COL.grass; });
    layer(c, x0, y0, (x, y) => tileAt(x, y) === PATH, () => COL.path);
    // texture
    c.lineCap = 'round';
    for (let y = y0; y < y0 + CH; y++) for (let x = x0; x < x0 + CH; x++) {
      const t = tileAt(x, y), hsh = M.hash2(x * 3 + 1, y * 7 + 2), h2 = M.hash2(x + 99, y - 7);
      const bx = x * T + 6 + h2 * 20, by = y * T + 6 + hsh * 20;
      if (t === GRASS || t === MEADOW || t === FOREST) {
        if (hsh < 0.35) { c.strokeStyle = t === FOREST ? '#86BF84' : '#9CCF8E'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(bx - 3, by); c.lineTo(bx - 1, by - 5); c.moveTo(bx + 1, by); c.lineTo(bx + 3, by - 5); c.stroke(); }
        const flowerChance = t === MEADOW ? 0.45 : t === GRASS ? 0.12 : 0.04;
        if (h2 < flowerChance) {
          const fx = x * T + 4 + hsh * 24, fy = y * T + 4 + h2 * 50 % 24;
          c.fillStyle = ['#FF9EB5', '#FFE08A', '#FFFDF8', '#CFC4F2'][Math.floor(hsh * 40) % 4];
          for (let k = 0; k < 5; k++) { const a = k * 1.256; c.beginPath(); c.arc(fx + Math.cos(a) * 2.2, fy + Math.sin(a) * 2.2, 1.7, 0, 7); c.fill(); }
          c.fillStyle = '#FFC85A'; c.beginPath(); c.arc(fx, fy, 1.2, 0, 7); c.fill();
        }
        if (t === FOREST && h2 > 0.97) { c.fillStyle = '#F4A99A'; c.beginPath(); c.arc(bx, by - 3, 4, Math.PI, 0); c.fill(); c.fillStyle = '#FFFDF8'; c.fillRect(bx - 1.5, by - 3, 3, 4); }
      } else if (t === SAND) {
        if (hsh < 0.5) { c.fillStyle = 'rgba(200,170,120,0.45)'; c.beginPath(); c.arc(bx, by, 1.2, 0, 7); c.arc(bx + 6, by + 3, 1, 0, 7); c.fill(); }
      } else if (t === BRIDGE) {
        const vertical = bdir[idx(x, y)] === 1;
        c.fillStyle = '#D9B48F'; c.fillRect(x * T, y * T, T, T);
        c.strokeStyle = 'rgba(91,70,54,0.45)'; c.lineWidth = 1.5;
        for (let k = 0; k < 4; k++) { c.beginPath(); if (vertical) { c.moveTo(x * T, y * T + k * 8 + 4); c.lineTo(x * T + T, y * T + k * 8 + 4); } else { c.moveTo(x * T + k * 8 + 4, y * T); c.lineTo(x * T + k * 8 + 4, y * T + T); } c.stroke(); }
        c.fillStyle = '#B98A66';
        if (vertical) { if (tileAt(x - 1, y) !== BRIDGE) c.fillRect(x * T, y * T, 3, T); if (tileAt(x + 1, y) !== BRIDGE) c.fillRect(x * T + T - 3, y * T, 3, T); }
        else { if (tileAt(x, y - 1) !== BRIDGE) c.fillRect(x * T, y * T, T, 3); if (tileAt(x, y + 1) !== BRIDGE) c.fillRect(x * T, y * T + T - 3, T, 3); }
      } else if (t === STONE) {
        c.fillStyle = '#E5E0DA'; c.strokeStyle = OUT; c.lineWidth = 2;
        c.beginPath(); c.ellipse(x * T + 16, y * T + 17, 12, 9, 0, 0, 7); c.fill(); c.stroke();
      }
    }
    return cv;
  }
  function getChunk(cx, cy) {
    const key = cx + ',' + cy;
    let cv = chunks.get(key);
    if (cv) { chunks.delete(key); chunks.set(key, cv); return cv; }
    cv = renderChunk(cx, cy); chunks.set(key, cv);
    while (chunks.size > 36) chunks.delete(chunks.keys().next().value); // unload chunks far behind the cat
    return cv;
  }

  // ------------------------------------------------------------------ sprites
  const sprites = new Map();
  function sprite(type, v) {
    const key = type + v;
    if (sprites.has(key)) return sprites.get(key);
    const w = type === 'mansion' ? 230 : type === 'worrytree' ? 140 : 72, hgt = type === 'mansion' ? 200 : type === 'worrytree' ? 150 : 96;
    const cv = document.createElement('canvas'); cv.width = w * chunkScale; cv.height = hgt * chunkScale;
    const c = cv.getContext('2d'); c.scale(chunkScale, chunkScale);
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.lineJoin = 'round';
    const fx = w / 2, fy = hgt - 6;
    c.fillStyle = 'rgba(91,70,54,0.16)'; c.beginPath(); c.ellipse(fx, fy, type === 'mansion' ? 100 : type === 'worrytree' ? 40 : 18, type === 'mansion' ? 10 : 6, 0, 0, 7); c.fill();
    const canopy = ['#9ED19A', '#8CCB8A', '#B5DE8C', '#F2C17F', '#F4B6C2'][v % 5];
    if (type === 'tree' || type === 'worrytree') {
      const s = type === 'worrytree' ? 1.9 : 1;
      c.save(); c.translate(fx, fy); c.scale(s, s);
      c.fillStyle = '#B98A66'; M.rr(c, -5, -30, 10, 30, 3); c.fill(); c.stroke();
      c.fillStyle = type === 'worrytree' ? '#D9CCF5' : canopy; // the whispering tree has soft lavender leaves
      c.beginPath(); c.arc(0, -44, 19, 0, 7); c.arc(-13, -36, 13, 0, 7); c.arc(13, -36, 13, 0, 7); c.fill();
      c.beginPath(); c.arc(0, -44, 19, Math.PI * 0.9, Math.PI * 2.1); c.stroke();
      c.beginPath(); c.arc(-13, -36, 13, Math.PI * 0.5, Math.PI * 1.35); c.stroke();
      c.beginPath(); c.arc(13, -36, 13, Math.PI * 1.65, Math.PI * 2.5); c.stroke();
      c.beginPath(); c.moveTo(-13, -23); c.quadraticCurveTo(0, -20, 13, -23); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(-5, -50, 6, 0, 7); c.fill();
      c.restore();
    } else if (type === 'pine') {
      c.fillStyle = '#B98A66'; M.rr(c, fx - 4, fy - 16, 8, 16, 2); c.fill(); c.stroke();
      c.fillStyle = '#7FBF8E';
      for (let k = 0; k < 3; k++) { const yy = fy - 14 - k * 16; c.beginPath(); c.moveTo(fx - 20 + k * 4, yy); c.quadraticCurveTo(fx, yy - 30 + k * 3, fx + 20 - k * 4, yy); c.closePath(); c.fill(); c.stroke(); }
    } else if (type === 'palm') {
      c.strokeStyle = OUT; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + 8, fy - 30, fx + 2, fy - 56); c.stroke();
      c.strokeStyle = '#C9A27F'; c.lineWidth = 5.5; c.stroke();
      c.lineWidth = 2.2; c.strokeStyle = OUT; c.fillStyle = '#9ED19A';
      for (const a of [-2.6, -1.9, -1.2, -0.5, 0.2]) { c.save(); c.translate(fx + 2, fy - 56); c.rotate(a); c.beginPath(); c.ellipse(16, 0, 17, 5.5, 0, 0, 7); c.fill(); c.stroke(); c.restore(); }
      c.fillStyle = '#B98A66'; c.beginPath(); c.arc(fx - 2, fy - 52, 4, 0, 7); c.arc(fx + 5, fy - 51, 4, 0, 7); c.fill();
    } else if (type === 'bush') {
      c.fillStyle = canopy === '#F2C17F' ? '#9ED19A' : canopy;
      c.beginPath(); c.arc(fx - 9, fy - 9, 10, 0, 7); c.arc(fx + 9, fy - 9, 10, 0, 7); c.arc(fx, fy - 16, 11, 0, 7); c.fill();
      c.beginPath(); c.arc(fx - 9, fy - 9, 10, Math.PI * 0.5, Math.PI * 1.4); c.arc(fx, fy - 16, 11, Math.PI * 1.1, Math.PI * 1.9); c.arc(fx + 9, fy - 9, 10, Math.PI * 1.6, Math.PI * 2.5); c.stroke();
      if (v % 2) { c.fillStyle = '#FF9EB5'; c.beginPath(); c.arc(fx - 6, fy - 14, 2.5, 0, 7); c.arc(fx + 7, fy - 10, 2.5, 0, 7); c.fill(); }
    } else if (type === 'rock') {
      c.fillStyle = '#DAD4CE'; c.beginPath(); c.ellipse(fx, fy - 8, 14, 10, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(fx - 4, fy - 12, 5, 3, -0.3, 0, 7); c.fill();
    } else if (type === 'mansion') {
      const x0 = fx - 96, y0 = fy - 150;
      c.fillStyle = '#E8B79A'; M.rr(c, x0 + 140, y0 - 6, 22, 40, 3); c.fill(); c.stroke();
      c.fillStyle = '#F7D9BC'; M.rr(c, x0 + 12, y0 + 50, 168, 100, 4); c.fill(); c.stroke();
      c.fillStyle = '#F0A38A'; c.beginPath(); c.moveTo(x0, y0 + 56); c.quadraticCurveTo(x0 + 50, y0 + 26, x0 + 96, y0 + 2); c.quadraticCurveTo(x0 + 142, y0 + 26, x0 + 192, y0 + 56); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#FFFDF8'; c.beginPath(); c.arc(x0 + 96, y0 + 34, 10, 0, 7); c.fill(); c.stroke();
      for (const [wx, wy] of [[x0 + 30, y0 + 66], [x0 + 132, y0 + 66], [x0 + 30, y0 + 108]]) { c.fillStyle = '#A9D6F5'; M.rr(c, wx, wy, 30, 24, 4); c.fill(); c.stroke(); c.beginPath(); c.moveTo(wx + 15, wy); c.lineTo(wx + 15, wy + 24); c.stroke(); }
      c.fillStyle = '#8FCB9B'; c.beginPath(); c.moveTo(x0 + 80, y0 + 150); c.lineTo(x0 + 80, y0 + 112); c.quadraticCurveTo(x0 + 96, y0 + 92, x0 + 112, y0 + 112); c.lineTo(x0 + 112, y0 + 150); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#FFE08A'; c.beginPath(); c.arc(x0 + 106, y0 + 132, 2.5, 0, 7); c.fill();
      c.fillStyle = '#E5CDB0'; M.rr(c, x0 + 74, y0 + 148, 44, 6, 2); c.fill(); c.stroke();
      c.fillStyle = '#FF9EB5'; for (const bx of [x0 + 20, x0 + 64, x0 + 128, x0 + 170]) { c.beginPath(); c.arc(bx, y0 + 147, 4, 0, 7); c.fill(); }
    }
    const out = { cv, w, h: hgt, ax: fx, ay: fy };
    sprites.set(key, out);
    return out;
  }

  // ------------------------------------------------------------------ fog of war
  const FC = 2, FW = WW / FC, FH = WH / FC, FRES = 6;
  let fog = new Uint8Array(Math.ceil((FW * FH) / 8)), fogCv = null, fogDirty = true, fogT = 0;
  const fogGet = (fx, fy) => (fx < 0 || fy < 0 || fx >= FW || fy >= FH ? 1 : (fog[(fy * FW + fx) >> 3] >> ((fy * FW + fx) & 7)) & 1);
  const fogSet = (fx, fy) => { const i = fy * FW + fx; fog[i >> 3] |= 1 << (i & 7); };
  function reveal(px, py, rTiles) {
    const cx = px / (T * FC), cy = py / (T * FC), r = rTiles / FC;
    let changed = false;
    for (let fy = Math.floor(cy - r); fy <= Math.ceil(cy + r); fy++) for (let fx = Math.floor(cx - r); fx <= Math.ceil(cx + r); fx++) {
      if (fx < 0 || fy < 0 || fx >= FW || fy >= FH) continue;
      if (Math.hypot(fx + 0.5 - cx, fy + 0.5 - cy) <= r && !fogGet(fx, fy)) { fogSet(fx, fy); changed = true; }
    }
    if (changed) { fogDirty = true; fogPackedDirty = true; checkDiscover(); }
    return changed;
  }
  const explored = (px, py) => fogGet(Math.floor(px / (T * FC)), Math.floor(py / (T * FC)));
  function renderFog() {
    if (!fogCv) { fogCv = document.createElement('canvas'); fogCv.width = FW * FRES; fogCv.height = FH * FRES; }
    const c = fogCv.getContext('2d');
    c.clearRect(0, 0, fogCv.width, fogCv.height);
    for (const [col, oy] of [['rgba(214,206,240,0.95)', 1.6], ['rgba(255,253,248,0.97)', 0]]) {
      c.fillStyle = col; c.beginPath();
      for (let fy = 0; fy < FH; fy++) for (let fx = 0; fx < FW; fx++) {
        if (fogGet(fx, fy)) continue;
        const j = M.hash2(fx, fy);
        const x = (fx + 0.5) * FRES + (j - 0.5) * 2, y = (fy + 0.5) * FRES + oy;
        c.moveTo(x + FRES * 0.95, y); c.arc(x, y, FRES * (0.82 + j * 0.25), 0, 7);
      }
      c.fill();
    }
    fogDirty = false;
  }
  function packFog() { let s = ''; for (let i = 0; i < fog.length; i++) s += String.fromCharCode(fog[i]); return btoa(s); }
  function unpackFog(b64) {
    try { const s = atob(b64); if (s.length !== fog.length) return false; for (let i = 0; i < s.length; i++) fog[i] = s.charCodeAt(i); return true; } catch (e) { return false; }
  }

  // ------------------------------------------------------------------ live state
  let canvas, ctx, viewW = 360, viewH = 600, dpr = 1, running = false, raf = 0, last = 0, accum = 0, t = 0;
  const cam = { x: 0, y: 0, free: false };
  const me = { x: 40.5 * T, y: 49 * T, path: [], dir: 1, pose: 'sit', phase: 0, idle: 0, target: null, vel: [0, 0], moving: false };
  const parts = new M.Particles();
  const flyers = []; // paper leaves riding the wind
  let butterflies = [], gulls = [], travel = null, couch = false, couchWait = 0, lastIsland = null, saveT = 0, tapMark = null;
  const keys = {};

  function st() { return M.store.state; }
  function found(id) { return st().world.found.includes(id); }

  function checkDiscover() {
    const disc = st().world.discovered;
    const newly = [];
    pois.forEach((p) => { if (!disc.includes(p.id) && explored(p.px, p.py)) newly.push(p); });
    if (!newly.length) return;
    M.store.update((s) => { newly.forEach((p) => s.world.discovered.push(p.id)); });
    const named = newly.filter((p) => p.travel && p.id !== 'door');
    if (named.length && running) M.ui.toast('Discovered: ' + named.map((p) => p.icon + ' ' + (p.label || p.name)).join(', '));
  }

  function setPathTo(px, py, target, quiet) {
    const sx = Math.floor(me.x / T), sy = Math.floor(me.y / T);
    const goal = nearestWalkable(Math.floor(px / T), Math.floor(py / T), 4);
    if (!goal) { if (!quiet) M.ui.toast(st().cat.name + ' would rather not swim. 🐟'); return false; }
    const start = walkable(sx, sy) ? [sx, sy] : nearestWalkable(sx, sy, 3);
    if (!start) return false;
    if (!walkable(sx, sy)) { me.x = (start[0] + 0.5) * T; me.y = (start[1] + 0.5) * T; }
    const p = findPath(start[0], start[1], goal[0], goal[1]);
    if (!p) { if (!quiet) M.ui.toast('Hmm, ' + st().cat.name + ' can\'t find a way there yet.'); return false; }
    me.path = smooth(p, me.x, me.y);
    if (goal[0] === Math.floor(px / T) && goal[1] === Math.floor(py / T)) me.path.push([px, py]);
    me.target = target || null;
    cam.free = false;
    hideCard();
    if (!me.path.length) { me.target = null; arrive(target); }
    return true;
  }

  function nearestTarget(wx, wy) {
    let best = null, bd = 30;
    if (!couch) {
      for (const b of butterflies) { const d = M.dist(wx, wy, b.x, b.y - 10); if (d < bd) { bd = d; best = { kind: 'butterfly', b }; } }
      for (const n of npcs) { const d = M.dist(wx, wy, n.px, n.py - 18); if (d < 30 && d < bd + 6) { bd = d; best = { kind: 'npc', n }; } }
      for (const p of pois) { const d = M.dist(wx, wy, p.px, p.py - 14); if (d < 34 && d < bd + 6 && explored(p.px, p.py)) { bd = d; best = { kind: 'poi', p }; } }
    }
    return best;
  }

  function onTap(wx, wy) {
    if (travel) return;
    if (couch) { M.$('#couchBar').classList.add('show'); setTimeout(() => M.$('#couchBar').classList.remove('show'), 3000); return; }
    const tg = nearestTarget(wx, wy);
    tapMark = { x: wx, y: wy, t: 0 };
    if (tg && tg.kind === 'butterfly') { setPathTo(tg.b.x, tg.b.y, tg); return; }
    if (tg && tg.kind === 'npc') { const n = tg.n; setPathTo(n.px + (me.x < n.px ? -T : T), n.py, tg); return; }
    if (tg && tg.kind === 'poi') { setPathTo(tg.p.px, tg.p.py, tg); return; }
    setPathTo(wx, wy, null);
  }

  function arrive(tg) {
    if (!tg) return;
    if (tg.kind === 'poi') { me.dir = tg.p.px >= me.x ? 1 : -1; showPoi(tg.p); }
    else if (tg.kind === 'npc') { me.dir = tg.n.px >= me.x ? 1 : -1; talk(tg.n); }
    else if (tg.kind === 'butterfly') {
      const b = tg.b; b.vx = (b.x - me.x) * 3 + M.rand(-60, 60); b.vy = -80; b.flee = 1.5;
      parts.burst('sparkle', b.x, b.y - 10, 5);
      M.ui.toast(M.pick([st().cat.name + ' almost caught it! 🦋', 'So close! The butterfly giggles.', 'Boop! The butterfly flutters away.']));
    }
  }

  // ------------------------------------------------------------------ action card (DOM)
  function showCard(title, text, buttons) {
    const card = M.$('#actionCard');
    card.innerHTML = '';
    M.add(card,
      M.h('button', { class: 'icon-btn card-x', 'aria-label': 'Close', onclick: hideCard }, '✕'),
      M.h('p', { class: 'card-title' }, title),
      text ? M.h('p', { class: 'card-text' }, text) : null,
      buttons && buttons.length ? M.h('div', { class: 'row wrap' }, buttons.map((b) => M.h('button', { class: 'btn ' + (b.primary ? 'primary' : ''), onclick: b.onClick }, b.label))) : null);
    card.hidden = false;
  }
  function hideCard() { const c = M.$('#actionCard'); if (c) { c.hidden = true; c.innerHTML = ''; } }

  function showPoi(p) {
    const name = st().cat.name;
    switch (p.action) {
      case 'home': showCard('🚪 Mansion door', 'Go back inside where it is warm?', [{ label: '🏠 Go inside', primary: true, onClick: () => M.app.show('home') }]); break;
      case 'balloon': showCard('🎈 Balloon stop', 'Float to any place you have already found. No walking needed.', [{ label: '🎈 Where to?', primary: true, onClick: () => world.openTravel() }]); break;
      case 'bottles': showCard('🍾 Bottle Beach shore', 'Toss a message out to sea, or see what washed ashore.', [
        { label: '🔍 Find bottles', primary: true, onClick: () => { hideCard(); M.bottles.open('inbox'); } },
        { label: '✉️ Throw one', onClick: () => { hideCard(); M.bottles.open('write'); } }]); break;
      case 'fish': showCard('🎣 Fishing pier', name + ' brought a tiny fishing rod. Nothing can go wrong here.', [{ label: '🎣 Fish for a bit', primary: true, onClick: () => { hideCard(); M.games.fishing(); } }]); break;
      case 'clouds': showCard('☁️ Cloud-watching blanket', 'Lie in the grass with ' + name + ' and breathe along with the clouds.', [{ label: '☁️ Watch the clouds', primary: true, onClick: () => { hideCard(); M.calm.breathe({ theme: 'clouds' }); } }]); break;
      case 'leaf': showCard('🍃 The whispering tree', 'Hang a worry on a paper leaf and let the wind carry it away.', [{ label: '🍃 Hang a worry', primary: true, onClick: () => { hideCard(); leafSheet(); } }]); break;
      case 'seed': showCard('🌱 Hope garden', gardenSummary(), [{ label: '🌱 Visit the garden', primary: true, onClick: () => { hideCard(); gardenSheet(); } }]); break;
      case 'boat': {
        const to = pois.find((x) => x.id === p.to);
        showCard('⛵ Paper-boat dock', 'A paper boat can carry you across the water.', [{ label: '⛵ Sail across', primary: true, onClick: () => { hideCard(); startTravel(to, 'boat'); } }]); break;
      }
      default: break;
    }
  }

  function talk(n) {
    const D = M.data, s = st();
    if (n.id === 'biscuit') {
      const q = s.world.quests.scarf;
      if (q === 'none') { M.store.update((x) => { x.world.quests.scarf = found('scarf') ? 'found' : 'active'; }); }
      const q2 = st().world.quests.scarf;
      if (q2 === 'found' || (q2 === 'active' && found('scarf'))) {
        M.store.update((x) => { x.world.quests.scarf = 'done'; if (!x.owned.acc.includes('flowers')) x.owned.acc.push('flowers'); x.yarn += 5; }, 'yarn');
        parts.burst('heart', n.px, n.py - 40, 6); M.audio.ui('sparkle');
        showCard('🐱 Biscuit', D.QUEST.found + ' (+5 🧶, flower crown added to your wardrobe)', [{ label: '🎀 Try it on', primary: true, onClick: () => { M.store.update((x) => { x.cat.acc = 'flowers'; }, 'cat'); hideCard(); } }]);
        return;
      }
      if (q === 'none') { showCard('🐱 Biscuit', D.QUEST.ask, [{ label: 'I\'ll keep an eye out', primary: true, onClick: hideCard }]); return; }
      if (q2 === 'active' && Math.random() < 0.4) { showCard('🐱 Biscuit', D.QUEST.waiting, null); return; }
    }
    const lines = D.NPC_LINES[n.id] || ['Mrrp.'];
    const line = lines[n.line % lines.length]; n.line++;
    showCard('🐱 ' + n.name, line, [{ label: 'More?', onClick: () => talk(n) }]);
    M.audio.ui('meow');
  }

  function leafSheet() {
    const ta = M.h('textarea', { rows: 3, maxlength: 300, placeholder: 'Write a worry on the leaf… (it is not saved anywhere)', 'aria-label': 'Worry for the leaf' });
    const sheet = M.ui.sheet({
      title: 'The whispering tree', icon: '🍃',
      body: M.h('div', { class: 'stack' },
        M.h('p', { class: 'muted' }, 'Old Sage says the wind never brings them back.'),
        ta,
        M.h('button', { class: 'btn primary big', onclick: () => {
          if (!ta.value.trim()) { ta.focus(); return; }
          ta.value = ''; sheet.close();
          M.store.update((s) => { s.world.leavesHung += 1; });
          const tree = pois.find((p) => p.id === 'worrytree');
          flyers.push({ x: tree.px + M.rand(-20, 20), y: tree.py - 90, vx: 30, vy: -6, t: 0, rot: 0 });
          M.audio.ui('whoosh');
          M.ui.toast('The wind picks up the leaf and carries it far away. 🍃');
        } }, '🍃 Hang it and let go')),
    });
  }

  const stageOf = (g) => Math.min(3, Math.max(0, M.daysBetween(g.day, M.dayKey())));
  const STAGES = ['🌰 seed', '🌱 sprout', '🌿 bud', '🌸 flower'];
  function gardenSummary() {
    const g = st().world.garden;
    if (!g.length) return 'An empty little plot, waiting for a hope seed.';
    return g.map((x) => STAGES[stageOf(x)]).join(' · ');
  }
  function gardenSheet() {
    const body = M.h('div', { class: 'stack' });
    const render = () => {
      const g = st().world.garden;
      body.innerHTML = '';
      body.append(M.h('p', { class: 'muted' }, 'Hope seeds grow a little each day — by the third day they bloom. They never wilt, even if you are away for months.'));
      if (g.length) body.append(M.h('ul', { class: 'garden-list' }, g.map((x, i) => M.h('li', null,
        M.h('span', null, STAGES[stageOf(x)]), x.hope ? M.h('span', { class: 'grow' }, ' “' + x.hope + '”') : M.h('span', { class: 'grow muted' }, ' (a quiet hope)'),
        M.h('button', { class: 'icon-btn', 'aria-label': 'Remove this plant', onclick: () => { M.store.update((s) => { s.world.garden.splice(i, 1); }); render(); } }, '✕')))));
      const today = M.dayKey();
      if (g.some((x) => x.day === today)) { body.append(M.h('p', null, 'You planted a seed today. It is snuggled in the soil. 🌰')); return; }
      const inp = M.h('input', { type: 'text', maxlength: 80, placeholder: 'A small hope (optional, stays on this device)', 'aria-label': 'Your hope' });
      body.append(inp, M.h('button', { class: 'btn primary big', onclick: () => {
        M.store.update((s) => {
          if (s.world.garden.length >= 6) s.world.garden.shift();
          s.world.garden.push({ day: today, color: M.pick(['#FF9EB5', '#FFE08A', '#CFC4F2', '#FFC8A2', '#A9D6F5']), hope: inp.value.trim() });
        });
        M.audio.ui('dig'); M.ui.toast('Planted. It will take its time — and that is the point. 🌱'); render();
      } }, '🌱 Plant a hope seed'));
    };
    render();
    M.ui.sheet({ title: 'Hope garden', icon: '🌱', body });
  }

  // ------------------------------------------------------------------ travel (balloon / paper boat)
  function startTravel(p, kind) {
    if (!p) return;
    M.ui.closeAll(); hideCard();
    travel = { t: 0, kind, to: p, done: false, dur: M.reducedMotion() ? 0.6 : 1.8 };
    me.path = []; me.target = null;
    M.audio.ui('whoosh');
  }

  // ------------------------------------------------------------------ update
  function update(dt) {
    t += dt;
    const s = st();
    if (travel) {
      travel.t += dt;
      if (!travel.done && travel.t >= travel.dur / 2) {
        travel.done = true;
        const p = travel.to;
        const [gx, gy] = nearestWalkable(Math.floor(p.px / T), Math.floor(p.py / T) + 1, 3) || [Math.floor(p.px / T), Math.floor(p.py / T)];
        me.x = (gx + 0.5) * T; me.y = (gy + 0.5) * T;
        reveal(me.x, me.y, 7); snapCam();
      }
      if (travel.t >= travel.dur) { const p = travel.to; travel = null; if (p.action && p.action !== 'balloon' && p.action !== 'boat') showPoi(p); }
    }
    // input: joystick / keyboard
    let vx = me.vel[0], vy = me.vel[1];
    if (keys.ArrowLeft || keys.a) vx = -1; if (keys.ArrowRight || keys.d) vx = 1;
    if (keys.ArrowUp || keys.w) vy = -1; if (keys.ArrowDown || keys.s) vy = 1;
    const speed = couch ? 70 : 115;
    me.moving = false;
    if ((vx || vy) && !travel && !couch) {
      const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
      me.path = []; me.target = null; cam.free = false; hideCard();
      const nx = me.x + vx * speed * dt, ny = me.y + vy * speed * dt;
      if (walkable(Math.floor((nx + Math.sign(vx) * 8) / T), Math.floor(me.y / T))) me.x = nx;
      if (walkable(Math.floor(me.x / T), Math.floor((ny + Math.sign(vy) * 6) / T))) me.y = ny;
      if (vx) me.dir = vx > 0 ? 1 : -1;
      me.moving = true;
    } else if (me.path.length) {
      const [px, py] = me.path[0];
      const dx = px - me.x, dy = py - me.y, d = Math.hypot(dx, dy);
      const stepLen = speed * dt;
      if (d <= stepLen) { me.x = px; me.y = py; me.path.shift(); }
      else { me.x += (dx / d) * stepLen; me.y += (dy / d) * stepLen; }
      if (Math.abs(dx) > 1) me.dir = dx > 0 ? 1 : -1;
      me.moving = true;
      if (!me.path.length) { const tg = me.target; me.target = null; arrive(tg); }
    }
    if (me.moving) { me.idle = 0; me.phase += dt * 11; me.pose = 'walk'; }
    else {
      me.idle += dt;
      const e = M.store.energy() || 3;
      me.pose = me.idle > (couch ? 6 : 14) && e <= 2 ? 'sleep' : me.idle > 8 && e <= 3 ? 'loaf' : 'sit';
    }
    // couch mode autopilot
    if (couch && !travel && !me.path.length) {
      couchWait -= dt;
      if (couchWait <= 0) {
        couchWait = M.rand(4, 9);
        const disc = pois.filter((p) => s.world.discovered.includes(p.id));
        let ok = false;
        if (disc.length && Math.random() < 0.55) { const p = M.pick(disc); ok = setPathTo(p.px, p.py + T, null, true); }
        for (let tries = 0; !ok && tries < 12; tries++) {
          const tx = Math.floor(me.x / T + M.rand(-14, 14)), ty = Math.floor(me.y / T + M.rand(-10, 10));
          if (walkable(tx, ty)) ok = setPathTo((tx + 0.5) * T, (ty + 0.5) * T, null, true);
        }
      }
    }
    // fog + discovery + region label
    fogT -= dt;
    if (fogT <= 0) { fogT = 0.2; reveal(me.x, me.y, 6); }
    const ii = isl[idx(M.clamp(Math.floor(me.x / T), 0, WW - 1), M.clamp(Math.floor(me.y / T), 0, WH - 1))];
    if (ii >= 0 && ISLANDS[ii].id !== lastIsland) { lastIsland = ISLANDS[ii].id; showRegion(ISLANDS[ii]); }
    // collectibles
    for (const c of collectibles) {
      if (found(c.id)) continue;
      if (M.dist(me.x, me.y, c.x, c.y) < 24) collect(c);
    }
    // butterflies, gulls, flyers
    const meadow = ISLANDS[1];
    for (const b of butterflies) {
      if (b.flee > 0) b.flee -= dt;
      else { b.vx += M.rand(-60, 60) * dt; b.vy += M.rand(-60, 60) * dt; }
      const dxm = b.x / T - meadow.cx, dym = b.y / T - meadow.cy;
      if (dxm * dxm / (meadow.rx * meadow.rx) + dym * dym / (meadow.ry * meadow.ry) > 0.7) { b.vx -= dxm * 4 * dt; b.vy -= dym * 4 * dt; }
      const sp = Math.hypot(b.vx, b.vy), max = b.flee > 0 ? 120 : 30;
      if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    for (const f of flyers) { f.t += dt; f.x += f.vx * dt + Math.sin(f.t * 2) * 0.6; f.y += f.vy * dt + Math.sin(f.t * 3) * 0.8; f.rot += dt * 1.5; f.vx += dt * 6; }
    for (let i = flyers.length - 1; i >= 0; i--) if (flyers[i].t > 9) flyers.splice(i, 1);
    if (tapMark) { tapMark.t += dt; if (tapMark.t > 0.6) tapMark = null; }
    parts.update(dt);
    // camera
    const tx = me.x - viewW / 2, ty = me.y - viewH / 2;
    if (!cam.free) {
      const k = M.reducedMotion() || travel ? 1 : 1 - Math.pow(0.002, dt);
      cam.x = M.lerp(cam.x, tx, k); cam.y = M.lerp(cam.y, ty, k);
    }
    cam.x = M.clamp(cam.x, 0, WW * T - viewW); cam.y = M.clamp(cam.y, 0, WH * T - viewH);
    // autosave position
    saveT -= dt;
    if (saveT <= 0) {
      saveT = 3;
      if (fogPackedDirty || me.moving) { const fp = packFog(); M.store.update((x) => { x.world.x = me.x; x.world.y = me.y; x.world.fog = fp; }); fogPackedDirty = false; }
    }
  }
  let fogPackedDirty = true;

  function collect(c) {
    M.store.update((s) => { if (!s.world.found.includes(c.id)) { s.world.found.push(c.id); s.yarn += 1; } if (c.id === 'scarf' && s.world.quests.scarf === 'active') s.world.quests.scarf = 'found'; }, 'yarn');
    parts.burst('sparkle', c.x, c.y - 10, 7, () => ({ color: M.pick(['#FFE08A', '#FF9EB5', '#A9D6F5']) }));
    M.audio.ui('sparkle');
    const icon = c.kind === 'scarf' ? '🧣' : M.data.COLLECTIBLES[c.kind].icon;
    M.ui.toast('Found: ' + icon + ' ' + c.name + '  +1 🧶' + (c.kind === 'scarf' ? ' — Biscuit in the meadow might know whose it is!' : ''));
  }

  function showRegion(I) {
    const el = M.$('#regionLabel');
    el.textContent = I.icon + ' ' + I.name;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(showRegion.t); showRegion.t = setTimeout(() => el.classList.remove('show'), 3300);
  }

  // ------------------------------------------------------------------ draw
  function snapCam() { cam.x = M.clamp(me.x - viewW / 2, 0, WW * T - viewW); cam.y = M.clamp(me.y - viewH / 2, 0, WH * T - viewH); }

  function draw() {
    const sky = M.sky();
    const reduce = M.reducedMotion();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COL.deep; ctx.fillRect(0, 0, viewW, viewH);
    const cx = Math.round(cam.x), cy = Math.round(cam.y);
    ctx.save(); ctx.translate(-cx, -cy);
    // terrain chunks
    const px = CH * T;
    const c0 = Math.floor(cx / px), c1 = Math.floor((cx + viewW) / px), r0 = Math.floor(cy / px), r1 = Math.floor((cy + viewH) / px);
    for (let ry = r0; ry <= r1; ry++) for (let rx = c0; rx <= c1; rx++) {
      if (rx < 0 || ry < 0 || rx * CH >= WW || ry * CH >= WH) continue;
      ctx.drawImage(getChunk(rx, ry), rx * px, ry * px, px, px);
    }
    // water sparkles
    if (!reduce) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let ty = Math.floor(cy / T); ty <= Math.floor((cy + viewH) / T); ty++) for (let tx = Math.floor(cx / T); tx <= Math.floor((cx + viewW) / T); tx++) {
        if (tileAt(tx, ty) !== WATER) continue;
        const hsh = M.hash2(tx, ty); if (hsh > 0.12) continue;
        const a = Math.sin(t * 1.5 + hsh * 60);
        if (a < 0.2) continue;
        ctx.globalAlpha = a * 0.8;
        const sx = tx * T + 8 + hsh * 100 % 16, sy = ty * T + 16;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 4, sy - 3, sx + 8, sy); ctx.quadraticCurveTo(sx + 12, sy + 3, sx + 16, sy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // paper-boat route
    const db = pois.find((p) => p.id === 'dock-beach'), dw = pois.find((p) => p.id === 'dock-woods');
    if (db && dw) {
      ctx.setLineDash([4, 8]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(db.px, db.py); ctx.quadraticCurveTo(db.px + 160, db.py - 20, dw.px, dw.py + 10); ctx.stroke(); ctx.setLineDash([]);
    }
    // y-sorted scene
    const items = [];
    const margin = 120;
    for (let ry = Math.floor((cy - margin) / px); ry <= Math.floor((cy + viewH + margin) / px); ry++) for (let rx = Math.floor((cx - margin) / px); rx <= Math.floor((cx + viewW + margin) / px); rx++) {
      const b = buckets.get(rx + ',' + ry); if (b) for (const o of b) items.push({ y: o.y, draw: () => drawProp(o, sky) });
    }
    const vis = (x, y, m) => x > cx - (m || 60) && x < cx + viewW + (m || 60) && y > cy - (m || 60) && y < cy + viewH + (m || 100);
    pois.forEach((p) => { if (vis(p.px, p.py, 140)) items.push({ y: p.py - 1, draw: () => drawPoi(p, sky) }); });
    npcs.forEach((n) => { if (vis(n.px, n.py)) items.push({ y: n.py, draw: () => drawNpc(n) }); });
    collectibles.forEach((c) => { if (!found(c.id) && vis(c.x, c.y)) items.push({ y: c.y, draw: () => drawCollectible(c) }); });
    items.push({ y: me.y, draw: drawMe });
    items.sort((a, b) => a.y - b.y);
    items.forEach((it) => it.draw());
    // butterflies, gulls, flyers, particles
    for (const b of butterflies) if (vis(b.x, b.y)) drawButterfly(b);
    if (!reduce) for (const g of gulls) {
      const gx = g.cx + Math.cos(t * g.sp + g.ph) * g.r, gy = g.cy + Math.sin(t * g.sp + g.ph) * g.r * 0.5;
      if (!vis(gx, gy)) continue;
      const f = Math.sin(t * 8 + g.ph) * 3;
      ctx.strokeStyle = '#FFFDF8'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(gx - 8, gy - f); ctx.quadraticCurveTo(gx - 3, gy - 4, gx, gy); ctx.quadraticCurveTo(gx + 3, gy - 4, gx + 8, gy - f); ctx.stroke();
    }
    for (const f of flyers) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = Math.max(0, 1 - f.t / 9); drawPaperLeaf(ctx); ctx.restore(); }
    if (tapMark && !reduce) { ctx.strokeStyle = 'rgba(255,255,255,' + (1 - tapMark.t / 0.6) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(tapMark.x, tapMark.y, 6 + tapMark.t * 24, 3 + tapMark.t * 12, 0, 0, 7); ctx.stroke(); }
    parts.draw(ctx);
    // fog of war
    if (fogDirty) renderFog();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fogCv, 0, 0, FW * FRES, FH * FRES, 0, 0, WW * T, WH * T);
    ctx.restore();
    // night & warm light
    if (sky.night > 0) { ctx.fillStyle = 'rgba(28,24,72,' + (sky.night * 0.45).toFixed(3) + ')'; ctx.fillRect(0, 0, viewW, viewH); }
    if (sky.warm > 0) { ctx.fillStyle = 'rgba(255,160,110,' + (sky.warm * 0.12).toFixed(3) + ')'; ctx.fillRect(0, 0, viewW, viewH); }
    if (sky.night > 0.3) drawNightLights(sky, cx, cy);
    if (travel) drawTravel();
  }

  function drawProp(o, sky) {
    if (o.type === 'worrytree') {
      const sp = sprite('worrytree', 0);
      ctx.drawImage(sp.cv, o.x - sp.ax, o.y - sp.ay, sp.w, sp.h);
      const n = Math.min(14, st().world.leavesHung + 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rx = o.x + Math.cos(a) * 26 + Math.sin(i * 3.1) * 8, ry = o.y - 82 + Math.sin(a) * 18;
        ctx.save(); ctx.translate(rx, ry); ctx.rotate(Math.sin(t * 2 + i) * (M.reducedMotion() ? 0 : 0.25)); drawPaperLeaf(ctx, 0.7); ctx.restore();
      }
      return;
    }
    const sp = sprite(o.type, o.v);
    ctx.drawImage(sp.cv, o.x - sp.ax, o.y - sp.ay, sp.w, sp.h);
    if (o.type === 'mansion' && sky.night > 0.4) {
      // windows glow at night (drawn again after the night tint, see drawNightLights)
    }
  }

  function drawPaperLeaf(c, s) {
    c.save(); if (s) c.scale(s, s);
    c.fillStyle = '#FFFDF8'; c.strokeStyle = OUT; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(7, -2, 0, 8); c.quadraticCurveTo(-7, -2, 0, -8); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 6); c.lineWidth = 0.8; c.stroke();
    c.restore();
  }

  function drawPoi(p, sky) {
    const known = st().world.discovered.includes(p.id);
    const bob = M.reducedMotion() ? 0 : Math.sin(t * 2 + p.px) * 2;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    switch (p.action) {
      case 'balloon': {
        ctx.fillStyle = '#C9A27F'; M.rr(ctx, p.px - 9, p.py - 14, 18, 14, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.px - 8, p.py - 14); ctx.lineTo(p.px - 12, p.py - 38 + bob); ctx.moveTo(p.px + 8, p.py - 14); ctx.lineTo(p.px + 12, p.py - 38 + bob); ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 2.2;
        ctx.fillStyle = p.balloon; ctx.beginPath(); ctx.ellipse(p.px, p.py - 56 + bob, 20, 23, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(p.px - 7, p.py - 64 + bob, 5, 9, 0.3, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(91,70,54,0.4)'; ctx.beginPath(); ctx.moveTo(p.px, p.py - 79 + bob); ctx.lineTo(p.px, p.py - 34 + bob); ctx.stroke();
        break;
      }
      case 'bottles':
        ctx.fillStyle = 'rgba(169,214,245,0.9)'; ctx.save(); ctx.translate(p.px, p.py - 8); ctx.rotate(0.5); M.rr(ctx, -5, -12, 10, 18, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#C9A27F'; ctx.fillRect(-2.5, -17, 5, 5); ctx.fillStyle = '#FFFDF8'; ctx.fillRect(-2, -7, 4, 7); ctx.restore();
        break;
      case 'clouds':
        ctx.save(); ctx.translate(p.px, p.py - 4); ctx.rotate(-0.08);
        ctx.fillStyle = '#FFFDF8'; M.rr(ctx, -26, -14, 52, 28, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#BDE6CF'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) ctx.fillRect(-26 + i * 13, -14 + j * 14, 13, 14);
        ctx.strokeRect(-26, -14, 52, 28);
        ctx.restore();
        break;
      case 'seed': drawGarden(p); break;
      case 'boat': {
        ctx.fillStyle = '#D9B48F'; M.rr(ctx, p.px - 16, p.py - 6, 32, 12, 2); ctx.fill(); ctx.stroke();
        const bx = p.px + (p.id === 'dock-beach' ? 26 : 0), by = p.py + (p.id === 'dock-beach' ? 0 : 22) + bob * 0.5;
        ctx.fillStyle = '#FFFDF8'; ctx.beginPath(); ctx.moveTo(bx - 14, by - 6); ctx.lineTo(bx + 14, by - 6); ctx.lineTo(bx + 9, by + 3); ctx.lineTo(bx - 9, by + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx, by - 22); ctx.lineTo(bx, by - 6); ctx.lineTo(bx + 10, by - 9); ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'fish':
        ctx.fillStyle = '#FF9EB5'; ctx.beginPath(); ctx.arc(p.px + 10, p.py + 8 + bob, 3.5, 0, 7); ctx.fill(); ctx.stroke();
        break;
      default: break;
    }
    if (known && p.action !== 'home') {
      // gentle marker so places are easy to find (no counters, no red dots)
      const my = p.py - (p.action === 'balloon' ? 96 : p.action === 'leaf' ? 150 : 40) + bob;
      ctx.fillStyle = 'rgba(255,253,248,0.92)'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(p.px, my, 11, 0, 7); ctx.fill(); ctx.stroke();
      ctx.font = '12px ' + M.FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = OUT;
      ctx.fillText(p.icon, p.px, my + 1); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }

  function drawGarden(p) {
    const g = st().world.garden;
    const x0 = p.px - 34, y0 = p.py - 22;
    ctx.fillStyle = '#C9A27F'; M.rr(ctx, x0, y0, 68, 24, 5); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#B98A66'; ctx.lineWidth = 2;
    for (let i = 0; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(x0 - 4 + i * 12.6, y0 + 26); ctx.lineTo(x0 - 4 + i * 12.6, y0 + 12); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x0 - 4, y0 + 17); ctx.lineTo(x0 + 72, y0 + 17); ctx.stroke();
    ctx.strokeStyle = OUT;
    for (let i = 0; i < 6; i++) {
      const sx = x0 + 7 + i * 11, sy = y0 + 12;
      ctx.fillStyle = '#8E6B4E'; ctx.beginPath(); ctx.ellipse(sx, sy, 4.5, 2.5, 0, 0, 7); ctx.fill();
      const pl = g[i]; if (!pl) continue;
      const stg = stageOf(pl);
      ctx.strokeStyle = '#6FAE73'; ctx.lineWidth = 2;
      if (stg >= 1) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - (stg === 1 ? 5 : 11)); ctx.stroke(); }
      if (stg === 1) { ctx.fillStyle = '#9ED19A'; ctx.beginPath(); ctx.ellipse(sx + 2.5, sy - 5, 2.5, 1.5, -0.5, 0, 7); ctx.fill(); }
      if (stg === 2) { ctx.fillStyle = pl.color; ctx.beginPath(); ctx.ellipse(sx, sy - 12, 2.2, 3.2, 0, 0, 7); ctx.fill(); }
      if (stg === 3) { ctx.fillStyle = pl.color; for (let k = 0; k < 5; k++) { const a = k * 1.256; ctx.beginPath(); ctx.arc(sx + Math.cos(a) * 3, sy - 13 + Math.sin(a) * 3, 2.4, 0, 7); ctx.fill(); } ctx.fillStyle = '#FFE08A'; ctx.beginPath(); ctx.arc(sx, sy - 13, 1.8, 0, 7); ctx.fill(); }
      ctx.strokeStyle = OUT;
    }
    ctx.lineWidth = 2.2;
  }

  function drawNpc(n) {
    const near = M.dist(me.x, me.y, n.px, n.py) < 140;
    const dir = near ? (me.x < n.px ? -1 : 1) : (n.id === 'pudding' ? 1 : -1);
    M.cat.draw(ctx, { x: n.px, y: n.py, s: 0.72, pose: n.id === 'sage' ? 'loaf' : 'sit', t: t + n.px, dir, coat: n.coat, acc: n.acc, expr: near ? 'happy' : 'neutral' });
    if (near && !couch) {
      ctx.fillStyle = 'rgba(255,253,248,0.95)'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
      M.rr(ctx, n.px - 12, n.py - 62, 24, 14, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT; ctx.font = '800 10px ' + M.FONT; ctx.textAlign = 'center'; ctx.fillText('…', n.px, n.py - 52); ctx.textAlign = 'start';
    }
  }

  function drawCollectible(c) {
    const tw = M.reducedMotion() ? 0.6 : 0.5 + 0.5 * Math.sin(t * 3 + c.x);
    ctx.save(); ctx.translate(c.x, c.y - 6);
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    if (c.kind === 'shell') {
      ctx.fillStyle = '#FFC8D0'; ctx.beginPath(); ctx.moveTo(0, 5); ctx.arc(0, 0, 7, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); for (const a of [-0.6, 0, 0.6]) { ctx.moveTo(0, 5); ctx.lineTo(Math.sin(a) * 6, -5); } ctx.lineWidth = 1; ctx.stroke();
    } else if (c.kind === 'leaf') {
      ctx.fillStyle = '#F2B880'; ctx.rotate(0.6); ctx.beginPath(); ctx.ellipse(0, 0, 8, 4.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineWidth = 1; ctx.stroke();
    } else if (c.kind === 'stamp') {
      ctx.fillStyle = '#FFFDF8'; ctx.fillRect(-7, -8, 14, 16); ctx.strokeRect(-7, -8, 14, 16);
      ctx.fillStyle = '#A9D6F5'; ctx.fillRect(-4, -5, 8, 8); ctx.fillStyle = '#FF9EB5'; ctx.beginPath(); ctx.arc(0, -1, 2, 0, 7); ctx.fill();
    } else if (c.kind === 'statue') {
      ctx.fillStyle = '#C9C3BC'; M.rr(ctx, -12, -2, 24, 8, 2); ctx.fill(); ctx.stroke();
      M.cat.draw(ctx, { x: 0, y: -1, s: 0.45, pose: 'sit', coat: 'stone', still: true, expr: 'sleep', noShadow: true });
    } else if (c.kind === 'scarf') {
      ctx.fillStyle = '#FF9E7A'; M.rr(ctx, -10, -4, 20, 7, 3); ctx.fill(); ctx.stroke(); M.rr(ctx, 2, -1, 6, 12, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFF6E9'; ctx.fillRect(-6, -3, 2, 5); ctx.fillRect(0, -3, 2, 5);
    }
    ctx.restore();
    if (tw > 0.85) parts.list.length < 60 && Math.random() < 0.05 && parts.add('sparkle', c.x + M.rand(-8, 8), c.y - 14, { vy: -10, life: 0.6, size: 0.6 });
  }

  function drawButterfly(b) {
    const f = M.reducedMotion() ? 0.7 : Math.abs(Math.sin(t * 14 + b.ph));
    ctx.save(); ctx.translate(b.x, b.y - 18);
    ctx.fillStyle = b.col; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(-3.5 * f - 1, -2, 4 * f + 0.6, 3.5, -0.4, 0, 7); ctx.ellipse(3.5 * f + 1, -2, 4 * f + 0.6, 3.5, 0.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = OUT; ctx.fillRect(-0.8, -5, 1.6, 7);
    ctx.restore();
  }

  function drawMe() {
    const s = st();
    if (travel && travel.t > travel.dur * 0.2 && travel.t < travel.dur * 0.8) return;
    M.cat.draw(ctx, { x: me.x, y: me.y + 6, s: 0.78, pose: me.pose, t, dir: me.dir, phase: me.phase, coat: s.cat.coat, acc: s.cat.acc, expr: me.pose === 'sleep' ? 'sleep' : 'neutral' });
    if (me.pose === 'sleep' && Math.random() < 0.02) parts.add('z', me.x + 10, me.y - 20, { vx: 6, vy: -12, life: 2 });
  }

  function drawNightLights(sky, cx, cy) {
    ctx.save(); ctx.translate(-cx, -cy);
    ctx.globalCompositeOperation = 'lighter';
    const a = sky.night;
    // mansion windows
    const mx = 40.5 * T, my = 46.9 * T;
    for (const [wx, wy] of [[-51, -78], [51, -78], [-51, -36]]) {
      const g = ctx.createRadialGradient(mx + wx, my + wy, 2, mx + wx, my + wy, 34);
      g.addColorStop(0, 'rgba(255,214,140,' + (0.6 * a) + ')'); g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g; ctx.fillRect(mx + wx - 34, my + wy - 34, 68, 68);
    }
    // fireflies over meadow and woods
    const reduce = M.reducedMotion();
    for (let i = 0; i < 40; i++) {
      const base = i < 20 ? ISLANDS[1] : ISLANDS[2];
      const fx = (base.cx + (M.hash2(i, 3) - 0.5) * base.rx * 1.6) * T + (reduce ? 0 : Math.sin(t * 0.7 + i) * 20);
      const fy = (base.cy + (M.hash2(i, 9) - 0.5) * base.ry * 1.6) * T + (reduce ? 0 : Math.cos(t * 0.5 + i * 2) * 14);
      if (fx < cx - 20 || fx > cx + viewW + 20 || fy < cy - 20 || fy > cy + viewH + 20) continue;
      const k = reduce ? 0.7 : 0.5 + 0.5 * Math.sin(t * 2.5 + i * 1.7);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 9);
      g.addColorStop(0, 'rgba(255,240,150,' + (0.9 * k * a) + ')'); g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g; ctx.fillRect(fx - 9, fy - 9, 18, 18);
    }
    ctx.restore();
  }

  function drawTravel() {
    const k = travel.t / travel.dur;
    const a = k < 0.5 ? k * 2 : (1 - k) * 2;
    const [top, bot] = M.skyColors(M.sky());
    ctx.save();
    ctx.globalAlpha = M.clamp(a * 1.3, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, viewH); g.addColorStop(0, top); g.addColorStop(1, travel.kind === 'boat' ? '#A9D6F5' : bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, viewW, viewH);
    if (!M.reducedMotion()) {
      M.calm.cloud(ctx, viewW * 0.25, viewH * 0.3 + k * 60, 0.8, 'rgba(255,255,255,0.8)');
      M.calm.cloud(ctx, viewW * 0.8, viewH * 0.6 - k * 40, 0.6, 'rgba(255,255,255,0.8)');
      const s = st();
      const bx = viewW / 2 + Math.sin(k * 6) * 10, by = viewH / 2 + (travel.kind === 'boat' ? 40 : -k * 30);
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
      if (travel.kind === 'boat') {
        ctx.fillStyle = '#FFFDF8'; ctx.beginPath(); ctx.moveTo(bx - 50, by); ctx.lineTo(bx + 50, by); ctx.lineTo(bx + 32, by + 26); ctx.lineTo(bx - 32, by + 26); ctx.closePath(); ctx.fill(); ctx.stroke();
        M.cat.draw(ctx, { x: bx, y: by + 4, s: 1, pose: 'sit', t, coat: s.cat.coat, acc: s.cat.acc, expr: 'happy' });
      } else {
        ctx.fillStyle = '#FF9EB5'; ctx.beginPath(); ctx.ellipse(bx, by - 120, 54, 62, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx - 30, by - 70); ctx.lineTo(bx - 26, by - 20); ctx.moveTo(bx + 30, by - 70); ctx.lineTo(bx + 26, by - 20); ctx.stroke();
        M.cat.draw(ctx, { x: bx, y: by + 2, s: 1, pose: 'sit', t, coat: s.cat.coat, acc: s.cat.acc, expr: 'happy' });
        ctx.fillStyle = '#C9A27F'; M.rr(ctx, bx - 30, by - 20, 60, 32, 6); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ loop & input
  function resize() {
    const el = M.$('#mapView');
    viewW = el.clientWidth || 360; viewH = el.clientHeight || 600;
    dpr = M.fitCanvas(canvas, viewW, viewH, 2);
    const newScale = Math.min(window.devicePixelRatio || 1, 1.5);
    if (newScale !== chunkScale) { chunkScale = newScale; chunks.clear(); sprites.clear(); }
  }
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now; accum += dt;
    const busy = me.moving || travel || flyers.length || !cam.free && (Math.abs(cam.x - (me.x - viewW / 2)) > 1 || Math.abs(cam.y - (me.y - viewH / 2)) > 1);
    const minDt = couch ? 1 / 24 : busy ? 1 / 61 : 1 / 31; // battery-friendly when idle or in couch mode
    if (accum < minDt) return;
    const step = accum; accum = 0;
    update(step); draw();
  }

  function setupInput() {
    let down = null;
    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, drag: false, id: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.drag && Math.hypot(dx, dy) > 10) down.drag = true;
      if (down.drag) { cam.free = true; cam.x = down.cx - dx; cam.y = down.cy - dy; }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const d = down; down = null;
      if (d.drag) return;
      const rect = canvas.getBoundingClientRect();
      onTap(e.clientX - rect.left + cam.x, e.clientY - rect.top + cam.y);
    });
    canvas.addEventListener('pointercancel', () => { down = null; });
    window.addEventListener('keydown', (e) => {
      if (!running || M.ui.isOpen() || /input|textarea|select/i.test(e.target.tagName)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; });
    window.addEventListener('blur', () => Object.keys(keys).forEach((k) => { keys[k] = false; }));
    // joystick
    const joy = M.$('#joystick'), knob = M.$('#joystick .knob');
    let jid = null;
    const setJoy = (e) => {
      const r = joy.getBoundingClientRect(), cxj = r.left + r.width / 2, cyj = r.top + r.height / 2;
      let dx = e.clientX - cxj, dy = e.clientY - cyj; const l = Math.hypot(dx, dy), max = r.width / 2 - 14;
      if (l > max) { dx *= max / l; dy *= max / l; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      me.vel = l < 8 ? [0, 0] : [dx / max, dy / max];
    };
    joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); setJoy(e); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
    const endJoy = () => { jid = null; me.vel = [0, 0]; knob.style.transform = ''; };
    joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
  }

  const world = {
    T, ISLANDS,
    init() {
      canvas = M.$('#worldCanvas'); ctx = canvas.getContext('2d');
      chunkScale = Math.min(window.devicePixelRatio || 1, 1.5);
      generate();
      const s = st();
      if (!s.world.fog || !unpackFog(s.world.fog)) reveal(40.5 * T, 50 * T, 9);
      fogDirty = true;
      if (s.world.x != null && walkable(Math.floor(s.world.x / T), Math.floor(s.world.y / T))) { me.x = s.world.x; me.y = s.world.y; }
      else { me.x = 40.5 * T; me.y = 49.2 * T; }
      const rnd = M.rng(11);
      butterflies = Array.from({ length: 6 }, (_, i) => ({ x: (ISLANDS[1].cx + (rnd() - 0.5) * 20) * T, y: (ISLANDS[1].cy + (rnd() - 0.5) * 10) * T, vx: 0, vy: 0, flee: 0, ph: i, col: ['#FFE08A', '#FF9EB5', '#CFC4F2', '#A9D6F5'][i % 4] }));
      gulls = [{ cx: 52 * T, cy: 80 * T, r: 140, sp: 0.35, ph: 0 }, { cx: 60 * T, cy: 86 * T, r: 90, sp: -0.45, ph: 2 }];
      setupInput();
      M.$('#hudHome').addEventListener('click', () => M.app.show('home'));
      M.$('#hudTravel').addEventListener('click', () => world.openTravel());
      M.$('#hudCouch').addEventListener('click', () => world.setCouch(!couch));
      M.$('#hudFinds').addEventListener('click', () => world.openFinds());
      M.$('#couchStop').addEventListener('click', () => world.setCouch(false));
      window.addEventListener('resize', () => { if (running) resize(); });
      checkDiscover();
    },
    start() {
      if (running) return;
      running = true; resize(); snapCam(); last = performance.now(); accum = 1;
      lastIsland = null;
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false; cancelAnimationFrame(raf); hideCard(); me.vel = [0, 0];
      Object.keys(keys).forEach((k) => { keys[k] = false; });
      M.store.update((x) => { x.world.x = me.x; x.world.y = me.y; x.world.fog = packFog(); });
      if (couch) world.setCouch(false);
    },
    setCouch(on) {
      couch = !!on; couchWait = 1; me.path = []; me.target = null; cam.free = false; hideCard();
      document.body.classList.toggle('couch', couch);
      M.$('#hudCouch').setAttribute('aria-pressed', String(couch));
      if (couch) M.ui.toast('Couch mode: just watch ' + st().cat.name + ' wander. Tap anywhere to stop.');
    },
    openTravel() {
      const s = st();
      const list = pois.filter((p) => p.travel && s.world.discovered.includes(p.id));
      const body = M.h('div', { class: 'stack' },
        M.h('p', { class: 'muted' }, 'Float to any place you have found. New places appear as the clouds clear.'),
        list.map((p) => M.h('button', { class: 'btn big', onclick: () => { if (p.action === 'home') { M.ui.closeAll(); M.app.show('home'); } else startTravel(p, 'balloon'); } }, p.icon + ' ' + (p.label || p.name))));
      M.ui.sheet({ title: 'Hot-air balloon', icon: '🎈', body });
    },
    openFinds() {
      const s = st();
      const body = M.h('div', { class: 'finds' },
        M.h('p', { class: 'muted' }, 'Little treasures from your wanders. There is no list to finish — just things you happened to find.'),
        Object.entries(M.data.COLLECTIBLES).map(([kind, info]) => {
          const got = collectibles.filter((c) => c.kind === kind && found(c.id));
          return M.h('div', { class: 'find-group' }, M.h('h3', null, info.icon + ' ' + info.label),
            got.length ? M.h('div', { class: 'chips wrap' }, got.map((c) => M.h('span', { class: 'pill' }, c.name))) : M.h('p', { class: 'muted small' }, 'None yet — maybe on a wander someday.'));
        }),
        found('scarf') ? M.h('p', null, '🧣 Biscuit\'s scarf — ' + (s.world.quests.scarf === 'done' ? 'returned 💛' : 'found!')) : null,
        M.h('p', { class: 'muted small' }, '🍃 Leaves given to the wind: ' + s.world.leavesHung + ' · 🌱 Hope plants: ' + s.world.garden.length));
      M.ui.sheet({ title: 'My finds', icon: '📔', body });
    },
    setJoystick(on) { M.$('#joystick').hidden = !on; },
  };

  M.world = world;
})(window.M);
