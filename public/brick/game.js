'use strict';

/* ============================================================
   GẠCH BIẾN DỊ — phá gạch, nhưng gạch không chịu đứng yên
   ============================================================ */

// ---------- Cấu hình ----------
const FW = 400, FH = 640;                      // sân chơi logic, tự co giãn theo màn hình
const SIDE = 8, TOP = 60, COLS = 10;
const BW = (FW - SIDE * 2) / COLS, BH = 18, ROW_H = BH + 4;
const PADDLE_Y = 592, PADDLE_H = 12, PADDLE_W = 86, PADDLE_MIN = 30;
const BALL_R = 6;
const DANGER_Y = PADDLE_Y - 48;                // gạch chạm vạch này là mất mạng
const MAX_BALLS = 8;
const EFFECT_TIME = 10;
const FONT = '"Baloo 2", system-ui, sans-serif';
const HP_COLORS = ['#4cc9f0', '#06d6a0', '#ffb703', '#f77f00', '#ff4d6d', '#ff5ec4'];

const GDIRS = [
  { gx: 0, gy: 340, name: 'dưới', arrow: '⬇' },
  { gx: -320, gy: 0, name: 'trái', arrow: '⬅' },
  { gx: 320, gy: 0, name: 'phải', arrow: '➡' },
  { gx: 0, gy: -280, name: 'trên', arrow: '⬆' },
];

const DROPS = {
  expand: { label: 'W', color: '#06d6a0' },
  multi: { label: '×3', color: '#4cc9f0' },
  slow: { label: 'S', color: '#ffb703' },
  life: { label: '♥', color: '#ff4d6d' },
};

// Hình xếp gạch cho từng màn (c: cột, r: hàng, R: tổng số hàng)
const PATTERNS = [
  () => true,
  (c, r) => (c + r) % 2 === 0 || r === 0,
  (c, r) => Math.abs(c - 4.5) <= r * 0.7 + 0.6,
  (c, r) => r % 2 === 0 || c % 3 === 0,
  (c, r, R) => Math.abs(c - 4.5) + Math.abs(r - (R - 1) / 2) * 1.3 <= 5.2,
  () => Math.random() < 0.72,
  c => c !== 4 && c !== 5,
];

// ---------- Tiện ích ----------
const $ = id => document.getElementById(id);
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
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
  paddle: () => Sound.tone(260, 0.06, 'square', 0.05, 200),
  wall: () => Sound.tone(180, 0.03, 'triangle', 0.03),
  hit: () => Sound.tone(520, 0.05, 'square', 0.04),
  steel: () => Sound.tone(1400, 0.05, 'square', 0.03, 900),
  brk(combo) { Sound.tone(600 * Math.pow(2, Math.min(combo, 12) / 12), 0.09, 'triangle', 0.07, 1200); },
  shoot: () => Sound.tone(900, 0.08, 'sawtooth', 0.025, 300),
  hurt: () => Sound.tone(160, 0.25, 'sawtooth', 0.08, 60),
  power() { [0, 4, 7, 12].forEach((s, i) => Sound.tone(660 * Math.pow(2, s / 12), 0.1, 'triangle', 0.06, null, i * 0.05)); },
  alarm() { Sound.tone(880, 0.16, 'sawtooth', 0.05, 440); Sound.tone(880, 0.16, 'sawtooth', 0.05, 440, 0.19); },
  boom() { Sound.noise(0.5, 0.35, 700); Sound.tone(110, 0.4, 'sine', 0.25, 35); },
  lose() { [0, -4, -8].forEach((s, i) => Sound.tone(330 * Math.pow(2, s / 12), 0.22, 'triangle', 0.09, null, i * 0.15)); },
  level() { [0, 4, 7, 12, 16].forEach((s, i) => Sound.tone(523 * Math.pow(2, s / 12), 0.15, 'square', 0.05, null, i * 0.08)); },
  over() { [0, -3, -7, -12].forEach((s, i) => Sound.tone(330 * Math.pow(2, s / 12), 0.3, 'triangle', 0.1, null, i * 0.2)); },
};

// ---------- Trạng thái ----------
const cv = $('cv');
const ctx = cv.getContext('2d');
let S = null, gameSeq = 0;
let W = 0, H = 0, DPR = 1, sc = 1, ox = 0, oy = 0;
let shake = 0, particles = [], popups = [];
let keys = { left: false, right: false };
let hudTimer = 0, shownScore = 0;

function newGame() {
  S = {
    id: ++gameSeq,
    level: 1, score: 0, best: store.get('bk_best', 0), newBest: false,
    lives: 3, revives: 0, broken: 0, time: 0, combo: 0,
    bricks: [], balls: [], drops: [], bullets: [],
    paddle: { x: FW / 2, target: FW / 2, w: PADDLE_W, hurt: 0, stun: 0 },
    fx: { gravity: 0, shrink: 0, reverse: 0, fast: 0, ghost: 0, sway: 0, slow: 0, expand: 0 },
    grav: GDIRS[0], swayV: 60,
    nextMut: null, lastMut: null, mutT: 10, mutCount: 0,
    over: false, paused: false,
  };
  particles = []; popups = []; shake = 0; shownScore = 0;
  buildLevel();
  resetBall();
  S.nextMut = pickMut();
  refresh();
}

