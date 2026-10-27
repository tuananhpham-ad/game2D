'use strict';

/* ============================================================
   SỐ BIẾN HÌNH — ghép số trên bàn chơi không ngừng biến dạng
   ============================================================ */

// ---------- Cấu hình ----------
const SHAPES = [
  { id: 'sq4', name: 'Vuông 4×4', w: 4, h: 4, mask: () => true },
  { id: 'sq5', name: 'Vuông 5×5', w: 5, h: 5, mask: () => true },
  { id: 'r54', name: 'Chữ nhật ngang 5×4', w: 5, h: 4, mask: () => true },
  { id: 'r45', name: 'Chữ nhật đứng 4×5', w: 4, h: 5, mask: () => true },
  { id: 'corner', name: 'Cắt góc', w: 5, h: 5, mask: (x, y) => !((x === 0 || x === 4) && (y === 0 || y === 4)) },
  { id: 'plus', name: 'Dấu cộng', w: 6, h: 6, mask: (x, y) => !((x < 2 || x > 3) && (y < 2 || y > 3)) },
  { id: 'ring', name: 'Vành khuyên', w: 5, h: 5, mask: (x, y) => !(x === 2 && y === 2) },
  { id: 'holes', name: 'Bàn thủng lỗ', w: 5, h: 5, mask: (x, y) => !((x === 1 || x === 3) && (y === 1 || y === 3)) },
  { id: 'L', name: 'Chữ L', w: 5, h: 5, mask: (x, y) => !(x >= 3 && y <= 1) },
  { id: 'stairs', name: 'Bậc thang', w: 6, h: 5, mask: (x, y) => x >= y - 1 && x <= y + 2 },
];
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const ARROW = { up: '⬆', down: '⬇', left: '⬅', right: '➡' };
const SWAPS = [
  { name: 'Đảo ngược', map: { up: 'down', down: 'up', left: 'right', right: 'left' } },
  { name: 'Xoay phải', map: { up: 'right', right: 'down', down: 'left', left: 'up' } },
  { name: 'Xoay trái', map: { up: 'left', left: 'down', down: 'right', right: 'up' } },
  { name: 'Tráo trục', map: { up: 'left', left: 'up', down: 'right', right: 'down' } },
];
// màu theo log2 của giá trị: 2, 4, 8, … 8192
const TILE_COLORS = ['#4cc9f0', '#4895ef', '#06d6a0', '#80ed99', '#ffd166', '#ffb703', '#f77f00', '#ff4d6d', '#ff5ec4', '#c77dff', '#9d4edd', '#7b2ff7', '#3a0ca3'];
const MOVE_MS = 120;
const EFFECT_MOVES = 5;
const FONT = '"Baloo 2", system-ui, sans-serif';

// ---------- Tiện ích ----------
const $ = id => document.getElementById(id);
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const grid = (w, h, v) => Array.from({ length: h }, () => Array(w).fill(v));
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
};
const shadeCache = new Map();
function shade(hex, amt) {
  const key = hex + amt;
  if (shadeCache.has(key)) return shadeCache.get(key);
  const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(lerp(v, t, p)));
  const out = `rgb(${c[0]},${c[1]},${c[2]})`;
  shadeCache.set(key, out);
  return out;
}

const sfx = {
  slide: () => Sound.tone(240, 0.05, 'triangle', 0.04, 180),
  merge(v) { Sound.tone(330 * Math.pow(2, Math.min(Math.log2(v), 14) / 6), 0.12, 'triangle', 0.08, null); },
  bump: () => Sound.tone(110, 0.08, 'square', 0.04),
  freeze() { Sound.tone(1800, 0.25, 'sine', 0.04, 2600); Sound.tone(2400, 0.2, 'sine', 0.03, 1800, 0.08); },
  alarm() { Sound.tone(880, 0.16, 'sawtooth', 0.05, 440); Sound.tone(880, 0.16, 'sawtooth', 0.05, 440, 0.19); },
  boom() { Sound.noise(0.6, 0.4, 600); Sound.tone(100, 0.45, 'sine', 0.28, 30); },
  level() { [0, 4, 7, 12].forEach((s, i) => Sound.tone(523 * Math.pow(2, s / 12), 0.16, 'square', 0.05, null, i * 0.08)); },
  over() { [0, -3, -7, -12].forEach((s, i) => Sound.tone(330 * Math.pow(2, s / 12), 0.3, 'triangle', 0.1, null, i * 0.2)); },
};

