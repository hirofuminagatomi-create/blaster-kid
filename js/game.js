'use strict';
const VW = 320, VH = 192, TILE = 16, SCALE = 3;
const GRAV = 0.25, MAXFALL = 6;
const MAX_HP = 20;

const screen = document.getElementById('screen');
screen.width = VW * SCALE; screen.height = VH * SCALE;
const sctx = screen.getContext('2d');
const buf = document.createElement('canvas');
buf.width = VW; buf.height = VH;
const ctx = buf.getContext('2d');
ctx.imageSmoothingEnabled = false;

// ---------- 入力 ----------
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'jump', Space: 'jump', KeyK: 'jump',
  KeyX: 'shoot', KeyJ: 'shoot',
  Enter: 'start', KeyP: 'start',
};
const keys = {}, pressed = {}, released = {};
addEventListener('keydown', e => {
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (!keys[k]) pressed[k] = true;
  keys[k] = true;
  Sound.init();
});
addEventListener('keyup', e => {
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (keys[k]) released[k] = true;
  keys[k] = false;
});
addEventListener('blur', () => { for (const k in keys) { if (keys[k]) released[k] = true; keys[k] = false; } });

// スマホの画面ボタンから呼ぶ(js/touch.js)
let isTouch = false;
function virtualKey(k, down) {
  isTouch = true;
  Sound.init();
  if (down && !keys[k]) pressed[k] = true;
  if (!down && keys[k]) released[k] = true;
  keys[k] = down;
}

// ---------- 効果音(その場で合成) ----------
const Sound = {
  ac: null,
  init() {
    if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 音なしで続行 */ } }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume();
  },
  tone(f0, f1, dur, type = 'square', vol = 0.06, delay = 0) {
    const ac = this.ac; if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.1) {
    const ac = this.ac; if (!ac) return;
    const n = Math.floor(ac.sampleRate * dur);
    const b = ac.createBuffer(1, n, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(); s.buffer = b;
    const g = ac.createGain(); g.gain.value = vol;
    s.connect(g).connect(ac.destination); s.start();
  },
  play(name) {
    switch (name) {
      case 'shot': this.tone(900, 500, 0.05, 'square', 0.04); break;
      case 'big': this.tone(300, 60, 0.3, 'square', 0.08); this.noise(0.2, 0.06); break;
      case 'jump': this.tone(280, 680, 0.12, 'square', 0.05); break;
      case 'hit': this.tone(220, 90, 0.07, 'square', 0.05); break;
      case 'explode': this.noise(0.3, 0.12); break;
      case 'hurt': this.tone(500, 120, 0.25, 'sawtooth', 0.06); break;
      case 'charge': this.tone(600, 1300, 0.12, 'triangle', 0.05); break;
      case 'box': this.tone(500, 1000, 0.1, 'square', 0.05); break;
      case 'item': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.09, 'square', 0.05, i * 0.07)); break;
      case 'heal': [784, 1047].forEach((f, i) => this.tone(f, f, 0.1, 'triangle', 0.08, i * 0.08)); break;
      case 'check': [659, 880].forEach((f, i) => this.tone(f, f, 0.12, 'square', 0.05, i * 0.1)); break;
      case 'dead': [600, 450, 300, 150].forEach((f, i) => this.tone(f, f * 0.9, 0.15, 'square', 0.06, i * 0.12)); break;
      case 'clear': [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.14, 'square', 0.06, i * 0.13)); break;
      case 'fire': this.noise(0.35, 0.05); break;
      case 'crumble': this.tone(160, 60, 0.15, 'triangle', 0.08); break;
      case 'boss': [196, 185, 175, 165].forEach((f, i) => this.tone(f, f, 0.2, 'sawtooth', 0.06, i * 0.2)); break;
    }
  },
};

// ---------- 武器 ----------
const WEAPONS = {
  normal: { name: 'ノーマル', color: '#fcfc00', cd: 10, max: 4 },
  rapid:  { name: 'れんしゃ', color: '#fc9838', cd: 4, max: 10 },
  spread: { name: '3WAY', color: '#58f898', cd: 14, max: 9 },
  charge: { name: 'チャージ', color: '#3cbcfc', cd: 10, max: 4 },
  heavy:  { name: 'ふとビーム', color: '#f878f8', cd: 24, max: 2 },
  homing: { name: 'ついげき', color: '#d8f818', cd: 16, max: 3 },
};
const WEAPON_IDS = Object.keys(WEAPONS);