// ---------- Gạch ----------
function makeBrick(x, y, w, hp, type) {
  return { x, y, ty: y, w, h: BH, hp, max: hp, type, vx: 0, fire: 1.5 + Math.random() * 2.5, flash: 0, born: performance.now(), dead: false };
}

function buildLevel() {
  const L = S.level, rows = Math.min(4 + L, 10), pattern = pick(PATTERNS);
  S.bricks = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    if (!pattern(c, r, rows)) continue;
    const hp = 1 + rnd(Math.min(4, 1 + Math.floor(L / 2)));
    const roll = Math.random();
    let type = 'normal';
    if (L >= 2 && roll < 0.05) type = 'steel';
    else if (roll < 0.11) type = 'bomb';
    else if (roll < 0.17 + 0.02 * L) type = 'split';
    else if (L >= 2 && roll < 0.2 + 0.03 * L) type = 'shooter';
    const k = makeBrick(SIDE + c * BW + 1, TOP + r * ROW_H, BW - 2, type === 'steel' ? 1 : hp, type);
    if (L >= 3 && Math.random() < 0.06) k.vx = (Math.random() < 0.5 ? -1 : 1) * (40 + L * 4);
    S.bricks.push(k);
  }
  if (!S.bricks.some(k => k.type !== 'steel')) buildLevel();
}

const overlaps = (x, y, w, h, o) => x < o.x + o.w && x + w > o.x && y < o.ty + o.h && y + h > o.ty;

function damage(k) {
  if (k.dead) return;
  k.flash = 0.12;
  if (k.type === 'steel') { sfx.steel(); return; }
  if (--k.hp > 0) { sfx.hit(); return; }
  k.dead = true;
  S.combo++;
  S.broken++;
  S.score += 10 * k.max * S.level + (S.combo > 1 ? 5 * S.combo : 0);
  if (S.combo >= 6 && S.combo % 3 === 0) addPopup(`COMBO ×${S.combo}`, '#ff5ec4', 20, k.x + k.w / 2, k.y);
  sfx.brk(S.combo);
  burst(k.x + k.w / 2, k.y + k.h / 2, brickColor(k), 10);
  if (k.type === 'split' && k.w > BW / 2) {
    // tách đôi thành 2 nửa chạy ngược chiều nhau
    const hw = k.w / 2 - 1, sp = 70 + S.level * 6;
    for (const [x, vx] of [[k.x, -sp], [k.x + hw + 2, sp]]) {
      const h = makeBrick(x, k.y, hw, 1, 'half');
      h.ty = k.ty; h.vx = vx;
      S.bricks.push(h);
    }
  }
  if (k.type === 'bomb') explode(k);
  if (Math.random() < 0.11) {
    const type = Math.random() < 0.08 ? 'life' : pick(['expand', 'multi', 'slow']);
    S.drops.push({ x: k.x + k.w / 2, y: k.y + k.h / 2, type });
  }
}

function explode(k) {
  sfx.boom();
  shake = Math.max(shake, 10);
  burst(k.x + k.w / 2, k.y + k.h / 2, '#ff9f1c', 24, 1.6);
  const cx = k.x + k.w / 2, cy = k.ty + k.h / 2;
  for (const o of S.bricks) {
    if (o.dead || o.type === 'steel') continue;
    if (Math.abs(o.x + o.w / 2 - cx) < BW * 1.6 && Math.abs(o.ty + o.h / 2 - cy) < ROW_H * 1.6) { o.hp = 1; damage(o); }
  }
}

function moveBricks(dt) {
  for (const k of S.bricks) {
    if (k.flash > 0) k.flash -= dt;
    k.y += (k.ty - k.y) * Math.min(1, dt * 7);
    if (k.flip) {
      k.flip.t += dt / 0.55;
      k.x = lerp(k.flip.from, k.flip.to, easeOutCubic(Math.min(1, k.flip.t)));
      if (k.flip.t >= 1) k.flip = null;
      continue;
    }
    if (k.vx) {
      const nx = k.x + k.vx * dt;
      if (nx < SIDE || nx + k.w > FW - SIDE || S.bricks.some(o => o !== k && !o.dead && overlaps(nx, k.ty, k.w, k.h, o))) k.vx = -k.vx;
      else k.x = nx;
    }
  }
  if (S.fx.sway > 0 && S.bricks.length) {
    let dx = S.swayV * dt;
    const minX = Math.min(...S.bricks.map(k => k.x)), maxX = Math.max(...S.bricks.map(k => k.x + k.w));
    if (minX + dx < SIDE || maxX + dx > FW - SIDE) { S.swayV = -S.swayV; dx = 0; }
    for (const k of S.bricks) if (!k.flip) k.x += dx;
  }
  // gạch pháo bắn trả
  for (const k of S.bricks) {
    if (k.type !== 'shooter' || k.dead || !S.balls.some(b => !b.stuck)) continue;
    k.fire -= dt;
    if (k.fire <= 0) {
      k.fire = Math.max(1.2, 3.2 - S.level * 0.15) + Math.random() * 2;
      S.bullets.push({ x: k.x + k.w / 2, y: k.y + k.h });
      sfx.shoot();
    }
  }
}

