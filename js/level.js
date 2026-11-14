'use strict';
// ステージ1。1マス = 16ドット。縦12マス(下の2マスが地面)。

const LEVEL_W = 232, LEVEL_H = 12;
const T_AIR = 0, T_GROUND = 1, T_BRICK = 2, T_METAL = 3, T_BOX = 4, T_USED = 5;
const ARENA_L = 212;               // ここから右がボス部屋(20マス = 画面1枚)
const CHECKPOINTS = [93, 203];     // 中間地点(マス番号)

function buildMap() {
  const m = [];
  for (let y = 0; y < LEVEL_H; y++) m.push(new Array(LEVEL_W).fill(T_AIR));
  const set = (x, y, t) => { if (x >= 0 && x < LEVEL_W && y >= 0 && y < LEVEL_H) m[y][x] = t; };
  const ground = (x0, x1, top) => { for (let x = x0; x <= x1; x++) for (let y = 0; y < LEVEL_H; y++) set(x, y, y >= top ? T_GROUND : T_AIR); };
  const pit = (x0, x1) => { for (let x = x0; x <= x1; x++) for (let y = 0; y < LEVEL_H; y++) set(x, y, T_AIR); };
  const plat = (x0, x1, y, t = T_BRICK) => { for (let x = x0; x <= x1; x++) set(x, y, t); };

  ground(0, LEVEL_W - 1, 10);

  // A: はじまり
  set(10, 7, T_BOX);
  plat(22, 25, 7);

  // B: 穴と高台
  pit(37, 39);
  ground(44, 52, 8);
  set(48, 4, T_BOX);

  // C: 階段状の足場
  pit(56, 58);
  plat(63, 65, 8);
  plat(68, 70, 6);

  // D: 大きな穴を足場で渡る(チェックポイント1の先)
  pit(99, 113);
  plat(101, 103, 8);
  plat(106, 108, 7);
  plat(111, 112, 8);
  set(118, 7, T_BOX);

  // E: 鉄の壁と高台
  ground(136, 150, 7);
  for (let y = 7; y < 10; y++) set(136, y, T_METAL);
  set(142, 3, T_BOX);

  // F: 小さな穴が続く
  pit(168, 170);
  pit(176, 178);
  set(185, 7, T_BOX);

  // ボス部屋: 床は鉄、右端は壁
  for (let x = ARENA_L; x < LEVEL_W; x++) { set(x, 10, T_METAL); set(x, 11, T_METAL); }
  for (let y = 0; y < LEVEL_H; y++) set(LEVEL_W - 1, y, T_METAL);

  return m;
}

// 敵の配置(x はマス番号。flyer だけ row で高さを決める)
const ENEMY_SPAWNS = [
  { type: 'walker', x: 18 }, { type: 'walker', x: 27 },
  { type: 'flyer', x: 46, row: 5 }, { type: 'walker', x: 50 },
  { type: 'hopper', x: 75 }, { type: 'turret', x: 84 }, { type: 'walker', x: 88 },
  { type: 'flyer', x: 104, row: 4 }, { type: 'flyer', x: 110, row: 3 },
  { type: 'walker', x: 121 }, { type: 'walker', x: 126 }, { type: 'hopper', x: 129 },
  { type: 'turret', x: 145 }, { type: 'hopper', x: 156 }, { type: 'walker', x: 160 }, { type: 'flyer', x: 163, row: 4 },
  { type: 'flyer', x: 173, row: 5 }, { type: 'flyer', x: 181, row: 4 }, { type: 'turret', x: 188 },
  { type: 'walker', x: 192 }, { type: 'hopper', x: 197 },
];