// ---------- Trạng thái ----------
const cv = $('cv');
const ctx = cv.getContext('2d');
let S = null, tileSeq = 0;
let now = performance.now();
let W = 0, H = 0, DPR = 1, cs = 80, bx = 0, by = 0, gap = 4;
let ghosts = [], particles = [], popups = [];
let shake = 0, shownScore = 0, swipe = null;

function newTile(v, x, y, type = 'num') {
  return { id: ++tileSeq, v, type, x, y, frozen: 0, timer: 0, anim: null, born: now };
}

function newGame() {
  const shape = SHAPES[0];
  S = {
    w: shape.w, h: shape.h, shape,
    mask: buildMask(shape), rocks: grid(shape.w, shape.h, 0), cells: grid(shape.w, shape.h, null),
    score: 0, best: store.get('mg_best', 0), newBest: false,
    moves: 0, mutCount: 0, bombs: 0, maxTile: 2, level: 1, revives: 0,
    fx: { swap: 0 }, swapMap: SWAPS[0],
    nextMut: null, lastMut: null, mutIn: 10 + rnd(6), lockUntil: 0, boardT0: now,
    over: false,
  };
  ghosts = []; particles = []; popups = []; shake = 0; shownScore = 0;
  spawnTile(); spawnTile();
  S.nextMut = pickMut();
  refresh();
}

// ---------- Bàn chơi ----------
const open = (x, y) => x >= 0 && y >= 0 && x < S.w && y < S.h && S.mask[y][x] && !S.rocks[y][x];

function allTiles() {
  const out = [];
  for (const row of S.cells) for (const t of row) if (t) out.push(t);
  return out;
}

function empties() {
  const out = [];
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (open(x, y) && !S.cells[y][x]) out.push([x, y]);
  return out;
}

function openCount() {
  let n = 0;
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (open(x, y)) n++;
  return n;
}

function spawnTile(v) {
  const e = empties();
  if (!e.length) return null;
  const [x, y] = pick(e);
  const t = newTile(v || (Math.random() < 0.1 + 0.02 * S.level ? 4 : 2), x, y);
  t.born = now + MOVE_MS;
  S.cells[y][x] = t;
  return t;
}

// Tính kết quả trượt theo hướng dir mà không đổi trạng thái.
// Ô đóng băng và đá chắn đứng yên như tường; bom trượt được nhưng không gộp.
function computeSlide(dir) {
  const [dx, dy] = DIRV[dir];
  const g = S.cells.map(r => r.slice()), results = [], merged = new Set();
  const xs = [...Array(S.w).keys()], ys = [...Array(S.h).keys()];
  if (dx > 0) xs.reverse();
  if (dy > 0) ys.reverse();
  let moved = false, gain = 0;
  for (const y of ys) for (const x of xs) {
    const t = g[y][x];
    if (!t || t.merge || t.frozen > 0) continue;
    let cx = x, cy = y, into = null;
    for (;;) {
      const nx = cx + dx, ny = cy + dy;
      if (!open(nx, ny)) break;
      const o = g[ny][nx];
      if (!o) { cx = nx; cy = ny; continue; }
      if (t.type === 'num' && o.type === 'num' && !o.frozen && o.v === t.v && !merged.has(o)) { into = o; cx = nx; cy = ny; }
      break;
    }
    if (cx === x && cy === y) continue;
    moved = true;
    g[y][x] = null;
    if (into) {
      const m = { merge: true, a: t, b: into, x: cx, y: cy, v: t.v * 2 };
      g[cy][cx] = m;
      merged.add(m);
      results.push(m);
      gain += m.v;
    } else {
      g[cy][cx] = t;
      results.push({ t, x: cx, y: cy });
    }
  }
  return { moved, g, results, gain };
}

const hasMove = () => Object.keys(DIRV).some(d => computeSlide(d).moved);

function cellPos(x, y) { return { x: bx + x * cs, y: by + y * cs }; }