// ---------- Bóng & thanh đỡ ----------
function speed() {
  return Math.min(470, 290 + S.level * 14) * (S.fx.fast > 0 ? 1.35 : 1) * (S.fx.slow > 0 ? 0.72 : 1);
}

function paddleWidth() {
  const base = Math.max(PADDLE_MIN + 14, PADDLE_W - S.paddle.hurt * 7);
  return Math.max(PADDLE_MIN, base * (S.fx.shrink > 0 ? 0.55 : 1) * (S.fx.expand > 0 ? 1.45 : 1));
}

function resetBall() {
  S.balls = [{ x: S.paddle.x, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true, trail: [] }];
}

function launch() {
  for (const b of S.balls) {
    if (!b.stuck) continue;
    const a = (Math.random() - 0.5) * 0.7, sp = speed();
    b.vx = sp * Math.sin(a); b.vy = -sp * Math.cos(a); b.stuck = false;
  }
}

// Giữ tốc độ không đổi và không cho bóng bay gần như nằm ngang
function normalize(b, sp) {
  const m = Math.hypot(b.vx, b.vy) || 1;
  b.vx *= sp / m; b.vy *= sp / m;
  const minVy = sp * 0.28;
  if (Math.abs(b.vy) < minVy) {
    b.vy = (b.vy < 0 ? -1 : 1) * minVy;
    b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(sp * sp - minVy * minVy);
  }
}

function stepBall(b, dt) {
  const sp = speed(), p = S.paddle;
  if (S.fx.gravity > 0) { b.vx += S.grav.gx * dt; b.vy += S.grav.gy * dt; }
  normalize(b, sp);
  const steps = Math.max(1, Math.ceil((sp * dt) / (BALL_R * 0.5)));
  for (let i = 0; i < steps; i++) {
    b.x += (b.vx * dt) / steps;
    b.y += (b.vy * dt) / steps;
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); sfx.wall(); }
    if (b.x > FW - BALL_R) { b.x = FW - BALL_R; b.vx = -Math.abs(b.vx); sfx.wall(); }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); sfx.wall(); }
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H && Math.abs(b.x - p.x) <= p.w / 2 + BALL_R) {
      const rel = clamp((b.x - p.x) / (p.w / 2), -1, 1), a = rel * 1.13;   // tối đa ±65°
      b.vx = sp * Math.sin(a); b.vy = -sp * Math.cos(a);
      b.y = PADDLE_Y - BALL_R;
      S.combo = 0;
      sfx.paddle();
      continue;
    }
    if (hitBricks(b)) continue;
    if (b.y > FH + BALL_R * 3) { b.dead = true; return; }
  }
  b.trail.push([b.x, b.y]);
  if (b.trail.length > 7) b.trail.shift();
}

function hitBricks(b) {
  for (const k of S.bricks) {
    if (k.dead) continue;
    const cx = clamp(b.x, k.x, k.x + k.w), cy = clamp(b.y, k.y, k.y + k.h);
    const dx = b.x - cx, dy = b.y - cy;
    if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
    if (dx === 0 && dy === 0) b.vy = -b.vy;
    else if (Math.abs(dx) > Math.abs(dy)) { b.vx = Math.abs(b.vx) * Math.sign(dx); b.x = cx + Math.sign(dx) * BALL_R; }
    else { b.vy = Math.abs(b.vy) * Math.sign(dy); b.y = cy + Math.sign(dy) * BALL_R; }
    damage(k);
    return true;
  }
  return false;
}

function catchDrop(d) {
  sfx.power();
  const p = S.paddle;
  if (d.type === 'expand') { S.fx.expand = 12; p.hurt = Math.max(0, p.hurt - 3); addPopup('RỘNG RA!', '#06d6a0', 20, p.x, PADDLE_Y - 20); }
  if (d.type === 'slow') { S.fx.slow = 8; addPopup('CHẬM LẠI', '#ffb703', 20, p.x, PADDLE_Y - 20); }
  if (d.type === 'life') { S.lives = Math.min(5, S.lives + 1); addPopup('+1 MẠNG', '#ff4d6d', 22, p.x, PADDLE_Y - 20); }
  if (d.type === 'multi') {
    const extra = [];
    for (const b of S.balls) {
      if (b.stuck) continue;
      for (const a of [-0.4, 0.4]) {
        if (S.balls.length + extra.length >= MAX_BALLS) break;
        const c = Math.cos(a), s = Math.sin(a);
        extra.push({ x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, stuck: false, trail: [] });
      }
    }
    S.balls.push(...extra);
    addPopup('NHÂN BÓNG!', '#4cc9f0', 20, p.x, PADDLE_Y - 20);
  }
}

