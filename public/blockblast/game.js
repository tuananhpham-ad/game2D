'use strict';

/* ============================================================
   BLOCK CHAOS — xếp khối siêu khó với đột biến ngẫu nhiên
   ============================================================ */

// ---------- Cấu hình ----------
const COLORS = ['#ff4d6d', '#ffb703', '#06d6a0', '#4cc9f0', '#9d4edd', '#f77f00', '#3a86ff', '#ff5ec4'];
const JUNK_COLOR = '#5a6178';
const STONE_COLOR = '#9aa3b5';
const BOMB_COLOR = '#2b2d42';
const LOCK_COLOR = '#11131f';
const FONT = '"Baloo 2", system-ui, sans-serif';
const LINES_PER_LEVEL = 6;
const MAX_TOKENS = 5;
const EFFECT_MOVES = 3;
const MUT_DELAY = 420;   // ms chờ sau khi đặt khối rồi mới đột biến
const MUT_GAP = 1100;    // ms giữa 2 đột biến của đột biến kép

// tier: độ khó của khối (0 dễ → 4 rất khó). Khối được xoay/lật ngẫu nhiên khi sinh ra.
const PIECES = [
  { tier: 0, cells: [[0, 0]] },
  { tier: 0, cells: [[0, 0], [1, 0]] },
  { tier: 0, cells: [[0, 0], [1, 0], [2, 0]] },
  { tier: 0, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { tier: 0, cells: [[0, 0], [0, 1], [1, 1]] },
  { tier: 1, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { tier: 1, cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { tier: 1, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { tier: 1, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { tier: 2, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { tier: 2, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { tier: 2, cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
  { tier: 2, cells: [[0, 0], [1, 1]] },
  { tier: 3, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]] },
  { tier: 3, cells: [[0, 0], [1, 1], [2, 2]] },
  { tier: 3, cells: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  { tier: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
  { tier: 3, cells: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]] },
  { tier: 4, cells: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]] },
  { tier: 4, cells: [[0, 0], [2, 0]] },
  { tier: 4, cells: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]] },
];
const TIER_WEIGHT = [10, 8, 6, 4, 3];

// Các sơ đồ bàn chơi
const SHAPES = [
  { id: 'sq8', name: 'Vuông 8×8', w: 8, h: 8, mask: () => true },
  { id: 'sq7', name: 'Vuông nhỏ 7×7', w: 7, h: 7, mask: () => true },
  { id: 'sq9', name: 'Vuông lớn 9×9', w: 9, h: 9, mask: () => true },
  { id: 'wide', name: 'Chữ nhật ngang 10×6', w: 10, h: 6, mask: () => true },
  { id: 'tall', name: 'Chữ nhật đứng 6×10', w: 6, h: 10, mask: () => true },
  { id: 'cross', name: 'Chữ thập', w: 9, h: 9, mask: (x, y) => !((x < 2 || x > 6) && (y < 2 || y > 6)) },
  { id: 'octa', name: 'Bát giác', w: 9, h: 9, mask: (x, y) => Math.abs(x - 4) + Math.abs(y - 4) <= 5 },
  { id: 'donut', name: 'Bánh vòng (thủng giữa)', w: 9, h: 9, mask: (x, y) => !(x >= 3 && x <= 5 && y >= 3 && y <= 5) },
  { id: 'hourglass', name: 'Đồng hồ cát', w: 8, h: 9, mask: (x, y) => { const i = Math.max(0, 2 - Math.abs(y - 4)); return x >= i && x < 8 - i; } },
];

const DIRS = [
  { d: [0, 1], name: 'dưới', arrow: '⬇' },
  { d: [0, -1], name: 'trên', arrow: '⬆' },
  { d: [-1, 0], name: 'trái', arrow: '⬅' },
  { d: [1, 0], name: 'phải', arrow: '➡' },
];

// ---------- Tiện ích ----------
const $ = id => document.getElementById(id);

// RNG có seed cho mọi thứ ảnh hưởng tới luật chơi, để có thể "chạy thử" một đột biến
// rồi chạy thật ra đúng kết quả đó. Hiệu ứng hình ảnh vẫn dùng Math.random.
let rngState = (Math.random() * 2 ** 32) >>> 0;
function seedRng(s) { rngState = s >>> 0; }
function rand() {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const newSeed = () => (Math.random() * 2 ** 32) >>> 0;
const rnd = n => Math.floor(rand() * n);
const pick = a => a[rnd(a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

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

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
};

// ---------- Âm thanh (WebAudio, không cần file) ----------
const Sound = {
  ac: null,
  muted: store.get('bc_muted', false),
  init() {
    if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (this.ac.state === 'suspended') this.ac.resume();
  },
  tone(f, d, type = 'sine', v = 0.1, f2 = null, delay = 0) {
    if (this.muted || !this.ac || DRY) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.ac.destination);
    o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, v = 0.3, freq = 900) {
    if (this.muted || !this.ac || DRY) return;
    const len = Math.floor(this.ac.sampleRate * d), buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = v;
    src.connect(f).connect(g).connect(this.ac.destination);
    src.start();
  },
};

const sfx = {
  pick: () => Sound.tone(520, 0.05, 'triangle', 0.05),
  place: () => Sound.tone(190, 0.09, 'square', 0.06, 90),
  bad: () => Sound.tone(150, 0.16, 'sawtooth', 0.05, 80),
  rotate: () => Sound.tone(500, 0.1, 'triangle', 0.07, 1000),
  clear(n, combo) {
    const base = 440 * Math.pow(2, Math.min(combo, 10) / 12), steps = [0, 4, 7, 12, 16, 19];
    for (let i = 0; i < Math.min(n + 2, 6); i++) Sound.tone(base * Math.pow(2, steps[i] / 12), 0.15, 'triangle', 0.08, null, i * 0.055);
  },
  alarm() { Sound.tone(880, 0.16, 'sawtooth', 0.06, 440); Sound.tone(880, 0.16, 'sawtooth', 0.06, 440, 0.19); },
  whoosh: () => Sound.noise(0.45, 0.18, 1800),
  quake() { Sound.noise(0.9, 0.35, 300); Sound.tone(60, 0.8, 'sine', 0.25, 30); },
  boom() { Sound.noise(0.7, 0.5, 600); Sound.tone(110, 0.5, 'sine', 0.3, 30); },
  level() { [0, 4, 7, 12].forEach((s, i) => Sound.tone(523 * Math.pow(2, s / 12), 0.18, 'square', 0.05, null, i * 0.09)); },
  over() { [0, -3, -7, -12].forEach((s, i) => Sound.tone(330 * Math.pow(2, s / 12), 0.3, 'triangle', 0.1, null, i * 0.2)); },
};

// ---------- Canvas & trạng thái ----------
const cv = $('cv');
const ctx = cv.getContext('2d');

let S = null;             // trạng thái ván chơi
let gameSeq = 0;
let now = performance.now();
let W = 0, H = 0;
let cs = 40, bx = 0, by = 0, trayY = 0, trayH = 0, traySc = 20;
let shake = 0;
let boardAnim = null;
let particles = [], popups = [], clearing = [];
let drag = null, pending = null;
let hlCache = { key: '', cells: [] };
let shownScore = 0;
let hint = null;          // { i, gx, gy } — nước đi gợi ý đang hiển thị
let DRY = false;          // đang chạy thử đột biến trên bản sao trạng thái

// ---------- Bàn chơi ----------
function makeBoard(shape) {
  const mask = [], cells = [];
  for (let y = 0; y < shape.h; y++) {
    mask.push([]); cells.push([]);
    for (let x = 0; x < shape.w; x++) { mask[y].push(!!shape.mask(x, y)); cells[y].push(null); }
  }
  return { w: shape.w, h: shape.h, shape, mask, cells };
}

const isCell = (x, y) => { const b = S.board; return x >= 0 && y >= 0 && x < b.w && y < b.h && b.mask[y][x]; };
const isFree = (x, y) => isCell(x, y) && !S.board.cells[y][x];
const solid = c => !!c && c.type !== 'lock';   // ô khóa chặn không cho hàng được xóa

function eachCell(fn) {
  const b = S.board;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.mask[y][x]) fn(x, y, b.cells[y][x]);
}
function listCells(pred) {
  const out = [];
  eachCell((x, y, c) => { if (pred(c)) out.push([x, y]); });
  return out;
}

function colorOf(c) {
  return { block: c.color, junk: JUNK_COLOR, stone: STONE_COLOR, bomb: BOMB_COLOR, lock: LOCK_COLOR }[c.type];
}

// ---------- Khối ----------
function normalize(cells) {
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  const out = cells.map(([x, y]) => [x - mx, y - my]);
  return { cells: out, w: Math.max(...out.map(c => c[0])) + 1, h: Math.max(...out.map(c => c[1])) + 1 };
}

function rotCells(cells, k) {
  let c = cells;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) c = c.map(([x, y]) => [-y, x]);
  return normalize(c);
}

function makePiece(extraTier = 0) {
  const tierMax = clamp(1 + Math.ceil(S.level / 2) + extraTier, 0, 4);
  const pool = PIECES.filter(p => p.tier <= tierMax);
  const weight = p => TIER_WEIGHT[p.tier] * (1 + (S.level - 1) * 0.15 * p.tier);
  let r = rand() * pool.reduce((s, p) => s + weight(p), 0), def = pool[0];
  for (const p of pool) { r -= weight(p); if (r <= 0) { def = p; break; } }
  return pieceFrom(def.cells);
}

function pieceFrom(cells) {
  if (rand() < 0.5) cells = cells.map(([x, y]) => [-x, y]);
  return { ...rotCells(cells, rnd(4)), color: pick(COLORS), used: false, born: now, rot: null, fits: true };
}

function rotatePiece(p, k) {
  Object.assign(p, rotCells(p.cells, k));
  p.rot = { t0: now, from: -k * Math.PI / 2 };
}

function canPlace(p, gx, gy) {
  return p.cells.every(([x, y]) => isFree(gx + x, gy + y));
}

function anyFit(p) {
  const b = S.board;
  for (let gy = 0; gy <= b.h - p.h; gy++) for (let gx = 0; gx <= b.w - p.w; gx++) if (canPlace(p, gx, gy)) return true;
  return false;
}

// Khay mới luôn phải có ít nhất một thứ tự + vị trí đặt được cả 3 khối.
// Thử độ khó bình thường trước, không được thì dễ dần; "strict" = còn ≥3 ô trống sau khi đặt xong.
function refillTray() {
  const stages = [[14, 0, true], [10, -1, true], [10, -3, true], [10, -3, false]];
  for (const [tries, extra, strict] of stages) {
    for (let k = 0; k < tries; k++) {
      S.tray = [makePiece(extra), makePiece(extra), makePiece(extra)];
      if (trayPath(4000, strict).path) return;
    }
  }
  S.tray = [pieceFrom([[0, 0]]), pieceFrom([[0, 0]]), pieceFrom([[0, 0]])];
}

// ---------- Bộ giải: tìm cách đặt hết các khối còn lại trong khay ----------
// Mô phỏng đúng luật của placePiece (gió, xóa hàng, đá, bom nổ, ô khóa hết hạn) trên mảng gọn.
// Mã ô: 0 trống, 1 khối/rác, 2 đá, 3 đá nứt, 4 bom, 5 ô khóa
function simFromState() {
  const b = S.board, n = b.w * b.h, mask = new Uint8Array(n), t = new Uint8Array(n), tm = new Uint8Array(n);
  let timers = 0;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = y * b.w + x, c = b.cells[y][x];
    mask[i] = b.mask[y][x] ? 1 : 0;
    if (!c) continue;
    t[i] = c.type === 'stone' ? (c.hp > 1 ? 2 : 3) : c.type === 'bomb' ? 4 : c.type === 'lock' ? 5 : 1;
    if (t[i] >= 4) { tm[i] = c.timer; timers++; }
  }
  return { w: b.w, h: b.h, mask, t, tm, timers, wind: S.effects.wind, dx: S.windDir.d[0], dy: S.windDir.d[1], cl: 0 };
}