function renderPos(t) {
  const target = cellPos(t.x, t.y);
  if (!t.anim) return target;
  const p = (now - t.anim.t0) / (t.anim.dur || MOVE_MS);
  if (p >= 1) { t.anim = null; return target; }
  const e = easeOutCubic(Math.max(0, p));
  return { x: lerp(t.anim.sx, target.x, e), y: lerp(t.anim.sy, target.y, e) };
}

function applySlide(r) {
  const prev = new Map(allTiles().map(t => [t, renderPos(t)]));
  const slideTo = (t, x, y) => { const p = prev.get(t); t.x = x; t.y = y; t.anim = { sx: p.x, sy: p.y, t0: now }; };
  ghosts = ghosts.filter(gh => now < gh.until);
  let best = 0;
  for (const res of r.results) {
    if (res.merge) {
      slideTo(res.a, res.x, res.y);
      ghosts.push({ t: res.a, until: now + MOVE_MS }, { t: res.b, until: now + MOVE_MS });
      best = Math.max(best, res.v);
    } else slideTo(res.t, res.x, res.y);
  }
  S.cells = r.g.map((row, y) => row.map((c, x) => {
    if (!c || !c.merge) return c;
    const t = newTile(c.v, x, y);
    t.born = now + MOVE_MS * 0.7;
    t.pop = true;
    return t;
  }));
  return best;
}

function move(input) {
  if (!S || S.over || performance.now() < S.lockUntil || !$('overlay').hidden) return;
  const dir = S.fx.swap > 0 ? S.swapMap.map[input] : input;
  const r = computeSlide(dir);
  if (!r.moved) { shake = 5; sfx.bump(); return; }
  if (dir !== input) addPopup(ARROW[dir], '#ff5ec4', 70, bx + (S.w * cs) / 2, by + (S.h * cs) / 2, 500);

  const best = applySlide(r);
  S.moves++;
  S.score += r.gain;
  if (best) sfx.merge(best); else sfx.slide();
  spawnTile();
  tick();
  updateMax();
  if (--S.mutIn <= 0) runMutation();
  refresh();
  if (!hasMove()) endGame();
}

function tick() {
  const booms = [];
  for (const t of allTiles()) {
    if (t.frozen > 0 && --t.frozen === 0) burstAt(t.x, t.y, '#bde0fe', 8);
    if (t.type === 'bomb' && --t.timer <= 0) booms.push(t);
  }
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (S.rocks[y][x] > 0) S.rocks[y][x]--;
  if (S.fx.swap > 0) S.fx.swap--;
  booms.forEach(explode);
}

// Bom nổ: phá chính nó và 4 ô kề bên (ô đóng băng được lớp băng bảo vệ)
function explode(b) {
  if (S.cells[b.y][b.x] !== b) return;
  S.cells[b.y][b.x] = null;
  const lost = [];
  for (const [dx, dy] of Object.values(DIRV)) {
    const x = b.x + dx, y = b.y + dy;
    const t = x >= 0 && y >= 0 && x < S.w && y < S.h ? S.cells[y][x] : null;
    if (!t || t.frozen > 0) continue;
    S.cells[y][x] = null;
    if (t.type === 'num') lost.push(t.v);
    burstAt(x, y, t.type === 'num' ? tileColor(t.v) : '#ff4d6d', 12);
  }
  S.bombs++;
  shake = 16;
  sfx.boom();
  burstAt(b.x, b.y, '#ff9f1c', 30, 1.6);
  const c = cellPos(b.x + 0.5, b.y + 0.5);
  addPopup('BÙM!', '#ff4d6d', 40, c.x, c.y);
  if (lost.length) addPopup('Mất ' + lost.sort((a, b2) => b2 - a).join(', '), '#ff8fa3', 20, c.x, c.y + 36, 1800);
}

function updateMax() {
  const max = Math.max(2, ...allTiles().filter(t => t.type === 'num').map(t => t.v));
  if (max > S.maxTile) {
    S.maxTile = max;
    if (max >= 128) { addPopup(`ĐẠT ${max}!`, '#ffd166', 38, bx + (S.w * cs) / 2, by - 4); sfx.level(); }
  }
  const lv = clamp(Math.floor(Math.log2(S.maxTile)) - 5, 1, 12);
  if (lv > S.level) {
    S.level = lv;
    const unlocked = Object.values(MUTS).filter(m => m.lv === lv).map(m => m.name);
    if (unlocked.length) addPopup('Mở khóa: ' + unlocked.join(', '), '#ff8fa3', 18, bx + (S.w * cs) / 2, by + 30, 2600);
  }
}