function loseLife(reason) {
  S.lives--;
  S.bullets = []; S.drops = [];
  S.combo = 0;
  shake = 14;
  sfx.lose();
  if (S.lives <= 0) { endGame(reason); return; }
  addPopup(reason === 'bricks' ? 'GẠCH TRÀN XUỐNG!' : 'MẤT BÓNG!', '#ff4d6d', 28, FW / 2, FH / 2);
  resetBall();
}

// ---------- Đột biến ----------
function convert(n, type) {
  const list = shuffle(S.bricks.filter(k => !k.dead && k.type === 'normal')).slice(0, n);
  list.forEach(k => { k.type = type; k.flash = 0.3; if (type === 'shooter') k.fire = 1 + Math.random() * 2; });
  return list.length;
}

const MUTS = {
  gravity: {
    name: 'TRỌNG LỰC LỆCH', icon: '🧲', lv: 1, desc: `${EFFECT_TIME} giây: đường bay của bóng bị bẻ cong`,
    run() { S.grav = pick(GDIRS); S.fx.gravity = EFFECT_TIME; return `Hút về phía ${S.grav.name} ${S.grav.arrow}`; },
  },
  shrink: {
    name: 'THANH ĐỠ CO LẠI', icon: '🤏', lv: 1, desc: '12 giây: thanh đỡ chỉ còn một nửa',
    run() { S.fx.shrink = 12; },
  },
  descend: {
    name: 'GẠCH TIẾN CÔNG', icon: '⏬', lv: 1, desc: 'Cả đàn gạch tụt xuống 2 hàng',
    run() { S.bricks.forEach(k => { k.ty += ROW_H * 2; }); shake = 8; },
  },
  split: {
    name: 'PHÂN BÀO', icon: '🧫', lv: 1, desc: 'Gạch vỡ ra sẽ tách đôi thành 2 gạch chạy',
    run() { return `${convert(5 + S.level, 'split')} gạch phân bào`; },
  },
  movers: {
    name: 'GẠCH CHẠY', icon: '🏃', lv: 1, desc: 'Một số gạch bắt đầu chạy ngang',
    run() {
      const list = shuffle(S.bricks.filter(k => !k.dead && !k.vx)).slice(0, 4 + Math.floor(S.level / 2));
      list.forEach(k => { k.vx = (Math.random() < 0.5 ? -1 : 1) * (50 + S.level * 6); });
      return `${list.length} gạch chạy`;
    },
  },
  fast: {
    name: 'TĂNG TỐC', icon: '⚡', lv: 1, desc: `${EFFECT_TIME} giây: bóng bay nhanh hơn 35%`,
    run() { S.fx.fast = EFFECT_TIME; },
  },
  turret: {
    name: 'PHÁO ĐÀI', icon: '🔫', lv: 2, desc: 'Gạch mọc pháo bắn trả — trúng đạn thanh đỡ ngắn lại',
    run() { return `${convert(2 + Math.floor(S.level / 2), 'shooter')} khẩu pháo`; },
  },
  reverse: {
    name: 'ĐIỀU KHIỂN NGƯỢC', icon: '🙃', lv: 2, desc: '8 giây: kéo sang trái thì thanh đỡ chạy sang phải',
    run() { S.fx.reverse = 8; S.paddle.target = FW - S.paddle.target; },
  },
  regen: {
    name: 'MỌC LẠI', icon: '🌱', lv: 2, desc: 'Gạch mọc lại vào các chỗ trống',
    run() {
      const slots = [];
      for (let r = 0; r < 9; r++) for (let c = 0; c < COLS; c++) {
        const x = SIDE + c * BW + 1, y = TOP + r * ROW_H;
        if (y + BH > DANGER_Y - ROW_H * 3) continue;
        if (!S.bricks.some(o => !o.dead && overlaps(x - 2, y - 2, BW + 2, BH + 4, o))) slots.push([x, y]);
      }
      const list = shuffle(slots).slice(0, 6 + S.level);
      list.forEach(([x, y]) => S.bricks.push(makeBrick(x, y, BW - 2, 1 + rnd(2), 'normal')));
      return `${list.length} gạch mới`;
    },
  },
  mirror: {
    name: 'LẬT GƯƠNG', icon: '🪞', lv: 2, desc: 'Cả sân gạch lật trái ⇄ phải',
    run() { S.bricks.forEach(k => { k.flip = { from: k.x, to: FW - k.x - k.w, t: 0 }; k.vx = -k.vx; }); },
  },
  ghost: {
    name: 'BÓNG MA', icon: '👻', lv: 3, desc: '8 giây: bóng lúc ẩn lúc hiện',
    run() { S.fx.ghost = 8; },
  },
  sway: {
    name: 'ĐỘI HÌNH LẮC', icon: '〰️', lv: 3, desc: '12 giây: cả khối gạch lắc qua lắc lại',
    run() { S.fx.sway = 12; S.swayV = (Math.random() < 0.5 ? -1 : 1) * (55 + S.level * 5); },
  },
  armor: {
    name: 'BỌC THÉP', icon: '🛡️', lv: 3, desc: 'Một số gạch được thêm 2 máu',
    run() {
      const list = shuffle(S.bricks.filter(k => !k.dead && k.type !== 'steel')).slice(0, 5 + S.level);
      list.forEach(k => { k.hp += 2; k.max = Math.max(k.max, k.hp); k.flash = 0.3; });
      return `${list.length} gạch bọc thép`;
    },
  },
};

