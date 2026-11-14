'use strict';
// スマホ・タブレット用の画面ボタン。指を置いたまま滑らせても効くように、ボタンごとに指を追いかける。

(() => {
  const pad = document.getElementById('pad');
  const show = () => document.body.classList.add('touch');
  if (matchMedia('(pointer: coarse)').matches) show();
  addEventListener('touchstart', show, { passive: true });

  // 十字キー: 押している位置の左半分なら左、右半分なら右
  const dpad = document.getElementById('dpad');
  const dpadPointers = new Map();
  function updateDpad() {
    let l = false, r = false;
    const rect = dpad.getBoundingClientRect();
    for (const x of dpadPointers.values()) { if (x < rect.left + rect.width / 2) l = true; else r = true; }
    virtualKey('left', l); virtualKey('right', r);
    dpad.classList.toggle('l', l); dpad.classList.toggle('r', r);
  }
  dpad.addEventListener('pointerdown', e => { dpad.setPointerCapture(e.pointerId); dpadPointers.set(e.pointerId, e.clientX); updateDpad(); e.preventDefault(); });
  dpad.addEventListener('pointermove', e => { if (dpadPointers.has(e.pointerId)) { dpadPointers.set(e.pointerId, e.clientX); updateDpad(); } });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    dpad.addEventListener(t, e => { if (dpadPointers.delete(e.pointerId)) updateDpad(); });
  }

  // ジャンプ・うつ・ポーズ
  for (const btn of pad.querySelectorAll('[data-key]')) {
    const k = btn.dataset.key, held = new Set();
    btn.addEventListener('pointerdown', e => { btn.setPointerCapture(e.pointerId); held.add(e.pointerId); virtualKey(k, true); btn.classList.add('on'); e.preventDefault(); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      btn.addEventListener(t, e => { if (held.delete(e.pointerId) && held.size === 0) { virtualKey(k, false); btn.classList.remove('on'); } });
    }
  }

  // タイトル・ゲームオーバー・クリア画面は、ゲーム画面をタップで進む
  const screenEl = document.getElementById('screen');
  screenEl.addEventListener('pointerdown', e => {
    if (window.__game.state === 'play') return;
    virtualKey('start', true);
    setTimeout(() => virtualKey('start', false), 50);
    e.preventDefault();
  });

  // 長押しでメニューが出たり、ダブルタップで拡大したりしないように
  addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
})();