// ---------- Biến đổi bàn ----------
function transform(map, nw, nh) {
  const cells = grid(nw, nh, null), mask = grid(nw, nh, false), rocks = grid(nw, nh, 0);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const [nx, ny] = map(x, y), t = S.cells[y][x];
    mask[ny][nx] = S.mask[y][x];
    rocks[ny][nx] = S.rocks[y][x];
    if (t) { t.x = nx; t.y = ny; }
    cells[ny][nx] = t;
  }
  Object.assign(S, { w: nw, h: nh, cells, mask, rocks });
}

function buildMask(shape) {
  return Array.from({ length: shape.h }, (_, y) => Array.from({ length: shape.w }, (_, x) => !!shape.mask(x, y)));
}

function reshape(shape) {
  const mask = buildMask(shape);
  const cells = grid(shape.w, shape.h, null), ox = Math.floor((shape.w - S.w) / 2), oy = Math.floor((shape.h - S.h) / 2);
  const free = (x, y) => x >= 0 && y >= 0 && x < shape.w && y < shape.h && mask[y][x] && !cells[y][x];
  // ô lớn được giữ chỗ trước, ô nằm ngoài hình mới dời tới ô trống gần nhất
  const homeless = [];
  for (const t of allTiles().sort((a, b) => (b.v || 0) - (a.v || 0))) {
    const nx = t.x + ox, ny = t.y + oy;
    if (free(nx, ny)) { cells[ny][nx] = t; t.x = nx; t.y = ny; } else homeless.push([t, nx, ny]);
  }
  for (const [t, nx, ny] of homeless) {
    let best = null, bd = Infinity;
    for (let y = 0; y < shape.h; y++) for (let x = 0; x < shape.w; x++) {
      const d = (x - nx) ** 2 + (y - ny) ** 2;
      if (free(x, y) && d < bd) { bd = d; best = [x, y]; }
    }
    if (!best) return false;
    cells[best[1]][best[0]] = t; t.x = best[0]; t.y = best[1];
  }
  Object.assign(S, { shape, w: shape.w, h: shape.h, mask, cells, rocks: grid(shape.w, shape.h, 0) });
  return true;
}