function pickMut(exclude) {
  const pool = Object.keys(MUTS).filter(k => MUTS[k].lv <= S.level && k !== exclude && k !== S.lastMut);
  return pick(pool);
}

function mutInterval() {
  return Math.max(7, 15 - S.level) + Math.random() * 3;
}

function triggerMutation() {
  const list = [S.nextMut];
  if (S.level >= 4 && Math.random() < Math.min(0.4, (S.level - 3) * 0.1)) list.push(pickMut(S.nextMut));
  list.forEach((id, i) => {
    const m = MUTS[id], detail = m.run() || '';
    S.mutCount++;
    if (i === list.length - 1) showBanner(m, detail, list.length > 1 ? 'ĐỘT BIẾN KÉP · ' + list.map(k => MUTS[k].name).join(' + ') : '');
  });
  sfx.alarm();
  S.lastMut = list[list.length - 1];
  S.nextMut = pickMut(S.lastMut);
  S.mutT = mutInterval();
}

// ---------- Vòng cập nhật ----------
function update(dt) {
  if (!S || S.over || S.paused) return;
  S.time += dt;
  for (const k in S.fx) if (S.fx[k] > 0) S.fx[k] = Math.max(0, S.fx[k] - dt);

  const p = S.paddle;
  const kdir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (kdir) p.target = clamp(p.target + kdir * (S.fx.reverse > 0 ? -1 : 1) * 560 * dt, 0, FW);
  p.w = lerp(p.w, paddleWidth(), 1 - Math.pow(0.0005, dt));
  if (p.stun > 0) p.stun -= dt;
  else p.x = lerp(p.x, p.target, 1 - Math.pow(1e-7, dt));
  p.x = clamp(p.x, p.w / 2, FW - p.w / 2);

  for (const b of S.balls) {
    if (b.stuck) { b.x = p.x; b.y = PADDLE_Y - BALL_R - 1; continue; }
    stepBall(b, dt);
  }
  S.balls = S.balls.filter(b => !b.dead);
  if (!S.balls.length) { loseLife('ball'); if (S.over) return; }

  moveBricks(dt);
  S.bricks = S.bricks.filter(k => !k.dead);

  for (const u of S.bullets) {
    u.y += 240 * dt;
    if (u.y >= PADDLE_Y && u.y <= PADDLE_Y + PADDLE_H + 6 && Math.abs(u.x - p.x) <= p.w / 2 + 3) {
      u.dead = true;
      p.hurt++; p.stun = 0.35; shake = 8;
      sfx.hurt();
      burst(u.x, PADDLE_Y, '#ff4d6d', 8);
      addPopup('TRÚNG ĐẠN!', '#ff4d6d', 18, p.x, PADDLE_Y - 18);
    }
  }
  S.bullets = S.bullets.filter(u => !u.dead && u.y < FH + 10);

  for (const d of S.drops) {
    d.y += 150 * dt;
    if (d.y + 8 >= PADDLE_Y && d.y - 8 <= PADDLE_Y + PADDLE_H && Math.abs(d.x - p.x) <= p.w / 2 + 12) { d.dead = true; catchDrop(d); }
  }
  S.drops = S.drops.filter(d => !d.dead && d.y < FH + 20);

  // gạch tràn xuống vạch đỏ
  if (S.bricks.some(k => k.y + k.h > DANGER_Y)) {
    S.bricks.forEach(k => { if (k.ty + k.h > DANGER_Y - ROW_H * 2) { k.dead = true; burst(k.x + k.w / 2, k.y + k.h / 2, brickColor(k), 6); } });
    S.bricks = S.bricks.filter(k => !k.dead);
    loseLife('bricks');
    if (S.over) return;
  }

  if (!S.bricks.some(k => k.type !== 'steel')) { nextLevel(); return; }

  if (S.balls.some(b => !b.stuck)) {
    S.mutT -= dt;
    if (S.mutT <= 0) triggerMutation();
  }
}