function simFits(s, p, gx, gy) {
  for (const [x, y] of p.cells) {
    const X = gx + x, Y = gy + y;
    if (X < 0 || Y < 0 || X >= s.w || Y >= s.h) return false;
    const i = Y * s.w + X;
    if (!s.mask[i] || s.t[i]) return false;
  }
  return true;
}

function simClear(s) {
  const { w, h, mask, t, tm } = s, hit = [];
  const solidAt = i => t[i] && t[i] !== 5;
  let lines = 0;
  for (let y = 0; y < h; y++) {
    let any = false, full = true;
    for (let x = 0; x < w; x++) { const i = y * w + x; if (mask[i]) { any = true; if (!solidAt(i)) { full = false; break; } } }
    if (any && full) { lines++; for (let x = 0; x < w; x++) if (mask[y * w + x]) hit.push(y * w + x); }
  }
  for (let x = 0; x < w; x++) {
    let any = false, full = true;
    for (let y = 0; y < h; y++) { const i = y * w + x; if (mask[i]) { any = true; if (!solidAt(i)) { full = false; break; } } }
    if (any && full) { lines++; for (let y = 0; y < h; y++) if (mask[y * w + x]) hit.push(y * w + x); }
  }
  if (!hit.length) return 0;
  const done = new Set();
  for (const i of hit) {
    if (done.has(i)) continue;
    done.add(i);
    if (t[i] === 2) t[i] = 3; else { t[i] = 0; tm[i] = 0; }
  }
  return lines;
}

function simPlace(s, p, gx, gy) {
  const n = { ...s, t: s.t.slice(), tm: s.tm.slice() }, { w, h, t, tm, mask } = n;
  for (const [x, y] of p.cells) t[(gy + y) * w + gx + x] = 1;
  if (n.wind > 0) {
    const { dx, dy } = n;
    for (let a = 0; a < h; a++) for (let b = 0; b < w; b++) {
      const y = dy > 0 ? h - 1 - a : a, x = dx > 0 ? w - 1 - b : b, i = y * w + x;
      if (!t[i] || t[i] === 5) continue;
      const X = x + dx, Y = y + dy, j = Y * w + X;
      if (X < 0 || Y < 0 || X >= w || Y >= h || !mask[j] || t[j]) continue;
      t[j] = t[i]; tm[j] = tm[i]; t[i] = 0; tm[i] = 0;
    }
  }
  n.cl = simClear(n);
  if (n.timers) {
    const booms = [];
    for (let i = 0; i < t.length; i++) {
      if (t[i] === 4 && --tm[i] <= 0) booms.push(i);
      else if (t[i] === 5 && --tm[i] <= 0) t[i] = 0;
    }
    for (const i of booms) {
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy, j = Y * w + X;
        if (X >= 0 && Y >= 0 && X < w && Y < h && mask[j]) { t[j] = 2; tm[j] = 0; }
      }
    }
    if (booms.length) n.cl += simClear(n);
  }
  if (n.wind > 0) n.wind--;
  return n;
}

function simFree(s) {
  let f = 0;
  for (let i = 0; i < s.t.length; i++) if (s.mask[i] && !s.t[i]) f++;
  return f;
}