// ---------- Đột biến ----------
const MUTS = {
  freeze: {
    name: 'ĐÓNG BĂNG', icon: '🧊', lv: 1, desc: 'Ô bị đóng băng đứng yên như tường và không gộp được trong 6 lượt',
    run() {
      const nums = allTiles().filter(t => t.type === 'num' && !t.frozen).sort((a, b) => b.v - a.v);
      if (!nums.length) return false;
      const k = Math.min(nums.length, S.level >= 3 ? 2 : 1), chosen = new Set();
      if (Math.random() < 0.5) chosen.add(nums[0]);       // ô lớn nhất hay bị nhắm tới
      for (const t of shuffle(nums.slice())) if (chosen.size < k) chosen.add(t);
      chosen.forEach(t => { t.frozen = 6; });
      sfx.freeze();
      return [...chosen].map(t => t.v).join(', ') + ' bị đóng băng';
    },
  },
  bomb: {
    name: 'BOM HẸN GIỜ', icon: '💣', lv: 1, desc: 'Bom nổ phá các ô kề bên — trừ ô đang đóng băng',
    run() {
      const e = empties();
      if (!e.length) return false;
      const [x, y] = pick(e), t = newTile(0, x, y, 'bomb');
      t.timer = Math.max(5, 9 - Math.floor(S.level / 2));
      S.cells[y][x] = t;
      return `Nổ sau ${t.timer} lượt`;
    },
  },
  swap: {
    name: 'ĐẢO HƯỚNG VUỐT', icon: '🔀', lv: 1, desc: `${EFFECT_MOVES} lượt: hướng vuốt bị hoán đổi`,
    run() {
      S.swapMap = pick(SWAPS);
      S.fx.swap = EFFECT_MOVES;
      return `${S.swapMap.name}: ⬆ thành ${ARROW[S.swapMap.map.up]} · ⬅ thành ${ARROW[S.swapMap.map.left]}`;
    },
  },
  reshape: {
    name: 'ĐỔI HÌNH BÀN', icon: '🧩', lv: 1, desc: 'Bàn chơi biến hình, các ô bị dồn vào chỗ mới',
    run() {
      const n = allTiles().length;
      const options = SHAPES.filter(s => {
        if (s.id === S.shape.id) return false;
        let cap = 0;
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.mask(x, y)) cap++;
        return cap >= n + 3;
      });
      if (!options.length) return false;
      const shape = pick(options);
      return reshape(shape) ? shape.name : false;
    },
  },
  rotate: {
    name: 'XOAY BÀN', icon: '🔄', lv: 1, desc: 'Cả bàn xoay 90°',
    run() {
      const cw = Math.random() < 0.5, { w, h } = S;
      transform(cw ? (x, y) => [h - 1 - y, x] : (x, y) => [y, w - 1 - x], h, w);
      return cw ? 'Theo chiều kim đồng hồ ↻' : 'Ngược chiều kim đồng hồ ↺';
    },
  },
  rain: {
    name: 'MƯA SỐ', icon: '🌧️', lv: 1, desc: 'Vài ô số mới rơi xuống bàn',
    run() {
      const k = S.level >= 4 ? 3 : 2;
      let n = 0;
      for (let i = 0; i < k; i++) if (spawnTile()) n++;
      return n ? `${n} ô mới` : false;
    },
  },
  rock: {
    name: 'ĐÁ CHẮN', icon: '🪨', lv: 2, desc: 'Vài ô trống hóa đá trong 6 lượt, chặn đường trượt',
    run() {
      const e = shuffle(empties()).slice(0, S.level >= 4 ? 2 : 1);
      if (!e.length) return false;
      e.forEach(([x, y]) => { S.rocks[y][x] = 6; });
      return `${e.length} ô đá`;
    },
  },
  flip: {
    name: 'LẬT GƯƠNG', icon: '🪞', lv: 2, desc: 'Bàn chơi lật như soi gương',
    run() {
      const { w, h } = S, horiz = Math.random() < 0.5;
      transform(horiz ? (x, y) => [w - 1 - x, y] : (x, y) => [x, h - 1 - y], w, h);
      return horiz ? 'Lật trái ⇄ phải' : 'Lật trên ⇅ dưới';
    },
  },
};

function pickMut(exclude) {
  const pool = Object.keys(MUTS).filter(k => MUTS[k].lv <= S.level && k !== exclude && k !== S.lastMut);
  return pick(pool);
}

function mutInterval() {
  return 10 + rnd(6);   // ngẫu nhiên 10–15 lượt
}

function snapshot() {
  return {
    w: S.w, h: S.h, shape: S.shape, fx: { ...S.fx }, swapMap: S.swapMap,
    mask: S.mask.map(r => r.slice()), rocks: S.rocks.map(r => r.slice()), cells: S.cells.map(r => r.slice()),
    tiles: allTiles().map(t => [t, { ...t }]),
  };
}

function restore(s) {
  Object.assign(S, { w: s.w, h: s.h, shape: s.shape, fx: s.fx, swapMap: s.swapMap, mask: s.mask, rocks: s.rocks, cells: s.cells });
  s.tiles.forEach(([t, v]) => Object.assign(t, v));
}

// Đột biến không bao giờ được làm người chơi hết nước đi:
// thử đột biến đã báo trước, không được thì thử loại khác, không loại nào được thì hoãn.
function runMutation() {
  const planned = S.nextMut;
  const order = [planned, ...shuffle(Object.keys(MUTS).filter(k => k !== planned && MUTS[k].lv <= S.level))];
  const prev = new Map(allTiles().map(t => [t, renderPos(t)]));
  let done = null;
  for (const id of order) {
    const snap = snapshot();
    const detail = MUTS[id].run();
    if (detail !== false && hasMove()) { done = { id, detail }; break; }
    restore(snap);
  }
  if (done) {
    S.mutCount++;
    S.lastMut = done.id;
    S.boardT0 = now;
    S.lockUntil = performance.now() + 450;
    layout();
    for (const t of allTiles()) {
      const p = prev.get(t);
      if (!p) { t.born = now; continue; }
      const target = cellPos(t.x, t.y);
      if (p.x !== target.x || p.y !== target.y) t.anim = { sx: p.x, sy: p.y, t0: now, dur: 450 };
    }
    showBanner(MUTS[done.id], done.detail, done.id !== planned ? `thay cho ${MUTS[planned].name}` : '');
    sfx.alarm();
  } else {
    addPopup('Đột biến bị hoãn', '#06d6a0', 20, bx + (S.w * cs) / 2, by - 4);
  }
  S.nextMut = pickMut(S.lastMut);
  S.mutIn = mutInterval();
}

