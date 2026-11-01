/* =========================================================
   LED 跑馬燈・彈幕
   純前端、零依賴，可直接放上 GitHub Pages
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const KEY = 'led-marquee.v1';

  /* ---------- 常數 ---------- */

  const FONTS = {
    sans: '-apple-system, "SF Pro Display", "PingFang TC", "Noto Sans TC", system-ui, sans-serif',
    round: '"SF Pro Rounded", ui-rounded, "PingFang TC", system-ui, sans-serif',
    mono: 'ui-monospace, "SF Mono", Menlo, monospace'
  };
  const FONT_LABEL = { sans: '黑體', round: '圓體', mono: '等寬' };
  const FONT_ORDER = ['sans', 'round', 'mono'];

  const INK_SWATCHES = ['#ff2d55', '#ff9500', '#ffd60a', '#30d158', '#32d5ff', '#7d7dff', '#ff5ea8', '#ffffff'];
  const BG_SWATCHES = ['#000000', '#0a0a12', '#0d1b2a', '#1a0508', '#f2f2f7'];

  const PRESETS = [
    { l: '生日快樂', t: '生日快樂 🎉\nHAPPY BIRTHDAY', c: '#ff2d55' },
    { l: '求婚', t: '嫁給我好嗎 💍\nWILL YOU MARRY ME', c: '#ff5ea8' },
    { l: '加油', t: '加油！你一定可以的 💪', c: '#ffd60a' },
    { l: '演唱會', t: '安可！安可！ENCORE 🎤', c: '#32d5ff' },
    { l: '接機', t: '歡迎回家 ❤️ WELCOME HOME', c: '#30d158' },
    { l: '我愛你', t: '我愛你 我愛你 我愛你 ❤️', c: '#ff2d55' }
  ];

  const DM_CHIPS = ['生日快樂 🎂', '太神啦！', '❤️❤️❤️', '安可！', '加油加油', '水啦', '666'];

  const DEFAULTS = {
    mode: 'marquee',              // marquee | danmaku
    text: '生日快樂 🎉\nHAPPY BIRTHDAY',
    color: '#ff2d55',
    bg: '#000000',
    size: 26,                     // 字級（短邊的 %）
    speed: 220,                   // 跑馬燈速度 px/s
    pitch: 9,                     // LED 點距 px
    brightness: 100,              // %
    glow: true,
    blink: false,
    font: 'sans',
    dmSpeed: 240,                 // 彈幕速度 px/s
    dmSize: 7,                    // 彈幕字級（短邊的 %）
    dmRandomColor: true,
    dmLoop: true,
    dmHistory: [],
    wake: true
  };

  /* ---------- 狀態 ---------- */

  const S = load();

  const refs = {
    stage: $('#stage'),
    panel: $('#panel'),
    led: $('#led'),
    track: $('#track'),
    dm: $('#danmaku'),
    dock: $('#dock'),
    hint: $('#hint'),
    toast: $('#toast')
  };

  const root = document.documentElement;
  let marqueeAnim = null;
  let lines = [' '];
  let saveTimer = 0;

  /* ---------- 設定存取 ---------- */

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      const p = JSON.parse(raw);
      const s = { ...DEFAULTS, ...p };
      if (!Array.isArray(s.dmHistory)) s.dmHistory = [];
      if (!FONTS[s.font]) s.font = DEFAULTS.font;
      return s;
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
    }, 200);
  }

  /* ---------- 顏色工具 ---------- */

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function hexToRgb(hex) {
    let h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function isLight(hex) {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
  }

  function sameColor(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  /* ---------- 套用外觀 ---------- */

  function applyTheme() {
    root.style.setProperty('--pitch', S.pitch + 'px');
    root.style.setProperty('--ink', S.color);
    root.style.setProperty('--bgc', S.bg);
    root.style.setProperty('--accent', S.color);
    root.style.setProperty('--dim', String((100 - S.brightness) / 100));
    root.style.setProperty('--font', FONTS[S.font] || FONTS.sans);
    root.style.setProperty('--unlit', isLight(S.bg) ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.055)');
    document.body.style.background = S.bg;
    refs.stage.style.background = S.bg;
    refs.panel.classList.toggle('has-glow', !!S.glow);
    refs.panel.classList.toggle('is-blink', !!S.blink);
  }

  /* ---------- 跑馬燈 ---------- */

  function normalizeLines(text) {
    const out = String(text == null ? '' : text)
      .replace(/\r/g, '')
      .split('\n')
      .map(t => (t.length ? t : ' '));
    return out.length ? out : [' '];
  }

  function buildMarquee() {
    lines = normalizeLines(S.text);
    const frag = document.createDocumentFragment();

    for (let i = 0; i < 2; i++) {
      const copy = document.createElement('div');
      copy.className = 'copy';
      if (i === 1) copy.setAttribute('aria-hidden', 'true');
      for (const t of lines) {
        const line = document.createElement('div');
        line.className = 'line';
        line.textContent = t;
        copy.appendChild(line);
      }
      frag.appendChild(copy);
    }

    refs.track.replaceChildren(frag);
    fitMarquee();
    startScroll();
  }

  function fitMarquee() {
    const w = refs.led.clientWidth;
    const h = refs.led.clientHeight;
    if (!w || !h) return;
    const n = Math.max(1, lines.length);
    const base = (S.size / 100) * Math.min(w, h);
    const cap = (h * 0.92) / (n * 1.16);
    const px = Math.max(10, Math.min(base, cap));
    root.style.setProperty('--mfont', px.toFixed(1) + 'px');
  }

  function startScroll() {
    if (marqueeAnim) { marqueeAnim.cancel(); marqueeAnim = null; }
    const copy = refs.track.firstElementChild;
    if (!copy) return;
    const dist = copy.getBoundingClientRect().width || 1;
    const speed = Math.max(20, S.speed);
    const dur = Math.max(600, (dist / speed) * 1000);

    marqueeAnim = refs.track.animate(
      [
        { transform: 'translate3d(0,0,0)' },
        { transform: `translate3d(${-dist}px,0,0)` }
      ],
      { duration: dur, iterations: Infinity, easing: 'linear' }
    );
  }

  let rebuildTimer = 0;
  function scheduleMarquee(delay = 60) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(buildMarquee, delay);
  }

  /* ---------- 彈幕 ---------- */

  const lanes = { pitch: 0, until: [] };

  function laneTop() {
    const stageH = refs.stage.clientHeight;
    const stageW = refs.stage.clientWidth;
    // 軌道高度固定用「設定的字級」算，才不會因為每則字級不同而重排、造成疊字
    const base = (S.dmSize / 100) * Math.min(stageW, stageH);
    const pitch = Math.max(18, base * 1.5);
    const count = Math.max(1, Math.floor(stageH / pitch));

    if (lanes.pitch !== pitch || lanes.until.length !== count) {
      lanes.pitch = pitch;
      lanes.until = new Array(count).fill(0);
    }

    const now = performance.now();
    const free = [];
    for (let i = 0; i < count; i++) if (lanes.until[i] <= now) free.push(i);

    let idx;
    if (free.length) {
      idx = free[(Math.random() * free.length) | 0];
    } else {
      idx = 0;
      for (let i = 1; i < count; i++) if (lanes.until[i] < lanes.until[idx]) idx = i;
    }

    return { idx, top: idx * pitch + pitch * 0.18 };
  }

  function emitDanmaku(text, opt = {}) {
    const msg = String(text == null ? '' : text).trim();
    if (!msg) return;

    const w = refs.stage.clientWidth;
    const h = refs.stage.clientHeight;
    if (!w || !h) return;

    const el = document.createElement('div');
    el.className = 'dm';
    el.textContent = msg;

    const base = (S.dmSize / 100) * Math.min(w, h);
    const size = opt.size || base * (0.92 + Math.random() * 0.2);
    el.style.fontSize = size.toFixed(1) + 'px';
    el.style.color = opt.color || (S.dmRandomColor ? pick(INK_SWATCHES) : S.color);

    refs.dm.appendChild(el);

    const elW = el.offsetWidth;
    const lane = laneTop();
    const jitter = (Math.random() - 0.5) * lanes.pitch * 0.14;
    el.style.top = Math.max(2, lane.top + jitter).toFixed(1) + 'px';

    const speed = Math.max(40, (opt.speed || S.dmSpeed) * (0.9 + Math.random() * 0.2));
    const startX = w + 24;
    const endX = -elW - 24;
    const dur = Math.max(1200, ((startX - endX) / speed) * 1000);

    // 這一條要等尾巴完全進場，才允許下一條進同一條軌道
    lanes.until[lane.idx] = performance.now() + (elW / speed) * 1000 + 240;

    const anim = el.animate(
      [
        { transform: `translate3d(${startX}px,0,0)` },
        { transform: `translate3d(${endX}px,0,0)` }
      ],
      { duration: dur, easing: 'linear', fill: 'forwards' }
    );

    anim.onfinish = () => el.remove();
    // 保險：動畫事件沒觸發也要清掉，避免節點累積
    setTimeout(() => el.remove(), dur + 1500);
  }

  let loopTimer = 0;
  function startLoop() {
    clearInterval(loopTimer);
    loopTimer = setInterval(() => {
      if (S.mode !== 'danmaku' || !S.dmLoop) return;
      if (document.visibilityState !== 'visible') return;
      if (refs.dm.childElementCount > 18) return;
      if (!S.dmHistory.length) return;
      emitDanmaku(pick(S.dmHistory));
    }, 1700);
  }

  function sendDanmaku() {
    const input = $('#dmInput');
    const v = input.value.trim();
    if (!v) return;
    emitDanmaku(v);
    input.value = '';
    if (!S.dmHistory.includes(v)) {
      S.dmHistory.push(v);
      if (S.dmHistory.length > 40) S.dmHistory.shift();
      save();
    }
    input.focus();
  }

  /* ---------- Toast ---------- */

  let toastTimer = 0;
  function toast(msg, ms = 2800) {
    refs.toast.textContent = msg;
    refs.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => refs.toast.classList.remove('is-on'), ms);
  }

  /* ---------- 控制列 ---------- */

  function setDock(show) {
    refs.dock.classList.toggle('is-hidden', !show);
    updateGap();
    if (!show) showHint();
  }

  function updateGap() {
    const hidden = refs.dock.classList.contains('is-hidden');
    const h = hidden ? 0 : refs.dock.offsetHeight + 18;
    root.style.setProperty('--bottom-gap', Math.round(h) + 'px');
    setTimeout(fitMarquee, 60);
  }

  let hintTimer = 0;
  function showHint() {
    clearTimeout(hintTimer);
    refs.hint.hidden = false;
    refs.hint.style.animation = 'none';
    void refs.hint.offsetWidth;
    refs.hint.style.animation = '';
    hintTimer = setTimeout(() => { refs.hint.hidden = true; }, 2700);
  }

  function setMode(mode) {
    S.mode = mode;
    document.body.dataset.mode = mode;
    $$('.seg__btn').forEach(b => b.classList.toggle('is-active', b.dataset.mode === mode));
    $('#paneMarquee').hidden = mode !== 'marquee';
    $('#paneDanmaku').hidden = mode !== 'danmaku';

    if (mode === 'danmaku') {
      if (!refs.dm.childElementCount) {
        const seed = (S.dmHistory.length ? S.dmHistory : DM_CHIPS).slice(0, 4);
        seed.forEach((t, i) => setTimeout(() => emitDanmaku(t), i * 300));
      }
    } else {
      scheduleMarquee(0);
    }
    updateGap();
    save();
  }

  /* ---------- 螢幕常亮 ---------- */

  let wakeLock = null;

  async function wakeOn() {
    if (!S.wake) return;
    try {
      if (!('wakeLock' in navigator) || wakeLock) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {
      /* 不支援或被系統拒絕，忽略 */
    }
  }

  async function wakeOff() {
    try { if (wakeLock) await wakeLock.release(); } catch {}
    wakeLock = null;
  }

  /* ---------- UI 建立 ---------- */

  function markSwatch(host, color) {
    $$('.sw', host).forEach(b => b.classList.toggle('is-active', sameColor(b.dataset.color, color)));
  }

  function buildSwatches(host, colors, current, onPick) {
    host.replaceChildren();
    for (const c of colors) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw';
      b.dataset.color = c;
      b.style.background = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', () => onPick(c));
      host.appendChild(b);
    }
    markSwatch(host, current);
  }

  function bindRange(id, labelId, key, after) {
    const input = $('#' + id);
    const label = labelId ? $('#' + labelId) : null;
    input.value = S[key];
    if (label) label.textContent = S[key];

    input.addEventListener('input', () => {
      S[key] = Number(input.value);
      if (label) label.textContent = input.value;
      if (after) after();
      save();
    });
  }

  function bindToggle(id, key, after) {
    const btn = $('#' + id);
    const sync = () => btn.dataset.on = S[key] ? 'true' : 'false';
    sync();
    btn.addEventListener('click', () => {
      S[key] = !S[key];
      sync();
      if (after) after();
      save();
    });
  }

  /* ---------- 綁定事件 ---------- */

  function bindUI() {
    /* 模式 */
    $$('.seg__btn').forEach(b => {
      b.addEventListener('click', () => setMode(b.dataset.mode));
    });

    /* 控制列顯示 / 隱藏 */
    $('#btnHide').addEventListener('click', () => setDock(false));
    refs.stage.addEventListener('click', () => {
      if (Date.now() - lastPinch < 500) return;
      setDock(refs.dock.classList.contains('is-hidden'));
    });

    /* 全螢幕 */
    $('#btnFull').addEventListener('click', async () => {
      const d = document;
      if (d.fullscreenElement || d.webkitFullscreenElement) {
        try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch {}
        return;
      }
      const el = d.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!req) {
        toast('iPhone 的 Safari 不支援網頁全螢幕，請用「分享 → 加入主畫面」');
        return;
      }
      try { await req.call(el); } catch { toast('無法進入全螢幕'); }
    });

    /* 跑馬燈文字 */
    $('#txt').addEventListener('input', e => {
      S.text = e.target.value;
      scheduleMarquee(80);
      save();
    });

    /* 顏色 / 背景 */
    buildSwatches($('#swatchesInk'), INK_SWATCHES, S.color, c => {
      S.color = c;
      $('#color').value = c;
      markSwatch($('#swatchesInk'), c);
      applyTheme();
      save();
    });

    buildSwatches($('#swatchesBg'), BG_SWATCHES, S.bg, c => {
      S.bg = c;
      markSwatch($('#swatchesBg'), c);
      applyTheme();
      save();
    });

    $('#color').addEventListener('input', e => {
      S.color = e.target.value;
      markSwatch($('#swatchesInk'), S.color);
      applyTheme();
      save();
    });

    /* 滑桿 */
    bindRange('rSize', 'vSize', 'size', () => { fitMarquee(); });
    bindRange('rSpeed', 'vSpeed', 'speed', () => { if (S.mode === 'marquee') startScroll(); });
    bindRange('rBright', 'vBright', 'brightness', applyTheme);
    bindRange('rPitch', 'vPitch', 'pitch', applyTheme);
    bindRange('rDmSpeed', 'vDmSpeed', 'dmSpeed');
    bindRange('rDmSize', 'vDmSize', 'dmSize');

    /* 開關 */
    bindToggle('tGlow', 'glow', applyTheme);
    bindToggle('tBlink', 'blink', applyTheme);
    bindToggle('tWake', 'wake', () => { S.wake ? wakeOn() : wakeOff(); });
    bindToggle('tDmRandom', 'dmRandomColor');
    bindToggle('tDmLoop', 'dmLoop');

    /* 字體切換 */
    const fontBtn = $('#tFont');
    const syncFont = () => { fontBtn.textContent = '字體：' + FONT_LABEL[S.font]; };
    syncFont();
    fontBtn.addEventListener('click', () => {
      S.font = FONT_ORDER[(FONT_ORDER.indexOf(S.font) + 1) % FONT_ORDER.length];
      syncFont();
      applyTheme();
      scheduleMarquee(0);
      save();
    });

    /* 情境範本 */
    const presetHost = $('#presets');
    for (const p of PRESETS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = p.l;
      b.addEventListener('click', () => {
        S.text = p.t;
        S.color = p.c;
        $('#txt').value = p.t;
        $('#color').value = p.c;
        markSwatch($('#swatchesInk'), p.c);
        applyTheme();
        buildMarquee();
        setDock(false);
        save();
      });
      presetHost.appendChild(b);
    }

    /* 彈幕 */
    $('#dmSend').addEventListener('click', sendDanmaku);
    $('#dmInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); sendDanmaku(); }
    });

    const chipHost = $('#dmChips');
    for (const t of DM_CHIPS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = t;
      b.addEventListener('click', () => {
        emitDanmaku(t);
        if (!S.dmHistory.includes(t)) {
          S.dmHistory.push(t);
          if (S.dmHistory.length > 40) S.dmHistory.shift();
          save();
        }
      });
      chipHost.appendChild(b);
    }

    $('#tDmClear').addEventListener('click', () => {
      refs.dm.replaceChildren();
      lanes.until = lanes.until.map(() => 0);
    });

    /* 雙指縮放字級 */
    refs.stage.addEventListener('touchstart', e => {
      if (e.touches.length === 2) pinch = { d: touchDist(e.touches), size: S.size };
    }, { passive: true });

    refs.stage.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || !pinch) return;
      e.preventDefault();
      const ratio = touchDist(e.touches) / Math.max(1, pinch.d);
      const next = Math.max(6, Math.min(60, Math.round(pinch.size * ratio)));
      if (next !== S.size) {
        S.size = next;
        $('#rSize').value = next;
        $('#vSize').textContent = next;
        fitMarquee();
      }
      lastPinch = Date.now();
    }, { passive: false });

    refs.stage.addEventListener('touchend', () => {
      if (pinch) { pinch = null; lastPinch = Date.now(); save(); }
    });

    /* 尺寸變化 */
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => fitMarquee()).observe(refs.led);
      new ResizeObserver(() => updateGap()).observe(refs.dock);
    }
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { buildMarquee(); }, 400);
    });
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitMarquee, 160);
    });

    /* 回到前景時重新取得螢幕常亮 */
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wakeOn();
    });
  }

  let pinch = null;
  let lastPinch = 0;
  let resizeTimer = 0;

  function touchDist(touches) {
    const a = touches[0], b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  /* ---------- 初始化 ---------- */

  function init() {
    applyTheme();
    bindUI();

    $('#txt').value = S.text;
    $('#color').value = S.color;
    markSwatch($('#swatchesInk'), S.color);
    markSwatch($('#swatchesBg'), S.bg);

    buildMarquee();
    setMode(S.mode);
    if (!S.dmHistory.length) S.dmHistory = DM_CHIPS.slice(0, 4);
    startLoop();
    wakeOn();

    /* Service Worker：離線可用 */
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