// Tìm kiếm theo chiều sâu, ghi nhớ trạng thái đã thua, giới hạn số nút để không treo game.
function solve(sim, pieces, budget, strict) {
  const memo = new Set();
  let nodes = 0, aborted = false;
  function rec(s, remain) {
    const key = remain.join(',') + '|' + s.wind + '|' + s.t.join('') + (s.timers ? '|' + s.tm.join(',') : '');
    if (memo.has(key)) return null;
    const kids = [], seen = new Set();
    for (const i of remain) {
      const p = pieces[i], sig = p.cells.join(';');
      if (seen.has(sig)) continue;    // 2 khối giống hệt nhau thì thử 1 lần là đủ
      seen.add(sig);
      for (let gy = 0; gy <= s.h - p.h; gy++) for (let gx = 0; gx <= s.w - p.w; gx++) {
        if (!simFits(s, p, gx, gy)) continue;
        if (++nodes > budget) { aborted = true; return null; }
        if (remain.length === 1 && !strict) return [{ i, gx, gy }];
        const ns = simPlace(s, p, gx, gy);
        if (remain.length === 1) { if (simFree(ns) >= 3) return [{ i, gx, gy }]; continue; }
        kids.push({ i, gx, gy, ns });
      }
    }
    kids.sort((a, b) => b.ns.cl - a.ns.cl);   // ưu tiên nước xóa được hàng
    for (const k of kids) {
      const r = rec(k.ns, remain.filter(j => j !== k.i));
      if (r) return [{ i: k.i, gx: k.gx, gy: k.gy }, ...r];
      if (aborted) return null;
    }
    memo.add(key);
    return null;
  }
  return { path: rec(sim, pieces.map((_, i) => i)), aborted };
}

// Đường đi cho các khối chưa dùng trong khay hiện tại (chỉ số i theo khay thật)
function trayPath(budget = 6000, strict = false) {
  const idx = [];
  S.tray.forEach((p, i) => { if (!p.used) idx.push(i); });
  if (!idx.length) return { path: [], aborted: false };
  const r = solve(simFromState(), idx.map(i => S.tray[i]), budget, strict);
  return { path: r.path && r.path.map(m => ({ ...m, i: idx[m.i] })), aborted: r.aborted };
}

// ---------- Xóa hàng ----------
function findLines() {
  const b = S.board, rows = [], cols = [];
  for (let y = 0; y < b.h; y++) {
    let any = false, full = true;
    for (let x = 0; x < b.w; x++) if (b.mask[y][x]) { any = true; if (!solid(b.cells[y][x])) { full = false; break; } }
    if (any && full) rows.push(y);
  }
  for (let x = 0; x < b.w; x++) {
    let any = false, full = true;
    for (let y = 0; y < b.h; y++) if (b.mask[y][x]) { any = true; if (!solid(b.cells[y][x])) { full = false; break; } }
    if (any && full) cols.push(x);
  }
  return { rows, cols };
}

function lineCells({ rows, cols }) {
  const b = S.board, set = new Map();
  for (const y of rows) for (let x = 0; x < b.w; x++) if (b.mask[y][x]) set.set(y * 100 + x, [x, y]);
  for (const x of cols) for (let y = 0; y < b.h; y++) if (b.mask[y][x]) set.set(y * 100 + x, [x, y]);
  return [...set.values()];
}

// source: 'player' (tính combo) hoặc 'mutation' (đột biến vô tình tạo hàng → thưởng)
function clearLines(source) {
  const lines = findLines(), n = lines.rows.length + lines.cols.length;
  if (!n) {
    if (source === 'player' && ++S.comboMiss >= 3) S.combo = 0;
    return 0;
  }
  const b = S.board;
  let cleared = 0, defused = 0;
  for (const [x, y] of lineCells(lines)) {
    const c = b.cells[y][x];
    if (!c) continue;
    if (c.type === 'stone' && c.hp > 1) { c.hp = 1; spawnSparks(x, y, STONE_COLOR, 4); continue; }
    if (c.type === 'bomb') defused++;
    b.cells[y][x] = null;
    clearing.push({ x, y, color: colorOf(c), t0: now });
    spawnSparks(x, y, colorOf(c), 3);
    cleared++;
  }
  if (source === 'player') { S.combo++; S.comboMiss = 0; }
  const mult = 1 + Math.max(0, S.combo - 1) * 0.5;
  let pts = Math.round((cleared * 2 + 15 * n * n) * mult) + defused * 60;
  if (source === 'mutation') pts = Math.round(pts * 1.5);

  const cx = W / 2, cy = by + (b.h * cs) / 2;
  const label = n >= 4 ? `${n} HÀNG!!!` : n >= 2 ? `${n} HÀNG!` : '';
  if (label) addPopup(label, '#ffb703', 34, cx, cy - 34);
  addPopup('+' + pts, '#ffffff', 30, cx, cy);
  if (S.combo >= 2 && source === 'player') addPopup(`COMBO ×${S.combo}`, '#ff5ec4', 26, cx, cy + 34);
  if (source === 'mutation') addPopup('ĐỘT BIẾN TẶNG ĐIỂM', '#06d6a0', 20, cx, cy + 34);
  if (defused) addPopup(`GỠ BOM +${defused * 60}`, '#4cc9f0', 22, cx, cy + 62);

  if (listCells(c => !!c).length === 0) {
    const bonus = 300 * S.level;
    pts += bonus;
    addPopup(`SẠCH BÓNG +${bonus}`, '#06d6a0', 30, cx, cy - 70);
  }
  S.score += pts;
  S.lines += n;
  sfx.clear(n, S.combo);
  shake = Math.max(shake, 4 + n * 3);

  while (S.lines >= S.level * LINES_PER_LEVEL) levelUp();
  return n;
}

function levelUp() {
  S.level++;
  S.tokens = Math.min(MAX_TOKENS, S.tokens + 1);
  S.hints = Math.min(MAX_TOKENS, S.hints + 1);
  sfx.level();
  addPopup(`LÊN CẤP ${S.level}!`, '#4cc9f0', 34, W / 2, by + 30);
  const unlocked = Object.values(MUTS).filter(m => m.lv === S.level).map(m => m.name);
  if (unlocked.length) addPopup('Mở khóa: ' + unlocked.join(', '), '#ff8fa3', 17, W / 2, by + 62, 2600);
}

// ---------- Lượt chơi ----------
function placePiece(idx, gx, gy) {
  const p = S.tray[idx], b = S.board;
  p.used = true;
  hint = null;
  for (const [x, y] of p.cells) b.cells[gy + y][gx + x] = { type: 'block', color: p.color, born: now };
  S.score += p.cells.length;
  S.moves++;
  sfx.place();

  if (S.effects.wind > 0) slideAll(S.windDir.d[0], S.windDir.d[1], 1);
  clearLines('player');
  tickTimers();
  if (S.tray.every(t => t.used)) refillTray();

  if (--S.mutIn <= 0) triggerMutations();
  refresh();
  checkGameOver();
}

function tickTimers() {
  const b = S.board, booms = [];
  eachCell((x, y, c) => {
    if (!c) return;
    if (c.type === 'bomb' && --c.timer <= 0) booms.push([x, y]);
    else if (c.type === 'lock' && --c.timer <= 0) { b.cells[y][x] = null; spawnSparks(x, y, '#ff4d6d', 5); }
  });
  for (const k of ['mirror', 'fog', 'blind', 'wind']) if (S.effects[k] > 0) S.effects[k]--;
  if (booms.length) {
    booms.forEach(([x, y]) => explode(x, y));
    clearLines('mutation');
  }
}

function explode(x, y) {
  const b = S.board;
  shake = 32;
  sfx.boom();
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const X = x + dx, Y = y + dy;
    if (!isCell(X, Y)) continue;
    const old = b.cells[Y][X];
    if (old && old.type !== 'bomb') dropOff(X, Y);
    b.cells[Y][X] = { type: 'stone', hp: 2, born: now };
  }
  spawnSparks(x, y, '#ff9f1c', 26, 2);
  addPopup('BÙM!', '#ff4d6d', 44, bx + (x + 0.5) * cs, by + (y + 0.5) * cs);
}