// ---------- 状態 ----------
let state = 'title';   // title / play / pause / gameover / clear / allclear
let stageIdx = 0, STG = STAGES[0], levelW = 0, arenaL = 0, stageStartScore = 0;
let traps = [], crumbles = new Map(), trapClock = 0, selStage = 0;
const SAVE_KEY = 'blasterkid.maxStage';
function loadMaxStage() { try { return Math.min(STAGES.length - 1, parseInt(localStorage.getItem(SAVE_KEY) || '0', 10) || 0); } catch (e) { return 0; } }
function saveMaxStage(n) { try { if (n > loadMaxStage()) localStorage.setItem(SAVE_KEY, String(Math.min(n, STAGES.length - 1))); } catch (e) { /* 保存できなくても遊べる */ } }
let maxStage = loadMaxStage();
let map, player, enemies, bullets, items, particles;
let cam = { x: 0 }, shake = 0, frame = 0, stateTimer = 0;
let lives, score, checkpointIdx, currentWeapon = 'normal';
let arenaLocked = false, boss = null, bossDying = 0, deathTimer = 0, banner = null;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ---------- 地形 ----------
function tileAt(tx, ty) {
  if (tx < 0 || tx >= levelW) return T_METAL;
  if (ty < 0 || ty >= LEVEL_H) return T_AIR;
  return map[ty][tx];
}
function solidAt(px, py) { return isSolidTile(tileAt(Math.floor(px / TILE), Math.floor(py / TILE))); }
function rectSolid(x, y, w, h) {
  for (let yy = y; ; yy += 8) {
    const cy = Math.min(yy, y + h - 0.01);
    for (let xx = x; ; xx += 8) {
      const cx = Math.min(xx, x + w - 0.01);
      if (solidAt(cx, cy)) return true;
      if (cx >= x + w - 0.01) break;
    }
    if (cy >= y + h - 0.01) break;
  }
  return false;
}
function moveEntity(e) {
  e.hitWall = false; e.onGround = false; e.hitCeil = false;
  e.x += e.vx;
  if (rectSolid(e.x, e.y, e.w, e.h)) {
    if (e.vx > 0) e.x = Math.floor((e.x + e.w) / TILE) * TILE - e.w;
    else if (e.vx < 0) e.x = (Math.floor(e.x / TILE) + 1) * TILE;
    e.hitWall = true;
  }
  e.y += e.vy;
  if (rectSolid(e.x, e.y, e.w, e.h)) {
    if (e.vy > 0) { e.y = Math.floor((e.y + e.h) / TILE) * TILE - e.h; e.onGround = true; }
    else if (e.vy < 0) { e.y = (Math.floor(e.y / TILE) + 1) * TILE; e.hitCeil = true; }
    e.vy = 0;
  }
}
function groundTopY(tx) {
  for (let ty = 0; ty < LEVEL_H; ty++) if (isSolidTile(tileAt(tx, ty))) return ty * TILE;
  return VH;
}
function openBox(tx, ty) {
  if (tileAt(tx, ty) !== T_BOX) return;
  map[ty][tx] = T_USED;
  Sound.play('box');
  spawnItem(tx * TILE + 2, ty * TILE - 12, 'weapon', false);
}

// ---------- 生成 ----------
function newGame(idx) {
  lives = 3; score = 0; currentWeapon = 'normal';
  startStage(idx);
}
function startStage(idx) {
  stageIdx = idx; STG = STAGES[idx];
  const b = makeBuilder(STG.w);
  STG.build(b);
  map = b.m; levelW = STG.w; arenaL = levelW - 20;
  checkpointIdx = -1; stageStartScore = score; arenaLocked = false; crumbles = new Map();
  startFromCheckpoint();
  banner = { text: 'ステージ' + (idx + 1) + '  ' + STG.name, color: '#fcfcfc', t: 150 };
  state = 'play';
}
function makeTraps() {
  return STG.traps.map(t => t.type === 'flame'
    ? { type: 'flame', x: t.x * TILE, base: groundTopY(t.x), period: 150, phase: t.phase || 0, on: false, warn: false }
    : { type: 'rock', x: t.x * TILE + 1, y: TILE, w: 14, h: 14, vy: 0, state: 'hang', t: 0 });
}
function startFromCheckpoint() {
  const sx = checkpointIdx < 0 ? 3 : STG.checkpoints[checkpointIdx];
  player = {
    x: sx * TILE + 3, y: groundTopY(sx) - 14, w: 10, h: 14, vx: 0, vy: 0,
    face: 1, hp: MAX_HP, inv: 60, knock: 0, cd: 0, charge: 0,
    coyote: 0, jumpBuf: 0, anim: 0, dead: false, onGround: false,
  };
  enemies = STG.enemies.filter(s => s.x > sx + 4).map(makeEnemy);
  bullets = []; items = []; particles = [];
  if (arenaLocked) for (let y = 0; y < 10; y++) map[y][arenaL] = T_AIR;
  arenaLocked = false; boss = null; bossDying = 0; banner = null;
  for (const c of crumbles.values()) map[c.ty][c.tx] = T_CRUMBLE;
  crumbles = new Map(); traps = makeTraps(); trapClock = 0;
  cam.x = clamp(player.x - VW / 2, 0, levelW * TILE - VW);
}

const ETYPES = {
  walker: { w: 12, h: 13, ox: 2, oy: 2, hp: 2, dmg: 3, score: 100 },
  hopper: { w: 12, h: 12, ox: 2, oy: 3, hp: 3, dmg: 3, score: 200 },
  flyer:  { w: 12, h: 9, ox: 2, oy: 3, hp: 1, dmg: 2, score: 150 },
  turret: { w: 14, h: 12, ox: 1, oy: 4, hp: 4, dmg: 3, score: 300 },
  boss:   { w: 42, h: 45, ox: 3, oy: 3, s: 3, hp: 30, dmg: 4, score: 5000 },
};
function makeEnemy(sp) {
  const T = ETYPES[sp.type];
  const e = Object.assign({ type: sp.type, vx: 0, vy: 0, t: 0, timer: 60, dir: -1, flash: 0, s: 1, active: false, dead: false }, T);
  if (sp.type === 'boss') { e.hp = STG.boss.hp; if (stageIdx > 0) e.spr = 'boss' + (stageIdx + 1); }
  else e.hp += STG.diff.ehp;
  e.spd = STG.diff.spd;
  e.maxHp = e.hp;
  e.x = sp.x * TILE + (TILE - e.w) / 2;
  if (sp.type === 'flyer') { e.y = sp.row * TILE; e.baseY = e.y; }
  else e.y = groundTopY(sp.x) - e.h;
  return e;
}

function spawnItem(x, y, kind, expire) {
  let weapon = null;
  if (kind === 'weapon') {
    const choices = WEAPON_IDS.filter(w => w !== 'normal' && w !== currentWeapon);
    weapon = choices[Math.floor(Math.random() * choices.length)];
  }
  items.push({ kind, weapon, x, y, w: 12, h: 12, vx: 0, vy: -3, life: expire ? 480 : -1 });
}

