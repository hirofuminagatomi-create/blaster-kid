'use strict';
// ファミコン風のドット絵。文字1つ = 1ドット。'.' は透明。

const PAL = {
  K: '#000000', W: '#fcfcfc', S: '#fcbc94', R: '#d82800', B: '#0058f8',
  L: '#3cbcfc', D: '#0000a8', G: '#a8a8a8', g: '#606060', Y: '#f8b800',
  O: '#e45c10', P: '#9c44f0', N: '#00a800', n: '#005800', T: '#ac7c00',
  t: '#503000', C: '#00e8d8', M: '#f878f8',
};

function makeSprite(rows, override) {
  const pal = Object.assign({}, PAL, override || {});
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const col = pal[r[i]];
      if (r[i] !== '.' && col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
    }
  });
  return c;
}

function flipSprite(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  return c;
}

// 右向き・左向きの組を作る
function pair(rows, override) {
  const r = makeSprite(rows, override);
  return { r, l: flipSprite(r) };
}

// ---- 主人公(右向き) ----
const P_TOP = [
  '................',
  '.....KKKKK......',
  '....KRRRRRK.....',
  '...KRRRRRRRKK...',
  '...KKKSSSSKKKK..',
  '...KSSSSSKSK....',
  '...KSSSSSSSK....',
  '....KSSSSSK.....',
  '...KBBBBBBBK....',
  '..KSKBBBBBKGGGK.',
  '..KSKBBBBBKGGGK.',
  '...KKBBBBBKKKK..',
];
const P_LEGS = {
  idle: ['....KDDDDDK.....', '....KDK.KDK.....', '...KKKK.KKKK....', '................'],
  run1: ['....KDDDDDK.....', '...KDK...KDK....', '..KKK.....KKK...', '................'],
  run2: ['....KDDDDDK.....', '.....KDDDK......', '.....KKKKK......', '................'],
  jump: ['...KDDDDDDK.....', '...KDK..KDDK....', '...KK....KKK....', '................'],
};

// 武器ごとに服の色が変わる(ロックマン風)
const WEAPON_SUIT = {
  normal: { B: '#0058f8', D: '#0000a8' },
  rapid:  { B: '#e45c10', D: '#881400' },
  spread: { B: '#00a800', D: '#005800' },
  charge: { B: '#3cbcfc', D: '#0058f8' },
  heavy:  { B: '#d800cc', D: '#6844fc' },
  homing: { B: '#b8b800', D: '#5c5c00' },
  flash:  { B: '#fcfcfc', D: '#a4e4fc' },
};

const PLAYER_SPR = {};
for (const wid in WEAPON_SUIT) {
  PLAYER_SPR[wid] = {};
  for (const f in P_LEGS) PLAYER_SPR[wid][f] = pair(P_TOP.concat(P_LEGS[f]), WEAPON_SUIT[wid]);
}