function nextLevel() {
  const bonus = 300 * S.level;
  S.score += bonus;
  S.level++;
  sfx.level();
  for (const k in S.fx) S.fx[k] = 0;
  S.bullets = []; S.drops = [];
  S.paddle.hurt = Math.max(0, S.paddle.hurt - 2);
  buildLevel();
  resetBall();
  S.mutT = mutInterval();
  S.nextMut = pickMut(S.lastMut);
  addPopup(`MÀN ${S.level}!`, '#4cc9f0', 40, FW / 2, FH / 2 - 20);
  addPopup(`+${bonus}`, '#ffffff', 26, FW / 2, FH / 2 + 22);
  const unlocked = Object.values(MUTS).filter(m => m.lv === S.level).map(m => m.name);
  if (unlocked.length) addPopup('Mở khóa: ' + unlocked.join(', '), '#ff8fa3', 15, FW / 2, FH / 2 + 60, 2600);
}

function endGame(reason) {
  S.over = true;
  if (S.score > S.best) { S.best = S.score; S.newBest = true; store.set('bk_best', S.best); }
  sfx.over();
  refresh();
  const gid = S.id;
  setTimeout(() => {
    if (S.id !== gid || !S.over) return;
    $('overReason').textContent = reason === 'bricks' ? 'Gạch đã tràn xuống thanh đỡ.' : 'Hết mạng rồi.';
    $('finalScore').textContent = S.score;
    $('newBest').hidden = !S.newBest;
    $('stLevel').textContent = S.level;
    $('stBricks').textContent = S.broken;
    $('stMuts').textContent = S.mutCount;
    $('stTime').textContent = Math.round(S.time);
    showCard('overCard');
  }, 1000);
}

// Hồi sinh: 3 mạng mới, dọn các hàng gạch sát thanh đỡ, xóa mọi hiệu ứng xấu
function revive() {
  S.over = false;
  S.revives++;
  S.lives = 3;
  S.paddle.hurt = 0;
  for (const k in S.fx) S.fx[k] = 0;
  S.bullets = []; S.drops = [];
  S.bricks.forEach(k => { if (k.ty + k.h > DANGER_Y - ROW_H * 4) { k.dead = true; burst(k.x + k.w / 2, k.y + k.h / 2, brickColor(k), 6); } });
  S.bricks = S.bricks.filter(k => !k.dead);
  if (!S.bricks.some(k => k.type !== 'steel')) buildLevel();
  resetBall();
  S.mutT = Math.max(S.mutT, 8);
  hideOverlay();
  sfx.level();
  addPopup('HỒI SINH!', '#06d6a0', 42, FW / 2, FH / 2);
  refresh();
}

// ---------- Hiệu ứng ----------
function burst(x, y, color, n, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 200) * power;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, s: 2 + Math.random() * 4, color, life: 1, ttl: 0.4 + Math.random() * 0.4 });
  }
}