function triggerMutations() {
  const gid = S.id;
  const plan = planMutations();
  const steps = plan.steps;
  if (steps.length) S.lastMut = steps[steps.length - 1].id;
  S.nextMut = pickMutation(S.lastMut);
  S.mutIn = mutInterval();
  S.locked = true;

  steps.forEach((st, i) => setTimeout(() => {
    if (!S || S.id !== gid || S.over) return;
    const m = MUTS[st.id];
    seedRng(st.seed);                 // cùng seed với lần chạy thử → cùng kết quả
    const detail = m.run() || '';
    S.mutCount++;
    hint = null;
    showBanner(m, detail, steps.length > 1 ? `ĐỘT BIẾN KÉP ${i + 1}/${steps.length}` : '');
    sfx.alarm();
    refresh();
  }, MUT_DELAY + i * MUT_GAP));

  setTimeout(() => {
    if (!S || S.id !== gid || S.over) return;
    clearLines('mutation');
    if (plan.tray) {
      S.tray = plan.tray.map(p => (p.used ? p : { ...p, born: now }));
      addPopup('Khay được đổi để còn đường thoát', '#06d6a0', 18, W / 2, trayY - 8, 2200);
    }
    if (!steps.length) addPopup('Đột biến bị hoãn — không được phép dồn bạn vào đường cùng', '#06d6a0', 16, W / 2, by + 30, 2400);
    S.locked = false;
    refresh();
    checkGameOver();
  }, steps.length ? MUT_DELAY + steps.length * MUT_GAP - 300 : 200);
}

// Chọn đột biến sao cho sau khi xảy ra vẫn còn cách đặt hết khay.
// Nếu người chơi đã tự vào thế chết từ trước thì cứ chạy như dự kiến.
function planMutations() {
  const planned = [S.nextMut];
  if (S.level >= 4 && Math.random() < Math.min(0.45, (S.level - 3) * 0.1)) planned.push(pickMutation(S.nextMut));
  const withSeeds = list => list.map(id => ({ id, seed: newSeed() }));

  const nowPath = trayPath(6000);
  if (!nowPath.path && !nowPath.aborted) return { steps: withSeeds(planned) };

  const candidates = [];
  for (let k = 0; k < 5; k++) candidates.push(withSeeds(planned));
  const others = Object.keys(MUTS).filter(k => MUTS[k].lv <= S.level && !planned.includes(k));
  for (const id of shuffle(others)) candidates.push(withSeeds([id]));

  const deadline = Date.now() + 300;
  for (const steps of candidates) {
    if (dryRun(steps, false).ok) return { steps };
    if (Date.now() > deadline) break;
  }
  for (const steps of candidates.slice(0, 3)) {
    const r = dryRun(steps, true);
    if (r.ok) return { steps, tray: r.tray };
  }
  return { steps: [] };
}

function cloneState(s) {
  const b = s.board;
  return {
    ...s,
    effects: { ...s.effects },
    board: { ...b, mask: b.mask.map(r => r.slice()), cells: b.cells.map(r => r.map(c => c && { ...c, slide: null })) },
    tray: s.tray.map(p => ({ ...p, cells: p.cells.map(c => c.slice()) })),
  };
}

// Chạy thử các bước đột biến trên bản sao, không để lại dấu vết (âm thanh, hiệu ứng, điểm…)
function dryRun(steps, rerollTray) {
  const real = S, vis = [particles, popups, clearing, boardAnim, shake, hlCache], rng = rngState;
  S = cloneState(real);
  DRY = true;
  let ok = false, tray = null;
  try {
    for (const st of steps) { seedRng(st.seed); MUTS[st.id].run(); }
    clearLines('mutation');
    if (!rerollTray) ok = !!trayPath(6000).path;
    else {
      for (let k = 0; k < 20 && !ok; k++) {
        S.tray = S.tray.map(p => (p.used ? p : makePiece(-2)));
        if (trayPath(4000).path) { ok = true; tray = S.tray; }
      }
    }
  } finally {
    S = real;
    DRY = false;
    [particles, popups, clearing, boardAnim, shake, hlCache] = vis;
    rngState = rng;
    layout();
  }
  return { ok, tray };
}

function pickMutation(exclude) {
  const pool = Object.keys(MUTS).filter(k => MUTS[k].lv <= S.level && k !== exclude && k !== S.lastMut);
  return pick(pool.length ? pool : Object.keys(MUTS).filter(k => MUTS[k].lv <= S.level));
}

function mutInterval() {
  return 10 + rnd(6);   // ngẫu nhiên 10–15 lượt
}

function checkGameOver() {
  if (S.over || S.locked) return;
  const avail = S.tray.filter(p => !p.used);
  if (avail.some(anyFit)) return;
  if (S.tokens > 0 && avail.some(p => [1, 2, 3].some(k => anyFit(rotCells(p.cells, k))))) {
    addPopup('Chạm khối để XOAY!', '#4cc9f0', 22, W / 2, trayY - 8, 2200);
    return;
  }
  endGame();
}

function endGame() {
  S.over = true;
  drag = pending = null;
  if (S.score > S.best) { S.best = S.score; S.newBest = true; store.set('bc_best', S.best); }
  sfx.over();
  shake = 14;
  refresh();
  const gid = S.id;
  setTimeout(() => { if (S.id === gid) showOver(); }, 1200);
}

// ---------- Thao tác trên bàn ----------
function moveCell(x, y, nx, ny) {
  const b = S.board, c = b.cells[y][x];
  b.cells[y][x] = null;
  b.cells[ny][nx] = c;
  const dist = Math.hypot(nx - x, ny - y);
  c.slide = { dx: nx - x, dy: ny - y, t0: now, dur: 160 + 55 * dist };
}

// Trượt mọi khối (trừ ô khóa) theo hướng (dx,dy), tối đa maxSteps ô
function slideAll(dx, dy, maxSteps) {
  const b = S.board;
  const xs = [...Array(b.w).keys()], ys = [...Array(b.h).keys()];
  if (dx > 0) xs.reverse();
  if (dy > 0) ys.reverse();
  let moved = 0;
  for (const y of ys) for (const x of xs) {
    const c = b.cells[y][x];
    if (!c || c.type === 'lock') continue;
    let nx = x, ny = y, steps = 0;
    while (steps < maxSteps && isFree(nx + dx, ny + dy)) { nx += dx; ny += dy; steps++; }
    if (steps) { moveCell(x, y, nx, ny); moved++; }
  }
  return moved;
}

function dropOff(x, y) {
  const c = S.board.cells[y][x];
  if (!c) return;
  S.board.cells[y][x] = null;
  particles.push({
    kind: 'block', color: colorOf(c), s: cs,
    x: bx + x * cs, y: by + y * cs,
    vx: (Math.random() - 0.5) * 220, vy: -150 - Math.random() * 250,
    rot: 0, vr: (Math.random() - 0.5) * 10, life: 1, ttl: 1.6,
  });
}

function transformBoard(map, nw, nh) {
  const b = S.board, mask = [], cells = [];
  for (let y = 0; y < nh; y++) { mask.push(Array(nw).fill(false)); cells.push(Array(nw).fill(null)); }
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const [nx, ny] = map(x, y);
    mask[ny][nx] = b.mask[y][x];
    const c = b.cells[y][x];
    if (c) c.slide = null;
    cells[ny][nx] = c;
  }
  S.board = { ...b, w: nw, h: nh, mask, cells };
}

function rotateBoard(cw) {
  const { w, h } = S.board, oldCs = cs;
  transformBoard(cw ? (x, y) => [h - 1 - y, x] : (x, y) => [y, w - 1 - x], h, w);
  layout();
  boardAnim = { type: 'rotate', from: cw ? -Math.PI / 2 : Math.PI / 2, scale: oldCs / cs, t0: now, dur: 700 };
  hlCache.key = '';
}

function flipBoard(axis) {
  const { w, h } = S.board;
  transformBoard(axis === 'x' ? (x, y) => [w - 1 - x, y] : (x, y) => [x, h - 1 - y], w, h);
  boardAnim = { type: 'flip', axis, t0: now, dur: 650 };
  hlCache.key = '';
}