function burst(x, y, n, colors, speed = 2, life = 25) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * speed + 0.3;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life + Math.random() * 10, color: colors[i % colors.length], size: 2 });
  }
}

// ---------- 主人公 ----------
function fire(big) {
  const p = player, w = currentWeapon, dir = p.face;
  const mine = bullets.filter(b => b.friendly).length;
  if (!big && mine >= WEAPONS[w].max) return false;
  const mx = dir > 0 ? p.x + p.w + 3 : p.x - 3, my = p.y + 8;
  const color = WEAPONS[w].color;
  const add = o => bullets.push(Object.assign({ x: mx, y: my, vx: 0, vy: 0, w: 6, h: 6, dmg: 1, friendly: true, life: 120, color, kind: 'pellet' }, o));
  switch (w) {
    case 'normal': add({ vx: 4.5 * dir }); break;
    case 'rapid': add({ vx: 5.5 * dir, vy: (Math.random() - 0.5) * 0.5, w: 4, h: 4 }); break;
    case 'spread': for (const a of [-0.32, 0, 0.18]) add({ vx: Math.cos(a) * 4 * dir, vy: Math.sin(a) * 4 }); break;
    case 'charge':
      if (big) { add({ vx: 5 * dir, w: 16, h: 16, dmg: 5, pierce: true, kind: 'big' }); Sound.play('big'); return true; }
      add({ vx: 4.5 * dir });
      break;
    case 'heavy': add({ vx: 3.5 * dir, w: 26, h: 10, dmg: 3, pierce: true, kind: 'beam', x: mx + dir * 10 }); Sound.play('big'); return true;
    case 'homing': add({ vx: 2.5 * dir, vy: -1, dmg: 2, homing: true, life: 160, kind: 'homing' }); break;
  }
  Sound.play('shot');
  return true;
}

function hurtPlayer(dmg) {
  const p = player;
  if (p.dead || p.inv > 0 || state !== 'play') return;
  p.hp -= dmg;
  Sound.play('hurt');
  if (p.hp <= 0) { killPlayer(); return; }
  p.inv = 90; p.knock = 14; p.vx = -p.face * 1.2; p.vy = -2.5;
}
function killPlayer() {
  const p = player;
  if (p.dead) return;
  p.dead = true; p.hp = 0;
  lives--; deathTimer = 150;
  Sound.play('dead');
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  for (let i = 0; i < 16; i++) {
    const a = i / 8 * Math.PI, s = i < 8 ? 1.2 : 2.4;
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 90, color: i % 2 ? '#3cbcfc' : '#fcfcfc', size: 4, ring: true });
  }
}

function updatePlayer() {
  const p = player;
  if (p.dead) return;
  const ax = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
  if (p.knock > 0) p.knock--;
  else { p.vx = ax * 1.6; if (ax) p.face = ax; }

  if (pressed.jump) p.jumpBuf = 8; else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.onGround) p.coyote = 6; else if (p.coyote > 0) p.coyote--;
  if (p.jumpBuf > 0 && p.coyote > 0 && p.knock <= 0) {
    p.vy = -5.6; p.jumpBuf = 0; p.coyote = 0; Sound.play('jump');
  }
  if (!keys.jump && p.vy < -2) p.vy = -2;   // ボタンを早く離すと低いジャンプ
  p.vy = Math.min(p.vy + GRAV, MAXFALL);
  moveEntity(p);
  p.x = clamp(p.x, 0, levelW * TILE - p.w);

  if (p.onGround) {
    const ty = Math.floor((p.y + p.h + 1) / TILE);
    for (const fx of [p.x + 1, p.x + p.w - 1]) {
      const tx = Math.floor(fx / TILE), k = ty * levelW + tx;
      if (tileAt(tx, ty) === T_CRUMBLE && !crumbles.has(k)) crumbles.set(k, { tx, ty, t: 0 });
    }
  }
  const tx0 = Math.floor(p.x / TILE), tx1 = Math.floor((p.x + p.w - 0.01) / TILE);
  const ty0 = Math.floor(p.y / TILE), ty1 = Math.floor((p.y + p.h - 0.01) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (tileAt(tx, ty) === T_SPIKE && overlap(p, { x: tx * TILE + 2, y: ty * TILE + 9, w: 12, h: 7 })) hurtPlayer(4);
  }

  if (p.hitCeil) {
    const ty = Math.floor((p.y - 1) / TILE);
    for (const px of [p.x + p.w / 2, p.x + 1, p.x + p.w - 1]) {
      const tx = Math.floor(px / TILE);
      if (tileAt(tx, ty) === T_BOX) { openBox(tx, ty); break; }
    }
  }
  if (p.y > VH + 16) { killPlayer(); return; }

  // 攻撃: チャージだけは「離したとき」に大きい弾。ほかは押しっぱなしで連射
  if (p.cd > 0) p.cd--;
  if (currentWeapon === 'charge') {
    if (pressed.shoot) { fire(false); p.charge = 0; }
    if (keys.shoot) {
      p.charge++;
      if (p.charge === 20 || p.charge === 50) Sound.play('charge');
    }
    if (released.shoot) { if (p.charge >= 50) fire(true); p.charge = 0; }
  } else {
    p.charge = 0;
    if (keys.shoot && p.cd <= 0 && fire(false)) p.cd = WEAPONS[currentWeapon].cd;
  }

  if (p.inv > 0) p.inv--;
  p.anim = p.onGround && p.vx !== 0 ? p.anim + 1 : 0;
}

