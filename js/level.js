'use strict';
// ステージ定義。1マス = 16ドット。縦12マス(下の2マスが地面)。右端の20マスはボス部屋。

const LEVEL_H = 12;
const T_AIR = 0, T_GROUND = 1, T_BRICK = 2, T_METAL = 3, T_BOX = 4, T_USED = 5, T_SPIKE = 6, T_CRUMBLE = 7;
const isSolidTile = t => t !== T_AIR && t !== T_SPIKE;   // トゲは踏めない(さわると痛い)

function makeBuilder(W) {
  const m = [];
  for (let y = 0; y < LEVEL_H; y++) m.push(new Array(W).fill(T_AIR));
  const set = (x, y, t) => { if (x >= 0 && x < W && y >= 0 && y < LEVEL_H) m[y][x] = t; };
  const topOf = x => { for (let y = 0; y < LEVEL_H; y++) if (isSolidTile(m[y][x])) return y; return LEVEL_H; };
  const b = {
    m,
    ground(x0, x1, top) { for (let x = x0; x <= x1; x++) for (let y = 0; y < LEVEL_H; y++) set(x, y, y >= top ? T_GROUND : T_AIR); },
    pit(x0, x1) { for (let x = x0; x <= x1; x++) for (let y = 0; y < LEVEL_H; y++) set(x, y, T_AIR); },
    // 落ちても死なない、底がトゲの穴
    spikePit(x0, x1) { b.pit(x0, x1); for (let x = x0; x <= x1; x++) { set(x, 11, T_GROUND); set(x, 10, T_SPIKE); } },
    plat(x0, x1, y, t = T_BRICK) { for (let x = x0; x <= x1; x++) set(x, y, t); },
    // 乗ると少しして崩れる足場
    crumble(x0, x1, y) { b.plat(x0, x1, y, T_CRUMBLE); },
    // 地面の上にトゲを並べる
    spikes(x0, x1) { for (let x = x0; x <= x1; x++) set(x, topOf(x) - 1, T_SPIKE); },
    box(x, y) { set(x, y, T_BOX); },
    wall(x, y0, y1) { for (let y = y0; y <= y1; y++) set(x, y, T_METAL); },
    arena() {
      for (let x = W - 20; x < W; x++) for (let y = 0; y < LEVEL_H; y++) set(x, y, y >= 10 ? T_METAL : T_AIR);
      b.wall(W - 1, 0, LEVEL_H - 1);
    },
  };
  return b;
}

const HILL_FAR_F = i => 40 + 26 * Math.sin(i / 256 * Math.PI * 2) + 10 * Math.sin(i / 256 * Math.PI * 6);
const HILL_NEAR_F = i => 20 + 18 * Math.abs(Math.sin(i / 256 * Math.PI * 3));
const THEMES = {
  grass: { sky: '#5c94fc', far: HILLS_FAR, near: HILLS_NEAR, clouds: true, tiles: { grass: TILE_SPR.grass, dirt: TILE_SPR.dirt } },
  cliff: {
    sky: '#f8a060', clouds: true,
    far: makeHills(256, 80, '#c0582c', HILL_FAR_F), near: makeHills(256, 56, '#7c3818', HILL_NEAR_F),
    tiles: makeGroundTiles('#e4a040', '#fcd8a8', '#88501c', '#503000'),
  },
  fort: {
    sky: '#101838', clouds: false, stars: true,
    far: makeHills(256, 80, '#283068', HILL_FAR_F), near: makeHills(256, 56, '#1c2048', HILL_NEAR_F),
    tiles: makeGroundTiles('#7c7c7c', '#bcbcbc', '#404058', '#202030'),
  },
};