function reshapeBoard(shape) {
  const old = S.board, nb = makeBoard(shape);
  const ox = Math.floor((nb.w - old.w) / 2), oy = Math.floor((nb.h - old.h) / 2);
  let lost = 0;
  for (let y = 0; y < old.h; y++) for (let x = 0; x < old.w; x++) {
    const c = old.cells[y][x];
    if (!c) continue;
    const nx = x + ox, ny = y + oy;
    if (nx >= 0 && ny >= 0 && nx < nb.w && ny < nb.h && nb.mask[ny][nx]) { c.slide = null; nb.cells[ny][nx] = c; }
    else { dropOff(x, y); lost++; }
  }
  S.board = nb;
  layout();
  boardAnim = { type: 'reshape', t0: now, dur: 750 };
  hlCache.key = '';
  return lost;
}

// ---------- Đột biến ----------
const MUTS = {
  quake: {
    name: 'ĐỘNG ĐẤT', icon: '🌋', lv: 1, desc: 'Bàn rung lắc — vài khối rơi rụng, số khác bị xô lệch',
    run() {
      shake = 28; sfx.quake();
      const filled = shuffle(listCells(c => c && c.type !== 'lock'));
      const n = clamp(Math.round(filled.length * 0.12), filled.length ? 1 : 0, 5);
      for (let i = 0; i < n; i++) dropOff(...filled[i]);
      let moved = 0;
      for (let i = n; i < filled.length; i++) {
        const [x, y] = filled[i], d = pick(DIRS).d;
        if (S.board.cells[y][x] && rand() < 0.4 && isFree(x + d[0], y + d[1])) { moveCell(x, y, x + d[0], y + d[1]); moved++; }
      }
      return `${n} khối rơi · ${moved} khối bị xô lệch`;
    },
  },
  rotate: {
    name: 'XOAY BÀN', icon: '🔄', lv: 1, desc: 'Cả bàn chơi xoay 90°',
    run() { const cw = rand() < 0.5; rotateBoard(cw); sfx.whoosh(); return cw ? 'Theo chiều kim đồng hồ ↻' : 'Ngược chiều kim đồng hồ ↺'; },
  },
  flip: {
    name: 'LẬT GƯƠNG', icon: '🪞', lv: 1, desc: 'Bàn chơi bị lật như soi gương',
    run() { const axis = rand() < 0.5 ? 'x' : 'y'; flipBoard(axis); sfx.whoosh(); return axis === 'x' ? 'Lật trái ⇄ phải' : 'Lật trên ⇅ dưới'; },
  },
  reshape: {
    name: 'ĐỔI SƠ ĐỒ', icon: '🧩', lv: 1, desc: 'Bàn chơi biến hình — khối nằm ngoài sẽ rơi mất',
    run() {
      const shape = pick(SHAPES.filter(s => s.id !== S.board.shape.id));
      const lost = reshapeBoard(shape);
      sfx.whoosh();
      return `${shape.name}${lost ? ` · mất ${lost} khối` : ''}`;
    },
  },
  trayspin: {
    name: 'XOAY KHAY', icon: '🌀', lv: 1, desc: 'Các khối trong khay bị xoay ngẫu nhiên',
    run() { S.tray.filter(p => !p.used).forEach(p => rotatePiece(p, 1 + rnd(3))); sfx.rotate(); },
  },
  junk: {
    name: 'MƯA RÁC', icon: '🗑️', lv: 1, desc: 'Khối rác rơi xuống các ô trống',
    run() {
      const empty = shuffle(listCells(c => !c)), k = Math.min(empty.length, 3 + Math.floor(S.level / 2), 8);
      for (let i = 0; i < k; i++) { const [x, y] = empty[i]; S.board.cells[y][x] = { type: 'junk', born: now + i * 70 }; }
      shake = 6;
      return `${k} khối rác`;
    },
  },
  gravity: {
    name: 'TRỌNG LỰC', icon: '🧲', lv: 2, desc: 'Mọi khối trượt dồn hết về một phía',
    run() { const dir = pick(DIRS); slideAll(dir.d[0], dir.d[1], 99); shake = 10; sfx.whoosh(); return `Dồn về phía ${dir.name} ${dir.arrow}`; },
  },
  bomb: {
    name: 'BOM HẸN GIỜ', icon: '💣', lv: 2, desc: 'Xóa hàng/cột chứa bom trước khi nó nổ thành đá!',
    run() {
      const timer = Math.max(4, 8 - Math.floor(S.level / 2)), count = S.level >= 6 ? 2 : 1;
      let spots = shuffle(listCells(c => !c));
      if (spots.length < count) spots = spots.concat(shuffle(listCells(c => c && c.type === 'block')));
      spots.slice(0, count).forEach(([x, y]) => { S.board.cells[y][x] = { type: 'bomb', timer, born: now }; });
      return `${count} quả bom · nổ sau ${timer} lượt`;
    },
  },
  stone: {
    name: 'HÓA ĐÁ', icon: '🗿', lv: 2, desc: 'Khối đá phải bị xóa 2 lần mới biến mất',
    run() {
      const k = Math.min(6, 3 + Math.floor(S.level / 3));
      const spots = shuffle(listCells(c => c && (c.type === 'block' || c.type === 'junk'))).concat(shuffle(listCells(c => !c))).slice(0, k);
      spots.forEach(([x, y]) => { S.board.cells[y][x] = { type: 'stone', hp: 2, born: now }; });
      return `${spots.length} khối hóa đá`;
    },
  },
  lock: {
    name: 'KHÓA Ô', icon: '🔒', lv: 2, desc: 'Ô bị khóa không đặt được và chặn luôn cả hàng',
    run() {
      const k = Math.min(6, 3 + Math.floor(S.level / 3)), spots = shuffle(listCells(c => !c)).slice(0, k);
      spots.forEach(([x, y]) => { S.board.cells[y][x] = { type: 'lock', timer: 4, born: now }; });
      return `${spots.length} ô bị khóa trong 4 lượt`;
    },
  },
  mirror: {
    name: 'ĐIỀU KHIỂN NGƯỢC', icon: '🙃', lv: 3, desc: `${EFFECT_MOVES} lượt: kéo sang trái thì khối chạy sang phải!`,
    run() { S.effects.mirror = EFFECT_MOVES; },
  },
  fog: {
    name: 'SƯƠNG MÙ', icon: '🌫️', lv: 3, desc: `${EFFECT_MOVES} lượt: chỉ nhìn thấy quanh khối đang kéo`,
    run() { S.effects.fog = EFFECT_MOVES; },
  },
  blind: {
    name: 'KHAY MÙ', icon: '🙈', lv: 3, desc: `${EFFECT_MOVES} lượt: không thấy hình khối trong khay`,
    run() { S.effects.blind = EFFECT_MOVES; },
  },
  wind: {
    name: 'GIÓ LỐC', icon: '🌪️', lv: 4, desc: `${EFFECT_MOVES} lượt: mỗi lần đặt, mọi khối bị thổi 1 ô`,
    run() { S.effects.wind = EFFECT_MOVES; S.windDir = pick(DIRS); return `Gió thổi về phía ${S.windDir.name} ${S.windDir.arrow}`; },
  },
  swap: {
    name: 'ĐÁNH TRÁO', icon: '🎭', lv: 4, desc: 'Khay bị thay bằng các khối khó hơn',
    run() { S.tray = S.tray.map(p => (p.used ? p : makePiece(1))); sfx.rotate(); },
  },
};