// ---------- 敵 ----------
function damageEnemy(e, dmg) {
  if (e.type === 'boss' && e.state === 'enter') return;
  e.hp -= dmg; e.flash = 8;
  Sound.play('hit');
  // ボスは体力が半分になったら回復を1つ落とす
  if (e.type === 'boss' && !e.dropped && e.hp > 0 && e.hp <= e.maxHp / 2) {
    e.dropped = true;
    spawnItem((arenaL + 4) * TILE, 60, 'heal', false);
  }
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true;
  score += e.score;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  burst(cx, cy, 14, ['#fcfcfc', '#f8b800', '#e45c10']);
  Sound.play('explode');
  if (e.type === 'boss') { bossDying = 150; return; }
  const r = Math.random();
  if (r < 0.35) spawnItem(cx - 6, cy - 6, 'weapon', true);
  else if (r < 0.55) spawnItem(cx - 6, cy - 6, 'heal', true);
}
function enemyShot(x, y, angle, speed, dmg = 2) {
  bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, w: 6, h: 6, dmg, friendly: false, life: 300, color: '#fc7460', kind: 'enemy' });
}
function aimAt(x, y) { return Math.atan2(player.y + player.h / 2 - y, player.x + player.w / 2 - x); }

function updateEnemy(e) {
  const p = player;
  if (!e.active) {
    if (e.x < cam.x + VW + 16) e.active = true; else return;
  }
  if (e.type !== 'boss' && e.x + e.w < cam.x - 48) { e.dead = true; return; }
  e.t++;
  if (e.flash > 0) e.flash--;
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;

  switch (e.type) {
    case 'walker': {
      e.vx = e.dir * 0.5 * e.spd;
      e.vy = Math.min(e.vy + GRAV, MAXFALL);
      moveEntity(e);
      if (e.hitWall) e.dir *= -1;
      else if (e.onGround) {
        const ax = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
        if (!solidAt(ax, e.y + e.h + 2)) e.dir *= -1;
      }
      break;
    }
    case 'hopper': {
      e.vy = Math.min(e.vy + GRAV, MAXFALL);
      if (e.onGround) {
        e.vx = 0;
        if (--e.timer <= 0) { e.vy = -4.6; e.vx = (Math.sign(p.x - e.x) || -1) * 1.1 * e.spd; e.timer = Math.round(70 / e.spd); }
      }
      moveEntity(e);
      if (e.hitWall) e.vx = 0;
      e.dir = Math.sign(p.x - e.x) || -1;
      break;
    }
    case 'flyer': {
      const dx = p.x - e.x;
      e.dir = Math.sign(dx) || -1;
      e.x += e.dir * 0.55 * e.spd;
      e.y = e.baseY + Math.sin(e.t * 0.06) * 18;
      break;
    }
    case 'turret': {
      e.dir = Math.sign(p.x - e.x) || -1;
      if (--e.timer <= 0 && Math.abs(p.x - e.x) < 200 && !p.dead) {
        enemyShot(cx, e.y + 6, aimAt(cx, e.y + 6), 1.6 * e.spd);
        e.timer = STG.diff.turret;
      }
      break;
    }
    case 'boss': updateBoss(e); break;
  }
  if (e.y > VH + 32) e.dead = true;
  if (!e.dead && !p.dead && overlap(e, p)) hurtPlayer(e.dmg);
}

function updateBoss(e) {
  const p = player;
  e.vy = Math.min(e.vy + GRAV, MAXFALL);
  const angry = e.hp <= e.maxHp / 2, B = STG.boss;
  switch (e.state) {
    case 'enter': break;
    case 'idle':
      e.vx = 0;
      e.dir = Math.sign(p.x + p.w / 2 - (e.x + e.w / 2)) || -1;
      if (--e.timer <= 0) {
        e.mode = (e.mode + 1) % 3;
        if (e.mode === 1) { e.state = 'jump'; e.vy = -5.8; e.vx = e.dir * B.jumpVx * (angry ? 1.35 : 1); }
        else { e.state = 'shoot'; e.timer = 10; e.shots = B.shots + (angry ? 1 : 0); }
      }
      break;
    case 'shoot':
      if (--e.timer <= 0) {
        if (e.shots > 0) {
          const sx = e.x + e.w / 2 + e.dir * 18, sy = e.y + 28;
          const a = aimAt(sx, sy);
          for (const d of B.spread) enemyShot(sx, sy, a + d, B.shotSpd, 3);
          Sound.play('shot');
          e.shots--; e.timer = 35;
        } else { e.state = 'idle'; e.timer = Math.round(B.idle * (angry ? 0.65 : 1)); }
      }
      break;
  }
  moveEntity(e);
  if (e.hitWall) e.vx = 0;
  if (e.onGround && (e.state === 'enter' || e.state === 'jump')) {
    if (e.state === 'enter') Sound.play('boss');
    // 3面のボスは着地すると地面を走る衝撃波を出す(ジャンプでよける)
    if (B.wave && e.state === 'jump') {
      for (const d of [-1, 1]) bullets.push({ x: e.x + e.w / 2 + d * 22, y: e.y + e.h - 7, vx: d * 2.2, vy: 0, w: 8, h: 14, dmg: 3, friendly: false, life: 200, color: '#c084fc', kind: 'wave' });
    }
    e.state = 'idle'; e.timer = 50; shake = 12; Sound.play('big');
  }
}