function addPopup(text, color, size, x, y, dur = 1300) {
  popups.push({ text, color, size, x, y, t0: performance.now(), dur });
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
  if (S.score > S.best && !S.over) { S.best = S.score; store.set('bk_best', S.best); }
  $('best').textContent = S.best;
  setVal('level', S.level);
  $('lives').textContent = S.lives > 0 ? '♥'.repeat(S.lives) : '—';

  const m = MUTS[S.nextMut], hidden = S.level >= 6, sec = Math.max(0, Math.ceil(S.mutT));
  const frac = clamp(S.mutT / 15, 0, 1), next = $('next');
  next.innerHTML = `<span class="ico">${hidden ? '❓' : m.icon}</span>Đột biến kế: <b>${hidden ? '???' : m.name}</b>` +
    `<div class="bar"><i style="width:${frac * 100}%;background:${sec <= 3 ? 'var(--danger)' : 'var(--accent)'}"></i></div>` +
    `<span class="cnt">${sec}s</span>`;
  next.classList.toggle('urgent', sec <= 3 && S.balls.some(b => !b.stuck));

  const fx = S.fx, chips = [];
  const bad = (on, txt) => { if (on > 0) chips.push(`<span class="chip bad">${txt} ${Math.ceil(on)}s</span>`); };
  const good = (on, txt) => { if (on > 0) chips.push(`<span class="chip good">${txt} ${Math.ceil(on)}s</span>`); };
  bad(fx.gravity, `🧲 Hút ${S.grav.arrow}`);
  bad(fx.shrink, '🤏 Co');
  bad(fx.reverse, '🙃 Ngược');
  bad(fx.fast, '⚡ Nhanh');
  bad(fx.ghost, '👻 Bóng ma');
  bad(fx.sway, '〰️ Lắc');
  good(fx.expand, '↔ Rộng');
  good(fx.slow, '🐢 Chậm');
  if (S.paddle.hurt) chips.push(`<span class="chip bad">🔫 Thanh đỡ -${S.paddle.hurt}</span>`);
  $('effects').innerHTML = chips.join('');
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
  sc = Math.min(W / FW, H / FH);
  ox = (W - FW * sc) / 2; oy = (H - FH * sc) / 2;
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

function brickColor(k) {
  if (k.type === 'steel') return '#8d99ae';
  if (k.type === 'bomb') return '#3a3d5c';
  if (k.type === 'shooter') return '#b5179e';
  return HP_COLORS[Math.min(k.hp, HP_COLORS.length) - 1];
}

function drawBrick(k, t) {
  let x = k.x, y = k.y, w = k.w, h = k.h;
  const age = (t - k.born) / 250;
  if (age < 1) { const s = 0.4 + 0.6 * easeOutCubic(age); x += (w * (1 - s)) / 2; y += (h * (1 - s)) / 2; w *= s; h *= s; }
  const col = brickColor(k);
  ctx.fillStyle = shade(col, -0.4); rr(x, y, w, h, 4); ctx.fill();
  ctx.fillStyle = col; rr(x, y, w, h - 3, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; rr(x + 3, y + 2, w - 6, 3, 1.5); ctx.fill();

  ctx.save();
  if (k.type === 'steel') {
    ctx.fillStyle = 'rgba(30,34,50,0.6)';
    for (const u of [5, w - 5]) { ctx.beginPath(); ctx.arc(x + u, y + h / 2 - 1, 1.8, 0, Math.PI * 2); ctx.fill(); }
  } else if (k.type === 'split') {
    ctx.strokeStyle = 'rgba(20,20,40,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + 2); ctx.lineTo(x + w / 2, y + h - 4); ctx.stroke();
  } else if (k.type === 'bomb') {
    ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2 - 1, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x + w / 2 + 4, y + 3, 1.6 + Math.random(), 0, Math.PI * 2); ctx.fill();
  } else if (k.type === 'shooter') {
    ctx.fillStyle = '#2b2d42'; rr(x + w / 2 - 3, y + h - 3, 6, 6, 1.5); ctx.fill();
    ctx.fillStyle = k.fire < 0.5 ? '#ffd166' : '#ff9fe5';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2 - 1, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (k.vx && k.type !== 'shooter') {
    ctx.fillStyle = 'rgba(20,20,40,0.55)'; ctx.font = `800 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k.vx > 0 ? '›' : '‹', x + (k.vx > 0 ? w - 5 : 5), y + h / 2 - 1);
  }
  if (k.hp >= 3 && k.type !== 'steel') {
    ctx.fillStyle = 'rgba(20,20,40,0.65)'; ctx.font = `800 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k.hp, x + w / 2, y + h / 2);
  }
  if (k.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, k.flash * 6)})`; rr(x, y, w, h, 4); ctx.fill(); }
  ctx.restore();
}

function draw(t) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!S) return;
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.setTransform(DPR * sc, 0, 0, DPR * sc, DPR * (ox + sx), DPR * (oy + sy));

  // sân
  ctx.fillStyle = '#0f1226'; rr(0, 0, FW, FH, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(120,130,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); rr(0, 0, FW, FH, 14); ctx.clip();

  // mũi tên trọng lực trôi trên nền
  if (S.fx.gravity > 0) {
    const g = S.grav, ang = Math.atan2(g.gy, g.gx), off = ((t / 1000) * 60) % 80;
    ctx.globalAlpha = 0.07; ctx.fillStyle = '#ff5ec4'; ctx.font = `800 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = -1; i < 7; i++) for (let j = -1; j < 10; j++) {
      ctx.save();
      ctx.translate(i * 70 + 20 + Math.cos(ang) * off, j * 80 + 20 + Math.sin(ang) * off);
      ctx.rotate(ang);
      ctx.fillText('➜', 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // vạch nguy hiểm
  const lowest = S.bricks.reduce((m, k) => Math.max(m, k.ty + k.h), 0);
  const danger = clamp(1 - (DANGER_Y - lowest) / (ROW_H * 4), 0, 1);
  ctx.strokeStyle = `rgba(255,77,109,${0.18 + 0.6 * danger * (0.6 + 0.4 * Math.sin(t / 120))})`;
  ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(FW, DANGER_Y); ctx.stroke(); ctx.setLineDash([]);

  for (const k of S.bricks) drawBrick(k, t);

  // đạn
  ctx.fillStyle = '#ff5ec4';
  for (const u of S.bullets) { rr(u.x - 2, u.y - 6, 4, 10, 2); ctx.fill(); }

  // vật phẩm rơi
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 12px ${FONT}`;
  for (const d of S.drops) {
    const info = DROPS[d.type];
    ctx.fillStyle = info.color; rr(d.x - 14, d.y - 8, 28, 16, 8); ctx.fill();
    ctx.fillStyle = '#10121f'; ctx.fillText(info.label, d.x, d.y + 1);
  }

  // thanh đỡ
  const p = S.paddle, px = p.x - p.w / 2;
  const grad = ctx.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
  const hurt = p.stun > 0;
  grad.addColorStop(0, hurt ? '#ff8fa3' : S.fx.reverse > 0 ? '#ff9fe5' : '#e8ecff');
  grad.addColorStop(1, hurt ? '#c9184a' : S.fx.reverse > 0 ? '#b5179e' : '#7c86c9');
  ctx.shadowColor = hurt ? '#ff4d6d' : '#4cc9f0'; ctx.shadowBlur = 14;
  ctx.fillStyle = grad; rr(px, PADDLE_Y, p.w, PADDLE_H, 6); ctx.fill();
  ctx.shadowBlur = 0;

  // bóng
  const ghostA = S.fx.ghost > 0 ? (Math.sin(S.time * 7) > 0.35 ? 1 : 0.04) : 1;
  for (const b of S.balls) {
    ctx.globalAlpha = 0.25 * ghostA;
    b.trail.forEach(([x, y], i) => { ctx.fillStyle = '#4cc9f0'; ctx.beginPath(); ctx.arc(x, y, BALL_R * (i / b.trail.length), 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = ghostA;
    ctx.shadowColor = '#4cc9f0'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  if (S.balls.some(b => b.stuck) && !S.over) {
    ctx.fillStyle = `rgba(238,241,255,${0.5 + 0.4 * Math.sin(t / 200)})`; ctx.font = `700 16px ${FONT}`;
    ctx.fillText('Chạm hoặc nhấn Space để phóng bóng', FW / 2, PADDLE_Y - 60);
  }

  // hạt
  for (const q of particles) {
    ctx.globalAlpha = clamp(q.life * 1.5, 0, 1); ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, q.s, q.s);
  }
  ctx.globalAlpha = 1;

  // chữ nổi
  popups = popups.filter(q => {
    const pr = (t - q.t0) / q.dur;
    if (pr >= 1) return false;
    const a = pr < 0.7 ? 1 : 1 - (pr - 0.7) / 0.3, s = pr < 0.12 ? lerp(0.4, 1.1, pr / 0.12) : 1;
    ctx.save();
    ctx.translate(clamp(q.x, 70, FW - 70), q.y - 40 * easeOutCubic(pr));
    ctx.scale(s, s);
    ctx.globalAlpha = a;
    ctx.font = `800 ${q.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(4, q.size * 0.18); ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,10,22,0.9)'; ctx.strokeText(q.text, 0, 0);
    ctx.fillStyle = q.color; ctx.fillText(q.text, 0, 0);
    ctx.restore();
    return true;
  });
  ctx.restore();
}