// ---------- Hiệu ứng hình ảnh ----------
function spawnSparks(x, y, color, n, power = 1) {
  const px = bx + (x + 0.5) * cs, py = by + (y + 0.5) * cs;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (80 + Math.random() * 260) * power;
    particles.push({ kind: 'spark', color, x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, s: 3 + Math.random() * cs * 0.15, life: 1, ttl: 0.5 + Math.random() * 0.4 });
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
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

// ---------- HUD ----------
function refresh() {
  if (!S) return;
  S.tray.forEach(p => { if (!p.used) p.fits = anyFit(p); });
  if (S.score > S.best && !S.over) { S.best = S.score; store.set('bc_best', S.best); }

  $('best').textContent = S.best;
  setVal('level', S.level);
  setVal('tokens', S.tokens);
  setVal('hints', S.hints);
  $('levelBar').style.width = ((S.lines % LINES_PER_LEVEL) / LINES_PER_LEVEL) * 100 + '%';

  const m = MUTS[S.nextMut], hidden = S.level >= 7, next = $('next');
  next.innerHTML = `<span class="ico">${hidden ? '❓' : m.icon}</span>Đột biến kế: <b>${hidden ? '???' : m.name}</b>` +
    `<span class="cnt">${S.mutIn <= 1 ? 'LƯỢT SAU!' : `sau ${S.mutIn} lượt`}</span>`;
  next.classList.toggle('urgent', S.mutIn <= 1);

  const chips = [];
  if (S.effects.mirror) chips.push(`🙃 Ngược ×${S.effects.mirror}`);
  if (S.effects.fog) chips.push(`🌫️ Sương mù ×${S.effects.fog}`);
  if (S.effects.blind) chips.push(`🙈 Khay mù ×${S.effects.blind}`);
  if (S.effects.wind) chips.push(`🌪️ Gió ${S.windDir.arrow} ×${S.effects.wind}`);
  const bombs = listCells(c => c && c.type === 'bomb').map(([x, y]) => S.board.cells[y][x].timer);
  if (bombs.length) chips.push(`💣 nổ sau ${Math.min(...bombs)}`);
  if (S.combo >= 2) chips.push(`<span class="chip good">🔥 Combo ×${S.combo}</span>`);
  $('effects').innerHTML = chips.map(c => (c.startsWith('<') ? c : `<span class="chip bad">${c}</span>`)).join('');
}

function setVal(id, v) {
  const el = $(id);
  if (el.textContent === String(v)) return;
  el.textContent = v;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

// ---------- Vẽ ----------
function resize() {
  const r = cv.parentElement.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  W = r.width; H = r.height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function layout() {
  const b = S.board;
  trayH = clamp(H * 0.25, 100, 180);
  const areaH = H - trayH;
  cs = Math.max(12, Math.floor(Math.min((W - 16) / b.w, (areaH - 16) / b.h, 58)));
  bx = Math.round((W - b.w * cs) / 2);
  by = Math.round((areaH - b.h * cs) / 2);
  trayY = areaH;
  traySc = Math.max(10, Math.min(cs * 0.62, (W / 3 - 18) / 5, (trayH - 20) / 5));
}

function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

function drawBlock(x, y, s, color) {
  const g = Math.max(1, s * 0.05), w = s - 2 * g, r = s * 0.2;
  x += g; y += g;
  ctx.fillStyle = shade(color, -0.38); rr(x, y, w, w, r); ctx.fill();
  ctx.fillStyle = color; rr(x, y, w, w * 0.88, r); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(x + w * 0.14, y + w * 0.09, w * 0.72, w * 0.2, r * 0.6); ctx.fill();
}

function drawCellType(c, x, y, s) {
  switch (c.type) {
    case 'block': drawBlock(x, y, s, c.color); break;
    case 'junk':
      drawBlock(x, y, s, JUNK_COLOR);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      circle(x + s * 0.34, y + s * 0.4, s * 0.07); ctx.fill();
      circle(x + s * 0.63, y + s * 0.55, s * 0.09); ctx.fill();
      circle(x + s * 0.4, y + s * 0.66, s * 0.05); ctx.fill();
      break;
    case 'stone': {
      drawBlock(x, y, s, STONE_COLOR);
      ctx.fillStyle = 'rgba(40,44,60,0.55)';
      for (const [u, v] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.7], [0.75, 0.7]]) { circle(x + s * u, y + s * v, s * 0.055); ctx.fill(); }
      if (c.hp === 1) {
        ctx.strokeStyle = 'rgba(25,25,35,0.85)'; ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.3, y + s * 0.1); ctx.lineTo(x + s * 0.48, y + s * 0.38);
        ctx.lineTo(x + s * 0.38, y + s * 0.55); ctx.lineTo(x + s * 0.62, y + s * 0.88);
        ctx.moveTo(x + s * 0.48, y + s * 0.38); ctx.lineTo(x + s * 0.78, y + s * 0.42);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(1, s * 0.05);
        rr(x + s * 0.14, y + s * 0.14, s * 0.72, s * 0.62, s * 0.1); ctx.stroke();
      }
      break;
    }
    case 'bomb': {
      const g = s * 0.05, pulse = c.timer <= 2 ? 0.5 + 0.5 * Math.sin(now / 80) : 0;
      ctx.fillStyle = BOMB_COLOR; rr(x + g, y + g, s - 2 * g, s - 2 * g, s * 0.2); ctx.fill();
      if (pulse) { ctx.fillStyle = `rgba(255,77,109,${0.35 * pulse})`; rr(x + g, y + g, s - 2 * g, s - 2 * g, s * 0.2); ctx.fill(); }
      ctx.fillStyle = `rgb(${190 + 65 * pulse | 0},35,55)`; circle(x + s / 2, y + s * 0.56, s * 0.3); ctx.fill();
      ctx.strokeStyle = '#d0d0d8'; ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath(); ctx.moveTo(x + s * 0.63, y + s * 0.32); ctx.lineTo(x + s * 0.76, y + s * 0.16); ctx.stroke();
      ctx.fillStyle = Math.random() < 0.5 ? '#ffd166' : '#ff9f1c'; circle(x + s * 0.78, y + s * 0.14, s * 0.07); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${s * 0.36}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.timer, x + s / 2, y + s * 0.6);
      break;
    }
    case 'lock': {
      const g = s * 0.06;
      ctx.fillStyle = LOCK_COLOR; rr(x + g, y + g, s - 2 * g, s - 2 * g, s * 0.18); ctx.fill();
      ctx.strokeStyle = 'rgba(255,77,109,0.7)'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.stroke();
      const cx = x + s / 2, cy = y + s * 0.55, w = s * 0.36, h = s * 0.26;
      ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.beginPath(); ctx.arc(cx, cy - h * 0.5, w * 0.32, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#ff4d6d'; rr(cx - w / 2, cy - h / 2, w, h, s * 0.05); ctx.fill();
      ctx.fillStyle = '#ffb3c1'; ctx.font = `800 ${s * 0.24}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(c.timer, x + s * 0.8, y + s * 0.8);
      break;
    }
  }
}

function drawCell(c, px, py, alpha) {
  let ox = 0, oy = 0, sc = 1;
  if (c.slide) {
    const p = (now - c.slide.t0) / c.slide.dur;
    if (p >= 1) c.slide = null;
    else { const e = 1 - easeOutCubic(Math.max(0, p)); ox = -c.slide.dx * cs * e; oy = -c.slide.dy * cs * e; }
  }
  if (c.born) {
    const p = (now - c.born) / 280;
    if (p < 0) return;
    if (p >= 1) c.born = 0; else sc = 0.4 + 0.6 * easeOutBack(p);
  }
  const s = cs * sc;
  ctx.globalAlpha = alpha;
  drawCellType(c, px + ox + (cs - s) / 2, py + oy + (cs - s) / 2, s);
  ctx.globalAlpha = 1;
}

function dragGeom() {
  const p = drag.piece;
  let px = drag.px;
  if (S.effects.mirror > 0) px = 2 * (bx + (S.board.w * cs) / 2) - px;
  const lift = drag.type === 'mouse' ? 0 : (p.h * cs) / 2 + cs * 1.1;
  const left = px - (p.w * cs) / 2, top = drag.py - lift - (p.h * cs) / 2;
  const gx = Math.round((left - bx) / cs), gy = Math.round((top - by) / cs);
  return { left, top, gx, gy, ok: canPlace(p, gx, gy), cx: left + (p.w * cs) / 2, cy: top + (p.h * cs) / 2 };
}

// Những ô sẽ được xóa nếu đặt khối ở (gx, gy)
function previewLines(p, gx, gy) {
  const key = `${drag.idx}|${gx}|${gy}|${p.cells.join(';')}|${S.moves}|${S.mutCount}`;
  if (hlCache.key === key) return hlCache.cells;
  const b = S.board, tmp = { type: 'block' };
  for (const [x, y] of p.cells) b.cells[gy + y][gx + x] = tmp;
  const cells = lineCells(findLines());
  for (const [x, y] of p.cells) b.cells[gy + y][gx + x] = null;
  hlCache = { key, cells };
  return cells;
}

function drawBoard() {
  const b = S.board, bw = b.w * cs, bh = b.h * cs;
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  let alpha = S.over ? 0.45 : 1;

  ctx.save();
  ctx.translate(bx + bw / 2 + sx, by + bh / 2 + sy);
  if (boardAnim) {
    const p = clamp((now - boardAnim.t0) / boardAnim.dur, 0, 1);
    if (boardAnim.type === 'rotate') {
      ctx.rotate(boardAnim.from * (1 - easeOutBack(p)));
      const s = lerp(boardAnim.scale, 1, easeOutCubic(p)); ctx.scale(s, s);
    } else if (boardAnim.type === 'flip') {
      const s = lerp(-1, 1, easeInOut(p));
      ctx.scale(boardAnim.axis === 'x' ? s : 1, boardAnim.axis === 'y' ? s : 1);
    } else if (boardAnim.type === 'reshape') {
      const s = lerp(0.3, 1, easeOutBack(p)); ctx.scale(s, s);
      ctx.rotate((1 - easeOutCubic(p)) * 0.5);
      alpha *= Math.min(1, p * 2);
    }
    if (p >= 1) boardAnim = null;
  }
  ctx.translate(-bw / 2, -bh / 2);

  const g = drag && !S.locked && !boardAnim ? dragGeom() : null;
  const fogOn = S.effects.fog > 0 && !S.over;
  const fogR = g ? Math.max(drag.piece.w, drag.piece.h) / 2 + 1.6 : 0;

  // nền viền phát sáng theo hình dạng bàn
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(120,130,255,0.08)';
  eachCell((x, y) => { rr(x * cs - 3, y * cs - 3, cs + 6, cs + 6, cs * 0.3); ctx.fill(); });

  eachCell((x, y, c) => {
    const px = x * cs, py = y * cs;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    rr(px + 2, py + 2, cs - 4, cs - 4, cs * 0.18); ctx.fill();

    let vis = 1;
    if (fogOn) {
      vis = g ? clamp(fogR - Math.hypot(px + cs / 2 - (g.cx - bx), py + cs / 2 - (g.cy - by)) / cs, 0, 1) : 0;
    }
    if (c && vis > 0) drawCell(c, px, py, alpha * vis);
    if (vis < 1) {
      ctx.globalAlpha = alpha * (1 - vis);
      ctx.fillStyle = '#2a2d48';
      rr(px + 1, py + 1, cs - 2, cs - 2, cs * 0.18); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.font = `800 ${cs * 0.4}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', px + cs / 2, py + cs / 2 + 1);
    }
  });
  ctx.globalAlpha = 1;

  // bóng khối đang kéo + gợi ý hàng sẽ xóa
  if (g && g.ok) {
    const p = drag.piece;
    if (!fogOn) {
      ctx.globalAlpha = 0.55;
      for (const [x, y] of previewLines(p, g.gx, g.gy)) { ctx.fillStyle = p.color; rr(x * cs + 2, y * cs + 2, cs - 4, cs - 4, cs * 0.18); ctx.fill(); }
    }
    ctx.globalAlpha = 0.35;
    for (const [x, y] of p.cells) drawBlock((g.gx + x) * cs, (g.gy + y) * cs, cs, p.color);
    ctx.globalAlpha = 1;
  }

  // ô gợi ý (nhấp nháy viền)
  const hp = hint && S.tray[hint.i];
  if (hp && !hp.used && !boardAnim) {
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(now / 160);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, cs * 0.08);
    for (const [x, y] of hp.cells) {
      ctx.fillStyle = hp.color;
      rr((hint.gx + x) * cs + 3, (hint.gy + y) * cs + 3, cs - 6, cs - 6, cs * 0.18); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // hiệu ứng ô đang bị xóa
  clearing = clearing.filter(q => {
    const p = (now - q.t0) / 380;
    if (p >= 1) return false;
    const s = cs * (1 + 0.25 * p) * (1 - easeOutCubic(p) * 0.9);
    ctx.globalAlpha = 1 - p;
    drawBlock(q.x * cs + (cs - s) / 2, q.y * cs + (cs - s) / 2, s, q.color);
    ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - p)})`;
    rr(q.x * cs + (cs - s) / 2, q.y * cs + (cs - s) / 2, s, s, s * 0.2); ctx.fill();
    return true;
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPieceShape(p, s, alpha) {
  ctx.globalAlpha = alpha;
  const ox = (-p.w * s) / 2, oy = (-p.h * s) / 2;
  for (const [x, y] of p.cells) drawBlock(ox + x * s, oy + y * s, s, p.color);
  ctx.globalAlpha = 1;
}

function drawTray() {
  const slotW = W / 3;
  for (let i = 0; i < 3; i++) {
    const cx = slotW * (i + 0.5), cy = trayY + trayH / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    rr(cx - slotW / 2 + 5, trayY + 6, slotW - 10, trayH - 12, 16); ctx.fill();
    if (hint && hint.i === i) {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(now / 160)})`; ctx.lineWidth = 3; ctx.stroke();
    }

    const p = S.tray[i];
    if (!p || p.used || (drag && drag.idx === i)) continue;
    ctx.save();
    ctx.translate(cx, cy);
    if (p.rot) {
      const t = (now - p.rot.t0) / 380;
      if (t >= 1) p.rot = null; else ctx.rotate(p.rot.from * (1 - easeOutBack(t)));
    }
    if (p.born) {
      const t = (now - p.born) / 300;
      if (t >= 1) p.born = 0; else { const s = 0.3 + 0.7 * easeOutBack(t); ctx.scale(s, s); }
    }
    if (S.effects.blind > 0 && !S.over) {
      const s = traySc * 3;
      ctx.fillStyle = '#2a2d48'; rr(-s / 2, -s / 2, s, s, s * 0.2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#8a92b9'; ctx.font = `800 ${s * 0.55}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, s * 0.04);
    } else {
      drawPieceShape(p, traySc, p.fits ? 1 : 0.28);
    }
    ctx.restore();
  }
}