// diff: ehp=敵の体力に足す数 / spd=敵の速さの倍率 / turret=砲台が撃つ間隔(小さいほど多い)
// traps: flame=火柱(x はマス番号, phase でタイミングをずらす) / rock=近づくと落ちてくるトゲ岩
const STAGES = [
  {
    name: 'くさはら', theme: THEMES.grass, w: 232, checkpoints: [93, 203],
    diff: { ehp: 0, spd: 1, turret: 110 },
    boss: { hp: 30, shots: 2, spread: [-0.25, 0, 0.25], shotSpd: 1.8, jumpVx: 1.3, idle: 55, wave: false },
    build(b) {
      b.ground(0, 231, 10);
      b.box(10, 7);
      b.plat(22, 25, 7);
      b.spikes(31, 32);
      b.pit(37, 39);
      b.ground(44, 52, 8);
      b.box(48, 4);
      b.pit(56, 58);
      b.plat(63, 65, 8);
      b.plat(68, 70, 6);
      b.pit(99, 113);
      b.plat(101, 103, 8);
      b.plat(106, 108, 7);
      b.plat(111, 112, 8);
      b.box(118, 7);
      b.ground(136, 150, 7);
      b.wall(136, 7, 9);
      b.box(142, 3);
      b.spikes(153, 154);
      b.pit(168, 170);
      b.pit(176, 178);
      b.box(185, 7);
      b.arena();
    },
    traps: [],
    enemies: [
      { type: 'walker', x: 18 }, { type: 'walker', x: 27 },
      { type: 'flyer', x: 46, row: 5 }, { type: 'walker', x: 50 },
      { type: 'hopper', x: 75 }, { type: 'turret', x: 84 }, { type: 'walker', x: 88 },
      { type: 'flyer', x: 104, row: 4 }, { type: 'flyer', x: 110, row: 3 },
      { type: 'walker', x: 121 }, { type: 'walker', x: 126 }, { type: 'hopper', x: 129 },
      { type: 'turret', x: 145 }, { type: 'hopper', x: 157 }, { type: 'walker', x: 160 }, { type: 'flyer', x: 163, row: 4 },
      { type: 'flyer', x: 173, row: 5 }, { type: 'flyer', x: 181, row: 4 }, { type: 'turret', x: 188 },
      { type: 'walker', x: 192 }, { type: 'hopper', x: 197 },
    ],
  },
  {
    name: 'ゆうやけ がけ', theme: THEMES.cliff, w: 260, checkpoints: [80, 170],
    diff: { ehp: 1, spd: 1.2, turret: 90 },
    boss: { hp: 40, shots: 2, spread: [-0.4, -0.2, 0, 0.2, 0.4], shotSpd: 2.0, jumpVx: 1.6, idle: 45, wave: false },
    build(b) {
      b.ground(0, 259, 10);
      b.box(10, 7);
      b.spikes(15, 16);
      b.pit(24, 30); b.crumble(25, 29, 9);
      b.ground(36, 44, 8);
      b.spikePit(48, 50);
      b.box(56, 6);
      b.spikes(62, 72); b.plat(61, 63, 7); b.plat(66, 68, 7); b.plat(71, 73, 7);
      b.pit(84, 97); b.crumble(86, 87, 8); b.crumble(90, 91, 8); b.crumble(94, 95, 8);
      b.ground(110, 125, 7); b.wall(110, 7, 9); b.spikes(117, 118);
      b.pit(130, 132);
      b.box(137, 7);
      b.spikes(144, 150); b.crumble(145, 149, 7);
      b.pit(180, 182);
      b.box(190, 7);
      b.spikes(200, 201);
      b.spikePit(206, 208);
      b.spikes(222, 223);
      b.arena();
    },
    traps: [
      { type: 'flame', x: 40 }, { type: 'flame', x: 101 }, { type: 'flame', x: 105, phase: 75 },
      { type: 'flame', x: 156 }, { type: 'flame', x: 160, phase: 75 }, { type: 'flame', x: 214, phase: 40 },
    ],
    enemies: [
      { type: 'walker', x: 20 }, { type: 'flyer', x: 33, row: 4 }, { type: 'hopper', x: 42 }, { type: 'walker', x: 58 },
      { type: 'turret', x: 76 }, { type: 'flyer', x: 88, row: 4 }, { type: 'flyer', x: 93, row: 3 }, { type: 'walker', x: 103 },
      { type: 'hopper', x: 113 }, { type: 'turret', x: 122 }, { type: 'walker', x: 135 }, { type: 'flyer', x: 147, row: 4 },
      { type: 'hopper', x: 165 }, { type: 'walker', x: 175 }, { type: 'turret', x: 188 }, { type: 'flyer', x: 195, row: 4 },
      { type: 'walker', x: 212 }, { type: 'hopper', x: 218 }, { type: 'flyer', x: 226, row: 4 }, { type: 'turret', x: 232 },
    ],
  },
  {
    name: 'よるの ようさい', theme: THEMES.fort, w: 280, checkpoints: [80, 172],
    diff: { ehp: 2, spd: 1.35, turret: 70 },
    boss: { hp: 50, shots: 2, spread: [-0.4, -0.2, 0, 0.2, 0.4], shotSpd: 2.2, jumpVx: 1.9, idle: 38, wave: true },
    build(b) {
      b.ground(0, 279, 10);
      b.box(10, 7);
      b.spikes(18, 19);
      b.spikePit(33, 36);
      b.pit(40, 54); b.crumble(41, 53, 9); b.plat(47, 47, 9);
      b.box(71, 6);
      b.spikes(94, 95);
      b.pit(106, 113); b.plat(108, 109, 8); b.plat(112, 112, 7);
      b.ground(120, 138, 7); b.wall(120, 7, 9); b.spikes(133, 134);
      b.pit(142, 149); b.crumble(143, 144, 8); b.crumble(147, 148, 8);
      b.ground(155, 165, 8);
      b.spikes(198, 206); b.plat(197, 199, 7); b.plat(202, 203, 7); b.plat(206, 207, 7);
      b.pit(212, 214);
      b.spikes(234, 235);
      b.box(240, 7);
      b.arena();
    },
    traps: [
      { type: 'rock', x: 25 }, { type: 'rock', x: 29 },
      { type: 'flame', x: 60 }, { type: 'flame', x: 63, phase: 50 }, { type: 'flame', x: 66, phase: 100 },
      { type: 'rock', x: 88 }, { type: 'rock', x: 92 }, { type: 'rock', x: 98 }, { type: 'rock', x: 102 },
      { type: 'flame', x: 127 },
      { type: 'rock', x: 180 }, { type: 'rock', x: 184 }, { type: 'flame', x: 188 }, { type: 'flame', x: 192, phase: 75 },
      { type: 'rock', x: 222 }, { type: 'flame', x: 228, phase: 40 },
    ],
    enemies: [
      { type: 'walker', x: 15 }, { type: 'flyer', x: 22, row: 4 }, { type: 'hopper', x: 30 },
      { type: 'flyer', x: 45, row: 4 }, { type: 'flyer', x: 50, row: 3 }, { type: 'walker', x: 58 },
      { type: 'turret', x: 68 }, { type: 'walker', x: 75 }, { type: 'hopper', x: 86 }, { type: 'flyer', x: 98, row: 3 },
      { type: 'flyer', x: 110, row: 4 }, { type: 'hopper', x: 124 }, { type: 'turret', x: 130 }, { type: 'flyer', x: 146, row: 4 },
      { type: 'turret', x: 158 }, { type: 'turret', x: 163 }, { type: 'walker', x: 168 }, { type: 'flyer', x: 182, row: 4 },
      { type: 'hopper', x: 190 }, { type: 'walker', x: 195 }, { type: 'flyer', x: 204, row: 3 }, { type: 'walker', x: 218 },
      { type: 'hopper', x: 225 }, { type: 'turret', x: 232 }, { type: 'flyer', x: 238, row: 4 }, { type: 'walker', x: 245 },
      { type: 'hopper', x: 250 },
    ],
  },
];