// ---------- Kết thúc & hồi sinh ----------
function endGame() {
  S.over = true;
  if (S.score > S.best) { S.best = S.score; S.newBest = true; store.set('mg_best', S.best); }
  sfx.over();
  shake = 10;
  refresh();
  setTimeout(() => {
    if (!S.over) return;
    $('finalScore').textContent = S.score;
    $('newBest').hidden = !S.newBest;
    $('stMax').textContent = S.maxTile;
    $('stMoves').textContent = S.moves;
    $('stMuts').textContent = S.mutCount;
    $('stBombs').textContent = S.bombs;
    showCard('overCard');
  }, 900);
}

// Hồi sinh: gỡ bom, phá băng, dọn đá rồi xóa dần các ô nhỏ nhất cho tới khi đủ chỗ thở
function revive() {
  S.over = false;
  S.revives++;
  for (const t of allTiles()) {
    t.frozen = 0;
    if (t.type === 'bomb') { S.cells[t.y][t.x] = null; burstAt(t.x, t.y, '#06d6a0', 10); }
  }
  S.rocks = grid(S.w, S.h, 0);
  S.fx.swap = 0;
  const nums = allTiles().sort((a, b) => a.v - b.v), need = Math.max(4, Math.floor(openCount() / 3));
  for (let i = 0; i < nums.length - 1 && (empties().length < need || !hasMove()); i++) {
    const t = nums[i];
    S.cells[t.y][t.x] = null;
    burstAt(t.x, t.y, tileColor(t.v), 8);
  }
  S.mutIn = Math.max(S.mutIn, 4);
  hideOverlay();
  sfx.level();
  addPopup('HỒI SINH!', '#06d6a0', 44, bx + (S.w * cs) / 2, by + (S.h * cs) / 2);
  refresh();
}

// ---------- Hiệu ứng ----------
function burstAt(x, y, color, n, power = 1) {
  const c = cellPos(x + 0.5, y + 0.5);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (80 + Math.random() * 220) * power;
    particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, s: 3 + Math.random() * 5, color, life: 1, ttl: 0.5 + Math.random() * 0.4 });
  }
}

function addPopup(text, color, size, x, y, dur = 1300) {
  popups.push({ text, color, size, x, y, t0: now, dur });
}