function drawDrag() {
  if (!drag) return;
  const g = dragGeom(), p = drag.piece;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
  ctx.globalAlpha = 0.95;
  for (const [x, y] of p.cells) drawBlock(g.left + x * cs, g.top + y * cs, cs, p.color);
  ctx.restore();
  if (S.effects.mirror > 0) {
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,94,196,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(drag.px, drag.py); ctx.lineTo(g.cx, g.cy); ctx.stroke();
    ctx.restore();
  }
}

function drawParticles(dt) {
  particles = particles.filter(p => {
    p.vy += (p.kind === 'block' ? 1500 : 600) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt / p.ttl;
    if (p.life <= 0 || p.y > H + 80) return false;
    ctx.globalAlpha = clamp(p.life * 1.5, 0, 1);
    if (p.kind === 'block') {
      p.rot += p.vr * dt;
      ctx.save(); ctx.translate(p.x + p.s / 2, p.y + p.s / 2); ctx.rotate(p.rot);
      drawBlock(-p.s / 2, -p.s / 2, p.s, p.color);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    return true;
  });
  ctx.globalAlpha = 1;
}

function drawPopups() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  popups = popups.filter(q => {
    const p = (now - q.t0) / q.dur;
    if (p >= 1) return false;
    const a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    const sc = p < 0.12 ? lerp(0.4, 1.12, p / 0.12) : p < 0.22 ? lerp(1.12, 1, (p - 0.12) / 0.1) : 1;
    ctx.save();
    ctx.translate(clamp(q.x, 60, W - 60), q.y - 46 * easeOutCubic(p));
    ctx.scale(sc, sc);
    ctx.globalAlpha = a;
    ctx.font = `800 ${q.size}px ${FONT}`;
    ctx.lineWidth = Math.max(4, q.size * 0.18); ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,10,22,0.9)'; ctx.strokeText(q.text, 0, 0);
    ctx.fillStyle = q.color; ctx.fillText(q.text, 0, 0);
    ctx.restore();
    return true;
  });
}