// ---------- 罠 ----------
function updateTraps() {
  trapClock++;
  const p = player;
  for (const tr of traps) {
    if (tr.type === 'flame') {
      const c = (trapClock + tr.phase) % tr.period;
      tr.on = c >= tr.period - 50;
      tr.warn = !tr.on && c >= tr.period - 80;
      if (c === tr.period - 50 && Math.abs(tr.x - cam.x - VW / 2) < VW / 2 + 32) Sound.play('fire');
      if (tr.on && !p.dead && overlap({ x: tr.x + 3, y: tr.base - 48, w: 10, h: 48 }, p)) hurtPlayer(4);
    } else if (tr.state !== 'gone') {
      if (tr.state === 'hang') {
        if (!p.dead && Math.abs(p.x + p.w / 2 - (tr.x + 7)) < 40 && p.y > tr.y) { tr.state = 'shake'; tr.t = 0; }
      } else if (tr.state === 'shake') {
        if (++tr.t >= 24) tr.state = 'fall';
      } else {
        tr.vy = Math.min(tr.vy + 0.35, 7); tr.y += tr.vy;
        if (solidAt(tr.x + 7, tr.y + tr.h) || tr.y > VH) {
          burst(tr.x + 7, tr.y + tr.h, 10, ['#bcbcbc', '#7c7c7c', '#fcfcfc'], 2);
          Sound.play('explode'); shake = 5; tr.state = 'gone';
          continue;
        }
      }
      if (!p.dead && overlap(tr, p)) hurtPlayer(5);
    }
  }
  for (const [k, c] of crumbles) {
    c.t++;
    if (c.t === 30) {
      map[c.ty][c.tx] = T_AIR;
      burst(c.tx * TILE + 8, c.ty * TILE + 8, 8, ['#c88c4c', '#6c3c14'], 1.5);
      Sound.play('crumble');
    }
    if (c.t >= 300 && !overlap({ x: c.tx * TILE, y: c.ty * TILE, w: TILE, h: TILE }, p)) {
      map[c.ty][c.tx] = T_CRUMBLE; crumbles.delete(k);
    }
  }
}