// ---- 敵 ----
const WALKER_TOP = [
  '................',
  '................',
  '.....KKKKKK.....',
  '....KRRRRRRK....',
  '...KRRRRRRRRK...',
  '..KRRWWRRWWRRK..',
  '..KRRWKRRWKRRK..',
  '..KRRRRRRRRRRK..',
  '..KRRRKKKKRRRK..',
  '..KRRRRRRRRRRK..',
  '...KRRRRRRRRK...',
  '....KKKKKKKK....',
];
const ENEMY_SPR = {
  walker: [
    pair(WALKER_TOP.concat(['....KGK..KGK....', '...KGGK..KGGK...', '...KKKK..KKKK...', '................'])),
    pair(WALKER_TOP.concat(['.....KGKKGK.....', '....KGGKKGGK....', '....KKKKKKKK....', '................'])),
  ],
  hopper: [pair([
    '................',
    '................',
    '................',
    '...KKK....KKK...',
    '..KWWKK..KKWWK..',
    '..KWKNNKKNNKWK..',
    '..KNNNNNNNNNNK..',
    '.KNNNNNNNNNNNNK.',
    '.KNNKKKKKKKKNNK.',
    '.KNNNNNNNNNNNNK.',
    '..KNNNNNNNNNNK..',
    '...KKNNNNNNKK...',
    '..KNK.KKKK.KNK..',
    '.KNNK......KNNK.',
    '.KKKK......KKKK.',
    '................',
  ])],
  flyer: [
    pair([
      '................',
      '................',
      '................',
      'K.....KKKK.....K',
      'KK...KPPPPK...KK',
      'KPK.KPWPPWPK.KPK',
      'KPPKKPKPPKPKKPPK',
      '.KPPPPPPPPPPPPK.',
      '..KKPPPPPPPPKK..',
      '....KPPPPPPK....',
      '.....KPKKPK.....',
      '......K..K......',
    ]),
    pair([
      '................',
      '................',
      '................',
      '......KKKK......',
      '.....KPPPPK.....',
      '....KPWPPWPK....',
      '..KKKPKPPKPKKK..',
      '.KPPPPPPPPPPPPK.',
      'KPPKPPPPPPPPKPPK',
      'KPK.KPPPPPPK.KPK',
      'KK...KPKKPK...KK',
      'K.....K..K.....K',
    ]),
  ],
  turret: [pair([
    '................',
    '................',
    '................',
    '................',
    '.....KKKKKK.....',
    '....KGGGGGGK....',
    '...KGWWGGGGGK...',
    '...KGWGGGGGGK...',
    '..KGGGGRRGGGGK..',
    '..KGGGRYYRGGGK..',
    '..KGGGGRRGGGGK..',
    '.KKKKKKKKKKKKKK.',
    '.KggggggggggggK.',
    '.KgKgKgKgKgKgKK.',
    '.KggggggggggggK.',
    '.KKKKKKKKKKKKKK.',
  ])],
  boss: [pair([
    '....KKKKKKKK....',
    '...KOOOOOOOOK...',
    '..KOOYYOOYYOOK..',
    '..KOOYKOOYKOOK..',
    '..KOOOOOOOOOOK..',
    '..KOKKKKKKKKOK..',
    '..KOKWKWKWKWOK..',
    '...KKKKKKKKKK...',
    '.KGGKOOOOOOKGGK.',
    'KGGGKOOOOOOKGGGK',
    'KGGKKOOOOOOKKGGK',
    '.KK.KOOOOOOK.KK.',
    '....KOOKKOOK....',
    '...KGGK..KGGK...',
    '..KGGGK..KGGGK..',
    '..KKKKK..KKKKK..',
  ])],
};

// ---- ブロック ----
function makeTile(draw) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  draw(c.getContext('2d'));
  return c;
}
function px(x, color, a, b, w, h) { x.fillStyle = color; x.fillRect(a, b, w, h); }