let last = performance.now();
function frame(t) {
  now = t;
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  shake *= Math.pow(0.0025, dt);
  if (shake < 0.3) shake = 0;

  if (S) {
    if (shownScore !== S.score) {
      shownScore = shownScore < S.score ? Math.min(S.score, shownScore + Math.ceil((S.score - shownScore) * 0.18)) : S.score;
      $('score').textContent = shownScore;
    }
    layout();
    ctx.clearRect(0, 0, W, H);
    drawBoard();
    drawTray();
    drawParticles(dt);
    drawDrag();
    drawPopups();
  }
  requestAnimationFrame(frame);
}

// ---------- Điều khiển ----------
function pointerPos(e) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

cv.addEventListener('pointerdown', e => {
  if (!S || S.over || S.locked || drag || pending) return;
  Sound.init();
  const { x, y } = pointerPos(e);
  if (y < trayY - 10) return;
  const idx = clamp(Math.floor(x / (W / 3)), 0, 2), p = S.tray[idx];
  if (!p || p.used) return;
  pending = { idx, x, y, id: e.pointerId, type: e.pointerType };
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
});

cv.addEventListener('pointermove', e => {
  const { x, y } = pointerPos(e);
  if (pending && pending.id === e.pointerId) {
    if (Math.hypot(x - pending.x, y - pending.y) > 7 && !S.locked) {
      drag = { idx: pending.idx, piece: S.tray[pending.idx], px: x, py: y, type: pending.type, id: pending.id };
      pending = null;
      sfx.pick();
    }
  } else if (drag && drag.id === e.pointerId) {
    drag.px = x; drag.py = y;
  }
});

cv.addEventListener('pointerup', e => {
  if (drag && drag.id === e.pointerId) {
    const g = dragGeom(), d = drag;
    drag = null;
    if (g.ok && !S.locked && !S.over) placePiece(d.idx, g.gx, g.gy);
    else if (g.gx > -3 && g.gy > -3 && g.gx < S.board.w && g.gy < S.board.h) sfx.bad();
  } else if (pending && pending.id === e.pointerId) {
    const idx = pending.idx;
    pending = null;
    tapRotate(idx);
  }
});

cv.addEventListener('pointercancel', () => { drag = null; pending = null; });

function tapRotate(idx) {
  if (!S || S.over || S.locked) return;
  const p = S.tray[idx];
  if (!p || p.used) return;
  if (S.tokens <= 0) {
    sfx.bad();
    addPopup('Hết lượt xoay!', '#ff4d6d', 20, (W / 3) * (idx + 0.5), trayY + 12);
    return;
  }
  S.tokens--;
  rotatePiece(p, 1);
  hint = null;
  sfx.rotate();
  refresh();
  checkGameOver();
}

// Gợi ý: chỉ ra một nước đi mà sau đó vẫn chắc chắn đặt được hết khay
function useHint() {
  if (!S || S.over || S.locked) return;
  if (S.hints <= 0) { sfx.bad(); addPopup('Hết gợi ý!', '#ff4d6d', 20, W / 2, trayY - 8); return; }
  const r = trayPath(80000);
  if (!r.path) {
    addPopup(r.aborted ? 'Thế cờ khó quá, chưa tìm ra 😅' : 'Hết đường thoát rồi 😵', '#ff8fa3', 20, W / 2, trayY - 8, 2000);
    return;
  }
  S.hints--;
  hint = r.path[0];
  sfx.rotate();
  refresh();
}

window.addEventListener('keydown', e => {
  if ((e.key === 'r' || e.key === 'R') && drag && S && S.tokens > 0) {
    S.tokens--;
    hint = null;
    rotatePiece(drag.piece, 1);
    drag.piece.rot = null;
    sfx.rotate();
    refresh();
  }
});

// ---------- Vòng đời ván chơi ----------
function newGame() {
  S = {
    id: ++gameSeq,
    board: makeBoard(SHAPES[0]),
    tray: [],
    score: 0, best: store.get('bc_best', 0), newBest: false,
    level: 1, lines: 0, moves: 0, combo: 0, comboMiss: 0, tokens: 2, hints: 3,
    effects: { mirror: 0, fog: 0, blind: 0, wind: 0 }, windDir: DIRS[3],
    nextMut: null, lastMut: null, mutIn: 10 + rnd(6), mutCount: 0,
    locked: false, over: false, revives: 0,
  };
  shownScore = 0; $('score').textContent = '0';
  particles = []; popups = []; clearing = []; boardAnim = null; drag = pending = null; shake = 0; hint = null;
  layout();
  refillTray();
  S.nextMut = pickMutation();
  refresh();
}

function showOver() {
  $('overlay').hidden = false;
  $('startCard').hidden = true;
  $('overCard').hidden = false;
  $('finalScore').textContent = S.score;
  $('newBest').hidden = !S.newBest;
  $('stLevel').textContent = S.level;
  $('stLines').textContent = S.lines;
  $('stMuts').textContent = S.mutCount;
  $('stMoves').textContent = S.moves;
}

function start() {
  Sound.init();
  $('overlay').hidden = true;
  newGame();
}

// Hồi sinh: dọn chướng ngại rồi xóa dần các hàng/cột đầy nhất cho tới khi khay mới chắc chắn còn đường đi
function revive() {
  const b = S.board;
  S.over = false;
  S.locked = false;
  S.revives++;
  eachCell((x, y, c) => { if (c && c.type !== 'block') { b.cells[y][x] = null; spawnSparks(x, y, colorOf(c), 4); } });
  S.effects = { mirror: 0, fog: 0, blind: 0, wind: 0 };
  for (let k = 0; k < 40; k++) {
    refillTray();
    if (listCells(c => !c).length >= 16 && trayPath(4000, true).path) break;
    clearFullestLine();
  }
  S.mutIn = Math.max(S.mutIn, 3);
  $('overlay').hidden = true;
  shake = 10;
  sfx.level();
  addPopup('HỒI SINH!', '#06d6a0', 40, W / 2, by + (b.h * cs) / 2);
  refresh();
}

function clearFullestLine() {
  const b = S.board;
  let best = null, bestN = 0;
  for (let y = 0; y < b.h; y++) {
    const n = b.cells[y].filter(Boolean).length;
    if (n > bestN) { bestN = n; best = Array.from({ length: b.w }, (_, x) => [x, y]); }
  }
  for (let x = 0; x < b.w; x++) {
    const n = b.cells.filter(r => r[x]).length;
    if (n > bestN) { bestN = n; best = Array.from({ length: b.h }, (_, y) => [x, y]); }
  }
  for (const [x, y] of best || []) {
    const c = b.cells[y][x];
    if (!c) continue;
    b.cells[y][x] = null;
    clearing.push({ x, y, color: colorOf(c), t0: now });
  }
}

Revive.mount($('revive'), revive);

$('hintBtn').addEventListener('click', useHint);
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
  store.set('bc_muted', Sound.muted);
  muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
  Sound.init();
});

$('mutList').innerHTML = Object.values(MUTS).map(m => `<span>${m.icon} ${m.name}</span>`).join('');

new ResizeObserver(resize).observe(cv.parentElement);
resize();
newGame();          // ván "nền" phía sau màn hình bắt đầu
requestAnimationFrame(frame);