// ---------- 弾・アイテム・粒 ----------
function updateBullets() {
  for (const b of bullets) {
    if (b.homing) {
      let best = null, bd = 220 * 220;
      for (const e of enemies) {
        if (!e.active || e.dead) continue;
        const dx = e.x + e.w / 2 - b.x, dy = e.y + e.h / 2 - b.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const want = Math.atan2(best.y + best.h / 2 - b.y, best.x + best.w / 2 - b.x);
        let cur = Math.atan2(b.vy, b.vx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cur += clamp(diff, -0.12, 0.12);
        b.vx = Math.cos(cur) * 3.2; b.vy = Math.sin(cur) * 3.2;
      }
    }
    b.x += b.vx; b.y += b.vy;
    if (--b.life <= 0 || b.x < cam.x - 24 || b.x > cam.x + VW + 24 || b.y < -24 || b.y > VH + 24) { b.dead = true; continue; }

    if (solidAt(b.x, b.y)) {
      const tx = Math.floor(b.x / TILE), ty = Math.floor(b.y / TILE);
      if (b.friendly) openBox(tx, ty);
      burst(b.x, b.y, 3, [b.color], 1, 8);
      b.dead = true; continue;
    }
    const r = { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h };
    if (b.friendly) {
      for (const e of enemies) {
        if (!e.active || e.dead || !overlap(r, e)) continue;
        if (b.pierce) {
          b.hit = b.hit || new Set();
          if (b.hit.has(e)) continue;
          b.hit.add(e);
          damageEnemy(e, b.dmg);
        } else {
          damageEnemy(e, b.dmg);
          b.dead = true; break;
        }
      }
    } else if (!player.dead && overlap(r, player)) {
      hurtPlayer(b.dmg);
      b.dead = true;
    }
  }
  bullets = bullets.filter(b => !b.dead);
}

function updateItems() {
  for (const it of items) {
    it.vy = Math.min(it.vy + GRAV, MAXFALL);
    moveEntity(it);
    if (it.life > 0 && --it.life === 0) it.dead = true;
    if (it.y > VH) it.dead = true;
    if (!it.dead && !player.dead && overlap(it, player)) {
      it.dead = true;
      if (it.kind === 'heal') {
        player.hp = Math.min(MAX_HP, player.hp + 8);
        Sound.play('heal');
        banner = { text: 'かいふく!', color: '#fc7460', t: 60 };
      } else {
        currentWeapon = it.weapon;
        player.charge = 0;
        Sound.play('item');
        banner = { text: WEAPONS[it.weapon].name + ' ゲット!', color: WEAPONS[it.weapon].color, t: 100 };
      }
    }
  }
  items = items.filter(i => !i.dead);
}

function updateParticles() {
  for (const q of particles) { q.x += q.vx; q.y += q.vy; if (!q.ring) q.vy += 0.05; q.life--; }
  particles = particles.filter(q => q.life > 0);
}

// ---------- 進行 ----------
function updateCamera() {
  if (arenaLocked) cam.x += (arenaL * TILE - cam.x) * 0.15;
  else cam.x = clamp(player.x + player.w / 2 - VW / 2, 0, levelW * TILE - VW);
}

function checkProgress() {
  STG.checkpoints.forEach((cp, i) => {
    if (i > checkpointIdx && !player.dead && player.x > cp * TILE) {
      checkpointIdx = i;
      Sound.play('check');
      banner = { text: 'チェックポイント!', color: '#58f898', t: 80 };
    }
  });
  if (!arenaLocked && !player.dead && player.x > (arenaL + 2) * TILE) {
    arenaLocked = true;
    for (let y = 0; y < 10; y++) map[y][arenaL] = T_METAL;
    boss = makeEnemy({ type: 'boss', x: arenaL + 14 });
    boss.y = -60; boss.state = 'enter'; boss.mode = 0; boss.active = true;
    enemies.push(boss);
    banner = { text: 'ボスがあらわれた!', color: '#fc7460', t: 100 };
  }
}

function update() {
  frame++;
  if (state === 'title') {
    if (pressed.left) selStage = Math.max(0, selStage - 1);
    if (pressed.right) selStage = Math.min(maxStage, selStage + 1);
    if (pressed.start || pressed.jump || pressed.shoot) newGame(selStage);
    return;
  }
  if (state === 'gameover' || state === 'clear' || state === 'allclear') {
    stateTimer++;
    if (stateTimer > 60 && (pressed.start || pressed.jump)) {
      if (state === 'clear') { lives = Math.max(lives, 3); startStage(stageIdx + 1); }
      else if (state === 'gameover') { lives = 3; score = stageStartScore; startStage(stageIdx); }
      else { selStage = maxStage; state = 'title'; }
    }
    return;
  }
  if (state === 'pause') { if (pressed.start) state = 'play'; return; }
  if (pressed.start && !player.dead) { state = 'pause'; return; }

  updatePlayer();
  updateTraps();
  for (const e of enemies) if (!e.dead) updateEnemy(e);
  enemies = enemies.filter(e => !e.dead);
  updateBullets();
  updateItems();
  updateParticles();
  checkProgress();
  updateCamera();
  if (shake > 0) shake--;
  if (banner && --banner.t <= 0) banner = null;

  if (player.dead && --deathTimer <= 0) {
    if (lives < 0) { state = 'gameover'; stateTimer = 0; }
    else startFromCheckpoint();
  }
  if (bossDying > 0) {
    bossDying--;
    if (bossDying % 8 === 0) {
      burst(boss.x + Math.random() * boss.w, boss.y + Math.random() * boss.h, 10, ['#fcfcfc', '#f8b800', '#e45c10'], 2.5);
      Sound.play('explode'); shake = 6;
    }
    if (bossDying === 0) {
      saveMaxStage(stageIdx + 1); maxStage = loadMaxStage();
      state = stageIdx === STAGES.length - 1 ? 'allclear' : 'clear'; stateTimer = 0; Sound.play('clear');
    }
  }
}

// ---------- 描画 ----------
function drawBackground(camX, theme = STG.theme) {
  ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, VW, VH);
  if (theme.stars) {
    for (let i = 0; i < 40; i++) {
      const x = (((i * 97) % 420) - camX * 0.05 + 420 * 4) % 420 - 50, y = (i * 53) % 110 + 4;
      ctx.fillStyle = (i + Math.floor(frame / 20)) % 7 ? '#fcfcfc' : '#606080';
      ctx.fillRect(Math.floor(x), y, 1, 1);
    }
    ctx.fillStyle = '#fcf8c0'; ctx.beginPath(); ctx.arc(250 - camX * 0.02 % 40, 34, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = theme.sky; ctx.beginPath(); ctx.arc(256 - camX * 0.02 % 40, 30, 11, 0, Math.PI * 2); ctx.fill();
  }
  const tile = (img, par, y) => {
    const off = -Math.floor(camX * par) % img.width;
    for (let x = off; x < VW; x += img.width) ctx.drawImage(img, x, y);
  };
  if (theme.clouds) [[-10, 20], [120, 40], [230, 14], [330, 34]].forEach(([cx, cy]) => {
    const x = ((cx - camX * 0.2) % 420 + 420) % 420 - 50;
    ctx.drawImage(CLOUD_SPR, Math.floor(x), cy);
  });
  tile(theme.far, 0.25, VH - 32 - 80);
  tile(theme.near, 0.5, VH - 32 - 56);
}

function drawTiles(camX) {
  const t0 = Math.floor(camX / TILE), t1 = t0 + Math.ceil(VW / TILE) + 1;
  for (let ty = 0; ty < LEVEL_H; ty++) {
    for (let tx = t0; tx <= t1; tx++) {
      const t = tileAt(tx, ty);
      if (t === T_AIR || tx >= levelW) continue;
      let img;
      let ox = 0;
      if (t === T_GROUND) img = isSolidTile(tileAt(tx, ty - 1)) ? STG.theme.tiles.dirt : STG.theme.tiles.grass;
      else if (t === T_SPIKE) img = SPIKE_SPR;
      else if (t === T_CRUMBLE) { img = CRUMBLE_SPR; if (crumbles.has(ty * levelW + tx)) ox = frame % 4 < 2 ? -1 : 1; }
      else if (t === T_BRICK) img = TILE_SPR.brick;
      else if (t === T_METAL) img = TILE_SPR.metal;
      else if (t === T_BOX) img = TILE_SPR.box;
      else img = TILE_SPR.usedBox;
      const y = t === T_BOX ? ty * TILE + (Math.floor(frame / 20) % 2 ? -1 : 0) : ty * TILE;
      ctx.drawImage(img, tx * TILE - camX + ox, y);
    }
  }
}

function drawFlags(camX) {
  STG.checkpoints.forEach((cp, i) => {
    const x = cp * TILE - camX + 7, top = groundTopY(cp);
    if (x < -16 || x > VW + 16) return;
    ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x, top - 40, 2, 40);
    ctx.fillStyle = '#f8b800'; ctx.fillRect(x - 1, top - 43, 4, 4);
    ctx.fillStyle = i <= checkpointIdx ? '#00a800' : '#d82800';
    const fy = i <= checkpointIdx ? top - 39 : top - 14;
    ctx.fillRect(x + 2, fy, 12, 9);
  });
}