const TILE_SPR = {
  dirt: makeTile(x => {
    px(x, '#ac7c00', 0, 0, 16, 16);
    [[2, 3], [9, 1], [12, 8], [5, 10], [1, 13], [10, 13], [7, 6]].forEach(([a, b]) => px(x, '#503000', a, b, 2, 1));
  }),
  grass: makeTile(x => {
    px(x, '#ac7c00', 0, 0, 16, 16);
    [[2, 9], [9, 7], [12, 12], [5, 13], [7, 11]].forEach(([a, b]) => px(x, '#503000', a, b, 2, 1));
    px(x, '#00a800', 0, 0, 16, 4);
    px(x, '#80d010', 0, 0, 16, 1);
    for (let i = 0; i < 16; i += 3) px(x, '#00a800', i, 4, 2, 1 + (i % 2));
    px(x, '#005800', 0, 5, 16, 0);
  }),
  brick: makeTile(x => {
    px(x, '#c84c0c', 0, 0, 16, 16);
    px(x, '#000000', 0, 7, 16, 1); px(x, '#000000', 0, 15, 16, 1);
    px(x, '#000000', 7, 0, 1, 7); px(x, '#000000', 15, 0, 1, 7);
    px(x, '#000000', 3, 8, 1, 7); px(x, '#000000', 11, 8, 1, 7);
    px(x, '#fc9838', 0, 0, 7, 1); px(x, '#fc9838', 8, 0, 7, 1);
  }),
  metal: makeTile(x => {
    px(x, '#7c7c7c', 0, 0, 16, 16);
    px(x, '#bcbcbc', 0, 0, 16, 1); px(x, '#bcbcbc', 0, 0, 1, 16);
    px(x, '#383838', 0, 15, 16, 1); px(x, '#383838', 15, 0, 1, 16);
    [[3, 3], [11, 3], [3, 11], [11, 11]].forEach(([a, b]) => { px(x, '#fcfcfc', a, b, 1, 1); px(x, '#383838', a + 1, b + 1, 1, 1); });
  }),
  box: makeSprite([
    'KKKKKKKKKKKKKKKK',
    'KYYYYYYYYYYYYYYK',
    'KYOYYYYYYYYYYOYK',
    'KYYYYKKKKKYYYYYK',
    'KYYYKKYYYKKYYYYK',
    'KYYYKKYYYKKYYYYK',
    'KYYYYYYYKKKYYYYK',
    'KYYYYYYKKYYYYYYK',
    'KYYYYYYKKYYYYYYK',
    'KYYYYYYYYYYYYYYK',
    'KYYYYYYKKYYYYYYK',
    'KYYYYYYKKYYYYYYK',
    'KYOYYYYYYYYYYOYK',
    'KYYYYYYYYYYYYYYK',
    'KOOOOOOOOOOOOOOK',
    'KKKKKKKKKKKKKKKK',
  ]),
  usedBox: makeSprite([
    'KKKKKKKKKKKKKKKK',
    'KTTTTTTTTTTTTTTK',
    'KTtTTTTTTTTTTtTK',
    'KTTTTTTTTTTTTTTK',
    'KTTTTTTTTTTTTTTK',
    'KTTTTTTTTTTTTTTK',
    'KTTTTTTTTTTTTTTK',
    'KTTTTTTTTTTTTTTK',
    'KTTTTTTTTTTTTTTK',
    'KTTTTTTTTTTTTTTK',
    'KTTTTTTTTTTTTTTK',
    'KTTTTTTTTTTTTTTK',
    'KTtTTTTTTTTTTtTK',
    'KTTTTTTTTTTTTTTK',
    'KttttttttttttttK',
    'KKKKKKKKKKKKKKKK',
  ]),
};

const CLOUD_SPR = makeSprite([
  '.........WWWW...........',
  '......WWWWWWWWW.........',
  '....WWWWWWWWWWWWWW......',
  '..WWWWWWWWWWWWWWWWWWW...',
  '.WWWWWWWWWWWWWWWWWWWWWW.',
  'WWWWWWWWWWWWWWWWWWWWWWWW',
  '.WWWWWWWWWWWWWWWWWWWWWW.',
  '...LLLLWWWWWWWWWWLLLL...',
]);

// 遠くの山(横に繰り返す帯)
function makeHills(w, h, color, f) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = color;
  for (let i = 0; i < w; i++) {
    const hh = Math.round(f(i));
    x.fillRect(i, h - hh, 1, hh);
  }
  return c;
}
const HILLS_FAR = makeHills(256, 80, '#3c6cd8', i => 40 + 26 * Math.sin(i / 256 * Math.PI * 2) + 10 * Math.sin(i / 256 * Math.PI * 6));
const HILLS_NEAR = makeHills(256, 56, '#2c9c3c', i => 20 + 18 * Math.abs(Math.sin(i / 256 * Math.PI * 3)));

// 武器アイテムの印(5x5)
const WEAPON_GLYPH = {
  normal: ['.....', '.....', '..W..', '.....', '.....'],
  rapid:  ['.....', '.....', 'W.W.W', '.....', '.....'],
  spread: ['....W', '.....', 'W...W', '.....', '....W'],
  charge: ['.WWW.', 'WWWWW', 'WWWWW', 'WWWWW', '.WWW.'],
  heavy:  ['.....', 'WWWWW', 'WWWWW', 'WWWWW', '.....'],
  homing: ['..WW.', '....W', 'W...W', '.W.W.', '..W..'],
};