function showBanner(m, detail, tag) {
  const el = $('banner');
  el.querySelector('.b-tag').textContent = tag;
  el.querySelector('.b-icon').textContent = m.icon;
  el.querySelector('.b-name').textContent = m.name;
  el.querySelector('.b-desc').textContent = m.desc;
  el.querySelector('.b-detail').textContent = detail;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// ---------- HUD ----------
function refresh() {
  if (!S) return;
  if (S.score > S.best && !S.over) { S.best = S.score; store.set('mg_best', S.best); }
  $('best').textContent = S.best;
  setVal('maxTile', S.maxTile);

  const m = MUTS[S.nextMut], hidden = S.level >= 6, next = $('next');
  next.innerHTML = `<span class="ico">${hidden ? '❓' : m.icon}</span>Đột biến kế: <b>${hidden ? '???' : m.name}</b>` +
    `<span class="cnt">${S.mutIn <= 1 ? 'LƯỢT SAU!' : `sau ${S.mutIn} lượt`}</span>`;
  next.classList.toggle('urgent', S.mutIn <= 1);

  const chips = [], ts = allTiles();
  if (S.fx.swap > 0) chips.push(`🔀 ${S.swapMap.name} ×${S.fx.swap}`);
  const frozen = ts.filter(t => t.frozen > 0);
  if (frozen.length) chips.push(`🧊 ${frozen.length} ô băng`);
  const bombs = ts.filter(t => t.type === 'bomb');
  if (bombs.length) chips.push(`💣 nổ sau ${Math.min(...bombs.map(t => t.timer))}`);
  const rocks = S.rocks.flat().filter(r => r > 0).length;
  if (rocks) chips.push(`🪨 ${rocks} đá`);
  $('effects').innerHTML = chips.map(c => `<span class="chip bad">${c}</span>`).join('');
}

function setVal(id, v) {
  const el = $(id);
  if (el.textContent === String(v)) return;
  el.textContent = v;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

// ---------- Vẽ ----------
function resize() {
  const r = cv.parentElement.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function layout() {
  const pad = 14;
  cs = Math.max(20, Math.floor(Math.min((W - pad * 2) / S.w, (H - pad * 2) / S.h, 120)));
  bx = Math.round((W - S.w * cs) / 2);
  by = Math.round((H - S.h * cs) / 2);
  gap = Math.max(2, cs * 0.05);
}

function rr(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const tileColor = v => TILE_COLORS[Math.min(Math.log2(v), TILE_COLORS.length) - 1] || TILE_COLORS[0];

function drawTile(t) {
  if (t.born > now) return;
  const pos = renderPos(t);
  let s = cs - gap * 2, x = pos.x + gap, y = pos.y + gap;
  const age = (now - t.born) / 200;
  if (age < 1) {
    const k = t.pop ? 1 + 0.18 * Math.sin(age * Math.PI) : easeOutBack(age) * 0.9 + 0.1;
    x += (s * (1 - k)) / 2; y += (s * (1 - k)) / 2; s *= k;
  }
  const r = s * 0.16;
  if (t.type === 'bomb') {
    const pulse = t.timer <= 2 ? 0.5 + 0.5 * Math.sin(now / 80) : 0;
    ctx.fillStyle = '#1a1c2e'; rr(x, y, s, s, r); ctx.fill();
    ctx.fillStyle = `rgb(${200 + 55 * pulse | 0},40,60)`;
    ctx.beginPath(); ctx.arc(x + s / 2, y + s * 0.56, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d0d0d8'; ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.beginPath(); ctx.moveTo(x + s * 0.64, y + s * 0.32); ctx.lineTo(x + s * 0.76, y + s * 0.16); ctx.stroke();
    ctx.fillStyle = Math.random() < 0.5 ? '#ffd166' : '#ff9f1c';
    ctx.beginPath(); ctx.arc(x + s * 0.78, y + s * 0.14, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 ${s * 0.32}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.timer, x + s / 2, y + s * 0.6);
    return;
  }
  const col = tileColor(t.v);
  ctx.fillStyle = shade(col, -0.38); rr(x, y, s, s, r); ctx.fill();
  ctx.fillStyle = col; rr(x, y, s, s * 0.92, r); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(x + s * 0.1, y + s * 0.06, s * 0.8, s * 0.14, r * 0.6); ctx.fill();
  const digits = String(t.v).length;
  ctx.fillStyle = t.v <= 64 ? '#10121f' : '#ffffff';
  ctx.font = `800 ${s * [0.5, 0.5, 0.42, 0.34, 0.28, 0.23][Math.min(digits, 5)]}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t.v, x + s / 2, y + s * 0.5);
  if (t.frozen > 0) {
    ctx.fillStyle = 'rgba(189,224,254,0.55)'; rr(x, y, s, s, r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(2, s * 0.04); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + s * 0.15, y + s * 0.3); ctx.lineTo(x + s * 0.35, y + s * 0.15);
    ctx.moveTo(x + s * 0.7, y + s * 0.85); ctx.lineTo(x + s * 0.88, y + s * 0.62);
    ctx.stroke();
    ctx.fillStyle = '#1d3557'; ctx.font = `800 ${s * 0.2}px ${FONT}`;
    ctx.fillText('❄' + t.frozen, x + s * 0.78, y + s * 0.18);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  if (!S) return;
  layout();
  ctx.save();
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // khung bàn (nhấp nháy hồng khi đang đảo hướng)
  const boardA = clamp((now - S.boardT0) / 350, 0, 1);
  if (S.fx.swap > 0) {
    ctx.strokeStyle = `rgba(255,94,196,${0.45 + 0.35 * Math.sin(now / 150)})`; ctx.lineWidth = 4;
    rr(bx - 8, by - 8, S.w * cs + 16, S.h * cs + 16, 18); ctx.stroke();
  }
  ctx.globalAlpha = boardA;
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    if (!S.mask[y][x]) continue;
    const px = bx + x * cs + gap, py = by + y * cs + gap, s = cs - gap * 2;
    ctx.fillStyle = 'rgba(120,130,255,0.09)'; rr(px - gap, py - gap, s + gap * 2, s + gap * 2, s * 0.22); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(px, py, s, s, s * 0.16); ctx.fill();
    if (S.rocks[y][x] > 0) {
      ctx.fillStyle = shade('#8d99ae', -0.4); rr(px, py, s, s, s * 0.16); ctx.fill();
      ctx.fillStyle = '#8d99ae'; rr(px, py, s, s * 0.9, s * 0.16); ctx.fill();
      ctx.fillStyle = 'rgba(30,34,50,0.5)';
      for (const [u, v] of [[0.3, 0.3], [0.65, 0.45], [0.4, 0.68]]) { ctx.beginPath(); ctx.arc(px + s * u, py + s * v, s * 0.07, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#1a1c2e'; ctx.font = `800 ${s * 0.22}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(S.rocks[y][x], px + s * 0.8, py + s * 0.8);
    }
  }
  ctx.globalAlpha = S.over ? 0.5 : 1;

  ghosts = ghosts.filter(gh => { if (now >= gh.until) return false; drawTile(gh.t); return true; });
  for (const t of allTiles()) drawTile(t);
  ctx.globalAlpha = 1;

  for (const q of particles) { ctx.globalAlpha = clamp(q.life * 1.5, 0, 1); ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, q.s, q.s); }
  ctx.globalAlpha = 1;

  popups = popups.filter(q => {
    const p = (now - q.t0) / q.dur;
    if (p >= 1) return false;
    const a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3, s = p < 0.12 ? lerp(0.4, 1.1, p / 0.12) : 1;
    ctx.save();
    ctx.translate(clamp(q.x, 80, W - 80), q.y - 40 * easeOutCubic(p));
    ctx.scale(s, s);
    ctx.globalAlpha = a;
    ctx.font = `800 ${q.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, q.size * 0.16); ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,10,22,0.9)'; ctx.strokeText(q.text, 0, 0);
    ctx.fillStyle = q.color; ctx.fillText(q.text, 0, 0);
    ctx.restore();
    return true;
  });
  ctx.restore();
}

let last = performance.now();
function frame(t) {
  now = t;
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  shake *= Math.pow(0.003, dt);
  if (shake < 0.3) shake = 0;
  particles = particles.filter(q => { q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt / q.ttl; return q.life > 0; });
  if (S && shownScore !== S.score) {
    shownScore = shownScore < S.score ? Math.min(S.score, shownScore + Math.ceil((S.score - shownScore) * 0.2)) : S.score;
    $('score').textContent = shownScore;
  }
  draw();
  requestAnimationFrame(frame);
}

// ---------- Điều khiển ----------
cv.addEventListener('pointerdown', e => {
  Sound.init();
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
});
cv.addEventListener('pointerup', e => {
  if (!swipe || swipe.id !== e.pointerId) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  swipe = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
cv.addEventListener('pointercancel', () => { swipe = null; });

const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const dir = KEYS[e.key] || KEYS[e.key.toLowerCase()];
  if (!dir) return;
  e.preventDefault();
  Sound.init();
  move(dir);
});

function showCard(id) {
  $('overlay').hidden = false;
  for (const c of ['startCard', 'overCard']) $(c).hidden = c !== id;
}
function hideOverlay() { $('overlay').hidden = true; }

function start() {
  Sound.init();
  hideOverlay();
  newGame();
}

$('startBtn').addEventListener('click', start);
$('againBtn').addEventListener('click', start);
$('restartBtn').addEventListener('click', () => {
  if (S && !S.over && S.moves > 0 && !confirm('Bỏ ván này và chơi lại?')) return;
  start();
});
const muteBtn = $('muteBtn');
muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
muteBtn.addEventListener('click', () => {
  Sound.muted = !Sound.muted;
  muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
  Sound.init();
});

$('mutList').innerHTML = Object.values(MUTS).map(m => `<span>${m.icon} ${m.name}</span>`).join('');
Revive.mount($('revive'), revive);

new ResizeObserver(resize).observe(cv.parentElement);
resize();
newGame();          // ván "nền" phía sau màn hình bắt đầu
requestAnimationFrame(frame);