function drawItem(it, camX) {
  if (it.life > 0 && it.life < 120 && Math.floor(frame / 4) % 2) return;
  const x = Math.round(it.x - camX), y = Math.round(it.y);
  if (it.kind === 'heal') {
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, 12, 12);
    ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x + 1, y + 1, 10, 10);
    ctx.fillStyle = '#d82800'; ctx.fillRect(x + 5, y + 2, 2, 8); ctx.fillRect(x + 2, y + 5, 8, 2);
    return;
  }
  const col = WEAPONS[it.weapon].color;
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, 12, 12);
  ctx.fillStyle = Math.floor(frame / 8) % 2 ? col : '#fcfcfc'; ctx.fillRect(x + 1, y + 1, 10, 10);
  ctx.fillStyle = '#000'; ctx.fillRect(x + 2, y + 2, 8, 8);
  ctx.fillStyle = col;
  WEAPON_GLYPH[it.weapon].forEach((row, j) => {
    for (let i = 0; i < 5; i++) if (row[i] === 'W') ctx.fillRect(x + 3 + i + (i > 2 ? 1 : 0), y + 3 + j + (j > 2 ? 1 : 0), 1, 1);
  });
}

function drawEnemy(e, camX) {
  if (e.flash > 0 && Math.floor(frame / 2) % 2) return;
  const frames = ENEMY_SPR[e.spr || e.type];
  const f = frames[Math.floor(e.t / 12) % frames.length];
  const img = e.dir > 0 ? f.r : f.l;
  const s = e.s;
  ctx.drawImage(img, Math.round(e.x - e.ox * s - camX), Math.round(e.y - e.oy * s), img.width * s, img.height * s);
}

function drawPlayer(camX) {
  const p = player;
  if (p.dead) return;
  if (p.inv > 0 && Math.floor(frame / 3) % 2) return;
  let f = 'idle';
  if (!p.onGround) f = 'jump';
  else if (p.vx !== 0) f = Math.floor(p.anim / 8) % 2 ? 'run1' : 'run2';
  let suit = currentWeapon;
  if (p.charge >= 20 && Math.floor(frame / (p.charge >= 50 ? 2 : 5)) % 2) suit = 'flash';
  const spr = PLAYER_SPR[suit][f];
  ctx.drawImage(p.face > 0 ? spr.r : spr.l, Math.round(p.x - 3 - camX), Math.round(p.y - 1));
}

function drawBullet(b, camX) {
  const x = Math.round(b.x - camX), y = Math.round(b.y);
  ctx.fillStyle = b.color;
  if (b.kind === 'big') {
    const r = 8 + (Math.floor(frame / 3) % 2);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fcfcfc'; ctx.beginPath(); ctx.arc(x, y, r - 4, 0, Math.PI * 2); ctx.fill();
  } else if (b.kind === 'wave') {
    ctx.fillRect(x - b.w / 2, y - b.h / 2 + (frame % 4 < 2 ? 0 : 2), b.w, b.h);
    ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x - 1, y - b.h / 2 + 3, 2, b.h - 4);
  } else if (b.kind === 'beam') {
    ctx.fillRect(x - b.w / 2, y - b.h / 2, b.w, b.h);
    ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x - b.w / 2 + 2, y - 2, b.w - 4, 4);
  } else {
    const h = b.w / 2;
    ctx.fillStyle = '#000'; ctx.fillRect(x - h, y - h + 1, b.w, b.h - 2); ctx.fillRect(x - h + 1, y - h, b.w - 2, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(x - h + 1, y - h + 1, b.w - 2, b.h - 2);
  }
}

function drawBar(x, y, val, max, color) {
  const n = Math.ceil(max / 2);
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, 8, n * 2 + 2);
  for (let i = 0; i < n; i++) {
    const on = (n - i) * 2 <= val + 1;
    ctx.fillStyle = on ? color : '#383838';
    ctx.fillRect(x + 1, y + 1 + i * 2, 6, 1);
  }
}

function drawTraps(camX) {
  for (const tr of traps) {
    const x = tr.x - camX;
    if (x < -24 || x > VW + 24) continue;
    if (tr.type === 'flame') {
      ctx.fillStyle = '#000'; ctx.fillRect(x + 1, tr.base - 5, 14, 5);
      ctx.fillStyle = '#7c7c7c'; ctx.fillRect(x + 2, tr.base - 4, 12, 3);
      ctx.fillStyle = '#383838'; ctx.fillRect(x + 6, tr.base - 4, 4, 2);
      if (tr.warn && frame % 6 < 3) { ctx.fillStyle = '#f8b800'; ctx.fillRect(x + 6, tr.base - 8, 2, 2); ctx.fillRect(x + 9, tr.base - 10, 2, 2); }
      if (tr.on) {
        const j = frame % 6 < 3 ? 0 : 3;
        ctx.fillStyle = '#e45c10'; ctx.fillRect(x + 3, tr.base - 48 + j, 10, 44 - j);
        ctx.fillStyle = '#f8b800'; ctx.fillRect(x + 5, tr.base - 40 + j, 6, 36 - j);
        ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x + 7, tr.base - 24, 2, 20);
      }
    } else if (tr.state !== 'gone') {
      if (tr.state !== 'fall') { ctx.fillStyle = '#7c7c7c'; ctx.fillRect(x + 6, 0, 2, tr.y); }
      const jx = tr.state === 'shake' ? (frame % 4 < 2 ? -1 : 1) : 0;
      ctx.drawImage(ROCK_SPR, Math.round(x - 1 + jx), Math.round(tr.y - 1));
    }
  }
}

function drawWorld() {
  const camX = Math.round(cam.x) + (shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0);
  drawBackground(camX);
  drawTiles(camX);
  drawTraps(camX);
  drawFlags(camX);
  for (const it of items) drawItem(it, camX);
  for (const e of enemies) drawEnemy(e, camX);
  drawPlayer(camX);
  for (const b of bullets) drawBullet(b, camX);
  for (const q of particles) {
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.round(q.x - camX - q.size / 2), Math.round(q.y - q.size / 2), q.size, q.size);
  }
  drawBar(8, 8, Math.max(0, player.hp), MAX_HP, '#fcfc9c');
  if (boss && !boss.dead && boss.state !== 'enter') drawBar(VW - 16, 8, Math.max(0, boss.hp), boss.maxHp, '#fc7460');
}