let last = performance.now();
function frame(t) {
  const dt = Math.min(0.033, (t - last) / 1000);
  last = t;
  update(dt);
  shake *= Math.pow(0.003, dt);
  if (shake < 0.3) shake = 0;
  particles = particles.filter(q => { q.vy += 500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt / q.ttl; return q.life > 0; });
  if (S) {
    if (shownScore !== S.score) {
      shownScore = shownScore < S.score ? Math.min(S.score, shownScore + Math.ceil((S.score - shownScore) * 0.2)) : S.score;
      $('score').textContent = shownScore;
    }
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.2; refresh(); }
  }
  draw(t);
  requestAnimationFrame(frame);
}

// ---------- Điều khiển ----------
function toField(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left - ox) / sc, y: (e.clientY - r.top - oy) / sc };
}

function aim(e) {
  if (!S || S.paused || S.over) return;
  const { x } = toField(e);
  S.paddle.target = clamp(S.fx.reverse > 0 ? FW - x : x, 0, FW);
}

cv.addEventListener('pointermove', aim);
cv.addEventListener('pointerdown', e => {
  Sound.init();
  aim(e);
  if (S && !S.paused && !S.over) launch();
});

window.addEventListener('keydown', e => {
  if (!S) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
  else if (e.key === ' ') { e.preventDefault(); if (!S.paused && !S.over && $('overlay').hidden) { Sound.init(); launch(); } }
  else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.over && !S.paused && $('overlay').hidden) togglePause(); });

function showCard(id) {
  $('overlay').hidden = false;
  for (const c of ['startCard', 'pauseCard', 'overCard']) $(c).hidden = c !== id;
}
function hideOverlay() { $('overlay').hidden = true; }

function togglePause() {
  if (!S || S.over) return;
  if (!$('overlay').hidden && $('pauseCard').hidden) return;   // đang ở màn bắt đầu / thua
  S.paused = !S.paused;
  if (S.paused) showCard('pauseCard'); else hideOverlay();
}

function start() {
  Sound.init();
  hideOverlay();
  newGame();
}

$('startBtn').addEventListener('click', start);
$('againBtn').addEventListener('click', start);
$('restartBtn').addEventListener('click', start);
$('resumeBtn').addEventListener('click', togglePause);
$('pauseBtn').addEventListener('click', togglePause);
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
S.paused = true;
requestAnimationFrame(frame);