// 文字は拡大後の画面に直接書く(ぼやけないように)
function text(str, x, y, size, color, align = 'center') {
  sctx.font = `bold ${size}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif`;
  sctx.textAlign = align; sctx.textBaseline = 'middle';
  sctx.lineJoin = 'round'; sctx.lineWidth = Math.max(4, size / 5); sctx.strokeStyle = '#000';
  sctx.strokeText(str, x, y);
  sctx.fillStyle = color; sctx.fillText(str, x, y);
}

function drawHud() {
  const W = VW * SCALE;
  text('ぶき: ' + WEAPONS[currentWeapon].name, 52, 30, 22, WEAPONS[currentWeapon].color, 'left');
  text('のこり ' + Math.max(0, lives), 52, 60, 18, '#fcfcfc', 'left');
  text('SCORE ' + String(score).padStart(6, '0'), W - 70, 30, 20, '#fcfcfc', 'right');
  text('ステージ ' + (stageIdx + 1), W / 2, 30, 20, '#fcfcfc');
  if (banner) text(banner.text, W / 2, 110, 34, banner.color);
}

function drawTitle() {
  drawBackground(frame * 0.5, THEMES.grass);
  for (let tx = 0; tx < VW / TILE + 1; tx++) {
    ctx.drawImage(TILE_SPR.grass, tx * TILE, 160);
    ctx.drawImage(TILE_SPR.dirt, tx * TILE, 176);
  }
  const spr = PLAYER_SPR[WEAPON_IDS[Math.floor(frame / 90) % WEAPON_IDS.length]][Math.floor(frame / 8) % 2 ? 'run1' : 'run2'];
  ctx.drawImage(spr.r, 0, 0, 16, 16, 136, 112, 48, 48);
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(buf, 0, 0, VW * SCALE, VH * SCALE);
  const W = VW * SCALE;
  text('ブラスター・キッド', W / 2, 110, 64, '#f8b800');
  if (Math.floor(frame / 30) % 2) text(isTouch ? 'タップで スタート' : 'Enter か Z でスタート', W / 2, 220, 30, '#fcfcfc');
  if (maxStage > 0) text((selStage > 0 ? '◀ ' : '　 ') + 'ステージ ' + (selStage + 1) + ' ' + STAGES[selStage].name + (selStage < maxStage ? ' ▶' : '　 '), W / 2, 280, 28, '#f8b800');
  if (!isTouch) text('← → いどう    Z / スペース ジャンプ    X うつ(おしっぱなしで れんしゃ)', W / 2, 500, 20, '#fcfcfc');
  text((isTouch ? '' : 'Enter ポーズ    ') + '?ブロックや てきから でる アイテムで ぶきが かわるよ', W / 2, 535, 20, '#fcfcfc');
}

function render() {
  if (state === 'title') { drawTitle(); return; }
  drawWorld();
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(buf, 0, 0, VW * SCALE, VH * SCALE);
  drawHud();
  const W = VW * SCALE, H = VH * SCALE;
  if (state === 'pause') {
    sctx.fillStyle = 'rgba(0,0,0,0.5)'; sctx.fillRect(0, 0, W, H);
    text('ポーズ', W / 2, H / 2, 56, '#fcfcfc');
  } else if (state === 'gameover') {
    sctx.fillStyle = 'rgba(0,0,0,0.6)'; sctx.fillRect(0, 0, W, H);
    text('ゲームオーバー', W / 2, H / 2 - 30, 60, '#fc7460');
    if (stateTimer > 60) text((isTouch ? 'タップで' : 'Enter で') + ' ステージ' + (stageIdx + 1) + 'の さいしょから', W / 2, H / 2 + 50, 28, '#fcfcfc');
  } else if (state === 'clear') {
    sctx.fillStyle = 'rgba(0,0,0,0.45)'; sctx.fillRect(0, 0, W, H);
    text('ステージ' + (stageIdx + 1) + ' クリア!', W / 2, H / 2 - 50, 64, '#f8b800');
    text('SCORE ' + score, W / 2, H / 2 + 30, 32, '#fcfcfc');
    if (stateTimer > 60) text((isTouch ? 'タップで' : 'Enter で') + ' つぎの ステージへ', W / 2, H / 2 + 90, 28, '#fcfcfc');
  } else if (state === 'allclear') {
    sctx.fillStyle = 'rgba(0,0,0,0.55)'; sctx.fillRect(0, 0, W, H);
    text('ぜんぶ クリア!', W / 2, H / 2 - 70, 68, '#f8b800');
    text('おめでとう!  SCORE ' + score, W / 2, H / 2 + 10, 34, '#fcfcfc');
    if (stateTimer > 60) text(isTouch ? 'タップで タイトルへ' : 'Enter で タイトルへ', W / 2, H / 2 + 80, 28, '#fcfcfc');
  }
}

// ---------- ループ(1秒60回で固定) ----------
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= 1000 / 60) {
    update();
    for (const k in pressed) delete pressed[k];
    for (const k in released) delete released[k];
    acc -= 1000 / 60;
  }
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 動作確認用
window.__game = { get state() { return state; }, get player() { return player; }, get enemies() { return enemies; }, get cam() { return cam; }, setWeapon(w) { currentWeapon = w; }, start(i) { lives = 3; score = 0; startStage(i); }, get stage() { return stageIdx; }, get lives() { return lives; }, get traps() { return traps; }, warp(tx) { player.x = tx * TILE + 3; player.y = groundTopY(tx) - 14; player.vy = 0; }, get boss() { return boss; }, get weapon() { return currentWeapon; } };
