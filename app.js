/* =========================================================
   跑馬燈・LED 跑馬燈
   純前端、零依賴，可直接放上 GitHub Pages
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const KEY = 'led-marquee.v2';
  const OLD_KEY = 'led-marquee.v1';

  /* ---------------- 常數 ---------------- */

  const FONTS = [
    { id: 'sans', label: '黑體', css: '-apple-system, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif' },
    { id: 'song', label: '宋體', css: '"Songti TC", "STSong", "SimSun", "Times New Roman", serif' },
    { id: 'round', label: '圓體', css: '"Yuanti TC", ui-rounded, "SF Pro Rounded", "PingFang TC", "Microsoft JhengHei", sans-serif' },
    { id: 'kai', label: '楷體', css: '"Kaiti TC", "STKaiti", "DFKai-SB", "BiauKai", serif' },
    { id: 'mono', label: '等寬', css: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' }
  ];

  const EFFECTS = [
    { id: 'marquee', name: '跑馬燈', sub: '經典' },
    { id: 'neon', name: '霓虹文字', sub: '酷炫' },
    { id: 'typer', name: '逐字顯示', sub: '特效' },
    { id: 'switch', name: '切換文字', sub: '震撼' },
    { id: 'vertical', name: '上下滾動', sub: '大字體' }
  ];

  const INK_COLORS = ['#ffffff', '#a6e22e', '#3cf2ff', '#ff2d3a', '#ff2dff'];
  const BG_COLORS = ['#000000', '#5d6b52', '#a6e22e', '#3cf2ff', '#ff2d3a'];

  const PREVIEWS = {
    neon: { text: '霓虹燈', cls: 'pv--neon' },
    typer: { text: 'LED 跑', cls: 'pv--typer' },
    switch: { text: '我等你', cls: 'pv--switch' },
    vertical: { text: '大字體\n上下滾動', cls: 'pv--vert' }
  };

  const DEFAULTS = {
    text: 'LED 跑馬燈',
    effect: 'marquee',
    ink: '#ff2d55',
    bg: '#0e0e10',
    font: 'sans',
    bold: true,
    speed: 42,
    size: 46,
    blink: false,
    mirror: false,
    paused: false,
    dots: false,
    brightness: 100,
    wake: true,
    scenes: []
  };

  /* ---------------- 狀態 ---------------- */

  let S = load();

  const ui = {
    app: $('#app'),
    heroCard: $('#heroCard'),
    heroTrack: $('#heroTrack'),
    heroA: $('#heroA'),
    heroB: $('#heroB'),
    heroEdit: $('#heroEdit'),
    fxList: $('#fxList'),
    tabbar: $('#tabbar'),
    play: $('#play'),
    stage: $('#stage'),
    render: $('#render'),
    dim: $('#dim'),
    sheetWrap: $('#sheetWrap'),
    sheet: $('#sheet'),
    sheetTitle: $('#sheetTitle'),
    sheetClose: $('#sheetClose'),
    sheetBackdrop: $('#sheetBackdrop'),
    fontChips: $('#fontChips'),
    rSpeed: $('#rSpeed'),
    rSize: $('#rSize'),
    inkColors: $('#inkColors'),
    bgColors: $('#bgColors'),
    tools: $('#tools'),
    playBack: $('#playBack'),
    playSave: $('#playSave'),
    sceneList: $('#sceneList'),
    sceneEmpty: $('#sceneEmpty'),
    modal: $('#textModal'),
    textInput: $('#textInput'),
    toast: $('#toast')
  };

  let heroAnim = null;
  let anim = null;
  let animBaseSpeed = 1;
  let sheetOpen = false;
  let effToken = 0;
  let typeTimer = 0;
  let switchTimer = 0;
  let saveTimer = 0;
  let toastTimer = 0;

  /* ---------------- 工具函式 ---------------- */

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  const fontOf = id => FONTS.find(f => f.id === id) || FONTS[0];
  const fontCss = id => fontOf(id).css;

  function pxPerSec() {
    return 55 + S.speed * 5.5;
  }

  function sizePx() {
    const w = ui.stage.clientWidth || window.innerWidth;
    const h = ui.stage.clientHeight || window.innerHeight;
    return Math.min(w, h) * (0.08 + (S.size / 100) * 0.55);
  }

  // 依實際字寬把文字折行（上下滾動用）
  function wrapLines(src, px, maxW) {
    const probe = el('div', 'line');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'pre';
    probe.style.fontSize = px + 'px';
    ui.render.appendChild(probe);

    const out = [];
    for (const original of src) {
      let cur = '';
      for (const ch of original) {
        probe.textContent = cur + ch;
        if (probe.getBoundingClientRect().width > maxW && cur.length) {
          out.push(cur);
          cur = ch;
        } else {
          cur += ch;
        }
      }
      out.push(cur.length ? cur : ' ');
    }
    probe.remove();
    return out;
  }

  function textLines() {
    const raw = String(S.text == null ? '' : S.text).replace(/\r/g, '');
    const out = raw.split('\n').map(t => (t.length ? t : ' '));
    return out.length ? out : [' '];
  }

  function isDark(hex) {
    const h = hex.replace('#', '');
    if (h.length !== 6) return true;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 30;
  }

  function toast(msg, ms = 2000) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), ms);
  }

  /* ---------------- 設定存取 ---------------- */

  function load() {
    let s = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        s = { ...DEFAULTS, ...p };
      } else {
        // 從上一個版本搬過來（只搬文字與顏色）
        const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
        if (old) {
          s.text = old.text || s.text;
          s.ink = old.color || s.ink;
          s.bg = old.bg || s.bg;
          s.bold = true;
        }
      }
    } catch {}
    if (!Array.isArray(s.scenes)) s.scenes = [];
    if (!FONTS.some(f => f.id === s.font)) s.font = DEFAULTS.font;
    if (!EFFECTS.some(e => e.id === s.effect)) s.effect = DEFAULTS.effect;
    s.speed = clamp(Number(s.speed) || 0, 0, 100);
    s.size = clamp(Number(s.size) || 0, 0, 100);
    s.brightness = clamp(Number(s.brightness) || 100, 30, 100);
    return s;
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
    }, 180);
  }

  /* ---------------- 首頁 ---------------- */

  function heroBg() {
    return isDark(S.bg) ? '#161618' : S.bg;
  }

  function renderHero() {
    if (heroAnim) { try { heroAnim.cancel(); } catch {} heroAnim = null; }

    const text = textLines().join('   ');
    const px = clamp((ui.heroCard.clientHeight || 188) * 0.46, 24, 96);

    ui.heroCard.style.background = heroBg();
    for (const n of [ui.heroA, ui.heroB]) {
      n.textContent = text;
      n.style.color = S.ink;
      n.style.fontFamily = fontCss(S.font);
      n.style.fontWeight = S.bold ? 700 : 400;
      n.style.fontSize = px + 'px';
    }

    const dist = ui.heroA.getBoundingClientRect().width || 1;
    const speed = Math.max(45, pxPerSec() * 0.5);
    heroAnim = ui.heroTrack.animate(
      [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-dist}px,0,0)` }],
      { duration: Math.max(1400, (dist / speed) * 1000), iterations: Infinity, easing: 'linear' }
    );
  }

  function buildEffectList() {
    ui.fxList.replaceChildren();
    for (const fx of EFFECTS) {
      if (fx.id === 'marquee') continue;
      const pv = PREVIEWS[fx.id] || { text: fx.name, cls: '' };

      const btn = el('button', 'fx');
      btn.type = 'button';
      btn.dataset.fx = fx.id;

      const info = el('span', 'fx__info');
      info.append(el('span', 'fx__name', fx.name), el('span', 'fx__sub', fx.sub));

      const preview = el('span', 'fx__preview');
      preview.append(el('span', 'pv ' + pv.cls, pv.text));

      const chev = el('span', 'fx__chev', '›');

      btn.append(info, preview, chev);
      btn.addEventListener('click', () => openPlay(fx.id));
      ui.fxList.appendChild(btn);
    }
  }

  /* ---------------- 場景 ---------------- */

  function renderScenes() {
    ui.sceneList.replaceChildren();
    ui.sceneEmpty.hidden = S.scenes.length > 0;

    for (const sc of S.scenes) {
      const row = el('div', 'scene');

      const main = el('button', 'scene__main');
      const dot = el('span', 'scene__dot');
      dot.style.background = sc.ink || '#ff2d55';
      dot.style.color = sc.ink || '#ff2d55';

      const name = el('span', 'scene__text', sc.name || sc.text || '場景');
      const meta = el('span', 'scene__meta',
        (EFFECTS.find(e => e.id === sc.effect) || EFFECTS[0]).name + ' · ' + fontOf(sc.font).label);

      main.append(dot, name, meta);
      main.addEventListener('click', () => applyScene(sc));

      const del = el('button', 'scene__del', '✕');
      del.type = 'button';
      del.setAttribute('aria-label', '刪除場景');
      del.addEventListener('click', () => {
        S.scenes = S.scenes.filter(x => x.id !== sc.id);
        save();
        renderScenes();
      });

      row.append(main, del);
      ui.sceneList.appendChild(row);
    }
  }

  function applyScene(sc) {
    S.text = sc.text;
    S.effect = sc.effect;
    S.ink = sc.ink;
    S.bg = sc.bg;
    S.font = sc.font;
    S.bold = sc.bold !== false;
    S.speed = clamp(Number(sc.speed) || 42, 0, 100);
    S.size = clamp(Number(sc.size) || 46, 0, 100);
    save();
    openPlay(sc.effect);
  }

  function saveScene() {
    const name = (String(S.text).split('\n')[0] || '場景').slice(0, 14);
    S.scenes.unshift({
      id: Date.now(),
      name,
      text: S.text,
      effect: S.effect,
      ink: S.ink,
      bg: S.bg,
      font: S.font,
      bold: S.bold,
      speed: S.speed,
      size: S.size
    });
    S.scenes = S.scenes.slice(0, 20);
    save();
    renderScenes();
    toast('已儲存為場景');
  }

  /* ---------------- 播放畫面 ---------------- */

  function applyStage() {
    ui.stage.style.setProperty('--ink', S.ink);
    ui.stage.style.setProperty('--play-bg', S.bg);
    ui.stage.style.setProperty('--play-font', fontCss(S.font));
    ui.stage.style.setProperty('--weight', S.bold ? 700 : 400);
    ui.stage.classList.toggle('is-blink', !!S.blink);
    ui.stage.classList.toggle('is-mirror', !!S.mirror);
    ui.stage.classList.toggle('is-dots', !!S.dots);
    ui.dim.style.opacity = String((100 - S.brightness) / 100);
  }

  function openPlay(effectId, opts = {}) {
    if (effectId && EFFECTS.some(e => e.id === effectId)) S.effect = effectId;
    save();

    ui.app.hidden = true;
    ui.play.hidden = false;
    ui.play.classList.remove('is-clean');

    // 讓瀏覽器先算好尺寸（不要用 rAF，背景分頁不會執行）
    void ui.play.offsetWidth;

    const open = opts.sheet !== false;
    setSheet(open, true);
    renderEffect();
    if (open && opts.focus) focusSection(opts.focus);
  }

  function closePlay() {
    stopEffect();
    ui.play.hidden = true;
    ui.app.hidden = false;
    renderHero();
    renderScenes();
    showScreen('home');
  }

  function setSheet(open, silent) {
    sheetOpen = open;
    ui.sheetWrap.classList.toggle('is-open', open);
    ui.play.classList.toggle('is-clean', !open);
    updateLift();
    if (open) syncSheet();
    if (!silent && !ui.play.hidden) renderEffect();
  }

  // 面板打開時把「舞台」縮到面板上方，文字才不會被蓋住
  function updateLift() {
    const full = ui.play.clientHeight || window.innerHeight || 700;
    const h = sheetOpen ? Math.min(ui.sheet.offsetHeight, full * 0.7) : 0;
    ui.stage.style.setProperty('--lift', Math.round(h) + 'px');
  }

  function focusSection(kind) {
    const map = { font: '#fontChips', speed: '#rowSpeed', ink: '#labelInk', bg: '#labelBg' };
    const target = $(map[kind] || '');
    if (!target) return;
    setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 360);
  }

  /* ---------------- 效果渲染 ---------------- */

  function stopEffect() {
    effToken++;
    if (anim) { try { anim.cancel(); } catch {} anim = null; }
    clearTimeout(typeTimer);
    clearInterval(switchTimer);
    typeTimer = 0;
    switchTimer = 0;
    ui.render.className = 'render';
    ui.render.replaceChildren();
  }

  function renderEffect() {
    stopEffect();
    applyStage();

    const token = effToken;
    const fx = S.effect;

    if (fx === 'marquee') renderMarquee(token);
    else if (fx === 'vertical') renderVertical(token);
    else if (fx === 'neon') renderNeon();
    else if (fx === 'typer') renderTyper(token);
    else if (fx === 'switch') renderSwitch(token);
    else renderMarquee(token);

    applyPause();
    syncSheet();
  }

  function fitBox(wrap) {
    const maxW = ui.stage.clientWidth * 0.93;
    const maxH = ui.stage.clientHeight * 0.92;
    const nodes = $$('.line', wrap);
    let px = parseFloat(nodes[0]?.style.fontSize || '40') || 40;

    for (let i = 0; i < 8; i++) {
      const r = wrap.getBoundingClientRect();
      const k = Math.min(maxW / (r.width || 1), maxH / (r.height || 1), 1);
      if (k > 0.995) break;
      px = Math.max(8, px * k * 0.97);
      nodes.forEach(n => { n.style.fontSize = px + 'px'; });
    }
  }

  function renderMarquee(token) {
    const lines = textLines();
    const n = lines.length;
    const h = ui.stage.clientHeight;
    const fs = Math.max(10, Math.min(sizePx(), (h * 0.9) / (n * 1.18)));

    const track = el('div', 'mq');
    for (let i = 0; i < 2; i++) {
      const copy = el('div', 'mq__copy');
      if (i === 1) copy.setAttribute('aria-hidden', 'true');
      for (const t of lines) {
        const d = el('div', 'line', t);
        d.style.fontSize = fs + 'px';
        copy.appendChild(d);
      }
      track.appendChild(copy);
    }

    ui.render.className = 'render';
    ui.render.appendChild(track);

    const copy = track.firstElementChild;
    const dist = copy.getBoundingClientRect().width || 1;
    animBaseSpeed = pxPerSec();
    anim = track.animate(
      [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(${-dist}px,0,0)` }],
      { duration: Math.max(600, (dist / animBaseSpeed) * 1000), iterations: Infinity, easing: 'linear' }
    );
    if (token !== effToken) return;
  }

  function renderVertical(token) {
    const w = ui.stage.clientWidth || window.innerWidth;
    const px = Math.min(sizePx() * 1.2, w * 0.9);
    const wrapped = wrapLines(textLines(), px, w * 0.9);

    const wrap = el('div', 'vt');
    for (let i = 0; i < 2; i++) {
      const copy = el('div', 'vt__copy');
      if (i === 1) copy.setAttribute('aria-hidden', 'true');
      for (const t of wrapped) {
        const d = el('div', 'line', t);
        d.style.fontSize = px + 'px';
        copy.appendChild(d);
      }
      wrap.appendChild(copy);
    }

    ui.render.className = 'render';
    ui.render.appendChild(wrap);

    const copy = wrap.firstElementChild;
    const dist = copy.getBoundingClientRect().height || 1;
    animBaseSpeed = pxPerSec();
    anim = wrap.animate(
      [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(0,${-dist}px,0)` }],
      { duration: Math.max(900, (dist / animBaseSpeed) * 1000), iterations: Infinity, easing: 'linear' }
    );
    if (token !== effToken) return;
    applyPause();
  }

  function renderNeon() {
    const fs = Math.max(12, sizePx() * 0.78);
    const wrap = el('div', 'solo-wrap');
    for (const t of textLines()) {
      const d = el('div', 'line solo neon', t);
      d.style.fontSize = fs + 'px';
      wrap.appendChild(d);
    }
    ui.render.className = 'render';
    ui.render.appendChild(wrap);
    fitBox(wrap);
  }

  function renderTyper(token) {
    const full = textLines().join(' ');
    const fs = Math.max(12, sizePx() * 0.8);

    const wrap = el('div', 'solo-wrap');
    const line = el('div', 'line solo', full);
    line.style.fontSize = fs + 'px';
    wrap.appendChild(line);
    ui.render.className = 'render';
    ui.render.appendChild(wrap);

    fitBox(wrap);
    const finalPx = parseFloat(line.style.fontSize) || fs;
    line.style.fontSize = finalPx + 'px';

    const interval = () => Math.round(190 - S.speed * 1.55);
    let i = 0;
    line.textContent = '';

    const tick = () => {
      if (token !== effToken) return;
      if (!S.paused) {
        i++;
        line.textContent = full.slice(0, i);
        if (i >= full.length) {
          typeTimer = setTimeout(() => {
            if (token !== effToken) return;
            i = 0;
            line.textContent = '';
            tick();
          }, 1500);
          return;
        }
      }
      typeTimer = setTimeout(tick, Math.max(30, interval()));
    };
    tick();
  }

  function renderSwitch(token) {
    const lines = textLines();
    const fs = Math.max(14, sizePx() * 0.85);

    const wrap = el('div', 'solo-wrap');
    const line = el('div', 'line solo', lines[0]);
    line.style.fontSize = fs + 'px';
    wrap.appendChild(line);
    ui.render.className = 'render';
    ui.render.appendChild(wrap);

    // 用最長的一行來決定字級
    let longest = lines[0];
    const probe = line.cloneNode(false);
    probe.style.visibility = 'hidden';
    wrap.appendChild(probe);
    for (const t of lines) {
      probe.textContent = t;
      if (probe.getBoundingClientRect().width > line.getBoundingClientRect().width) longest = t;
    }
    probe.remove();

    const savedText = line.textContent;
    line.textContent = longest;
    fitBox(wrap);
    line.textContent = savedText;

    let idx = 0;
    const show = i => {
      line.textContent = lines[i];
      line.animate(
        [
          { opacity: 0, transform: 'scale(.82)' },
          { opacity: 1, transform: 'scale(1)' }
        ],
        { duration: 380, easing: 'cubic-bezier(.2,.9,.2,1)' }
      );
    };

    switchTimer = setInterval(() => {
      if (token !== effToken || S.paused) return;
      idx = (idx + 1) % lines.length;
      show(idx);
    }, Math.max(700, 2100 - S.speed * 13));
  }

  function applyPause() {
    if (!anim) return;
    try {
      if (S.paused) anim.pause();
      else anim.play();
    } catch {}
  }

  /* ---------------- 面板 UI ---------------- */

  function buildFontChips() {
    ui.fontChips.replaceChildren();
    for (const f of FONTS) {
      const b = el('button', 'fchip', '跑馬燈');
      b.type = 'button';
      b.dataset.font = f.id;
      b.style.fontFamily = f.css;
      b.addEventListener('click', () => {
        S.font = f.id;
        save();
        renderEffect();
      });
      ui.fontChips.appendChild(b);
    }
  }

  function buildColorRow(host, palette, key) {
    host.replaceChildren();

    for (const color of palette) {
      const b = el('button', 'sw');
      b.type = 'button';
      b.dataset.color = color;
      b.style.background = color;
      b.setAttribute('aria-label', color);
      b.addEventListener('click', () => {
        S[key] = color;
        save();
        applyStage();
        renderHeroIfHidden();
        syncSheet();
      });
      host.appendChild(b);
    }

    const pick = el('label', 'sw sw--picker');
    const input = document.createElement('input');
    input.type = 'color';
    input.value = S[key];
    input.addEventListener('input', () => {
      S[key] = input.value;
      save();
      applyStage();
      renderHeroIfHidden();
      syncSheet();
    });
    pick.appendChild(input);
    host.appendChild(pick);
  }

  function renderHeroIfHidden() {
    if (!ui.play.hidden) return;
    renderHero();
  }

  const TOOLS = [
    { id: 'pause', label: '⏸', title: '暫停' },
    { id: 'mono', label: '≣', title: '等寬字' },
    { id: 'bold', label: '粗', title: '粗體' },
    { id: 'blink', label: '閃', title: '閃爍' },
    { id: 'mirror', label: '鏡', title: '鏡像' },
    { id: 'reset', label: '↺', title: '重設' }
  ];

  function buildTools() {
    ui.tools.replaceChildren();
    for (const t of TOOLS) {
      const b = el('button', 'tool', t.label);
      b.type = 'button';
      b.dataset.tool = t.id;
      b.setAttribute('aria-label', t.title);
      b.addEventListener('click', () => onTool(t.id));
      ui.tools.appendChild(b);
    }
  }

  function onTool(id) {
    if (id === 'pause') {
      S.paused = !S.paused;
      applyPause();
    } else if (id === 'mono') {
      S.font = S.font === 'mono' ? 'sans' : 'mono';
      renderEffect();
    } else if (id === 'bold') {
      S.bold = !S.bold;
      applyStage();
      renderEffect();
    } else if (id === 'blink') {
      S.blink = !S.blink;
      applyStage();
    } else if (id === 'mirror') {
      S.mirror = !S.mirror;
      applyStage();
    } else if (id === 'reset') {
      S.ink = DEFAULTS.ink;
      S.bg = DEFAULTS.bg;
      S.speed = DEFAULTS.speed;
      S.size = DEFAULTS.size;
      S.bold = true;
      S.blink = false;
      S.mirror = false;
      S.paused = false;
      S.font = DEFAULTS.font;
      renderEffect();
      toast('已重設樣式');
    }
    save();
    syncSheet();
  }

  function syncSheet() {
    ui.sheetTitle.textContent = (EFFECTS.find(e => e.id === S.effect) || EFFECTS[0]).name;

    ui.rSpeed.value = String(S.speed);
    ui.rSize.value = String(S.size);

    $$('.fchip', ui.fontChips).forEach(b => b.classList.toggle('is-active', b.dataset.font === S.font));

    markColor(ui.inkColors, S.ink);
    markColor(ui.bgColors, S.bg);

    $$('.tool', ui.tools).forEach(b => {
      const id = b.dataset.tool;
      let on = false;
      if (id === 'pause') {
        on = S.paused;
        b.innerHTML = S.paused
          ? '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M8.5 5.2l10.2 6.8-10.2 6.8z" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><rect x="7" y="5" width="3.4" height="14" rx="1.2" fill="currentColor"/><rect x="13.6" y="5" width="3.4" height="14" rx="1.2" fill="currentColor"/></svg>';
      } else if (id === 'mono') on = S.font === 'mono';
      else if (id === 'bold') on = S.bold;
      else if (id === 'blink') on = S.blink;
      else if (id === 'mirror') on = S.mirror;
      b.classList.toggle('is-on', on);
    });
  }

  function markColor(host, color) {
    let matched = false;
    $$('.sw', host).forEach(b => {
      if (!b.dataset.color) return;
      const hit = b.dataset.color.toLowerCase() === String(color).toLowerCase();
      if (hit) matched = true;
      b.classList.toggle('is-active', hit);
    });
    const picker = $('.sw--picker', host);
    if (picker) {
      picker.classList.toggle('is-active', !matched);
      const input = $('input', picker);
      if (input) input.value = color;
    }
  }

  /* ---------------- 畫面切換 ---------------- */

  function showScreen(name) {
    $$('.screen').forEach(s => { s.hidden = s.dataset.screen !== name; });
    $$('.tab', ui.tabbar).forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
    if (name === 'scenes') renderScenes();
    if (name === 'me') syncMe();
    const page = document.querySelector('.screen:not([hidden]) .page');
    if (page) page.scrollTop = 0;
  }

  /* ---------------- 我 ---------------- */

  function syncMe() {
    $('#setWake').checked = !!S.wake;
    $('#setDots').checked = !!S.dots;
    $('#setBright').value = String(S.brightness);

    const sel = $('#setDefaultFx');
    if (!sel.options.length) {
      for (const fx of EFFECTS) {
        const o = document.createElement('option');
        o.value = fx.id;
        o.textContent = fx.name;
        sel.appendChild(o);
      }
    }
    sel.value = S.effect;
  }

  /* ---------------- 螢幕常亮 ---------------- */

  let wakeLock = null;

  async function wakeOn() {
    if (!S.wake) return;
    try {
      if (!('wakeLock' in navigator) || wakeLock) return;
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {}
  }

  async function wakeOff() {
    try { if (wakeLock) await wakeLock.release(); } catch {}
    wakeLock = null;
  }

  /* ---------------- 事件 ---------------- */

  function bindEvents() {
    // 頁籤
    $$('.tab', ui.tabbar).forEach(t => {
      t.addEventListener('click', () => showScreen(t.dataset.tab));
    });

    // 主預覽卡
    ui.heroCard.addEventListener('click', () => openPlay('marquee'));
    ui.heroEdit.addEventListener('click', e => {
      e.stopPropagation();
      openTextModal();
    });

    // 更多
    $$('[data-more]').forEach(b => {
      b.addEventListener('click', () => openPlay(S.effect, { focus: b.dataset.more }));
    });

    // 播放頁
    ui.stage.addEventListener('click', () => setSheet(!sheetOpen));
    ui.sheetBackdrop.addEventListener('click', () => setSheet(false));
    ui.sheetClose.addEventListener('click', () => setSheet(false));
    ui.playBack.addEventListener('click', closePlay);
    ui.playSave.addEventListener('click', saveScene);

    // 面板滑桿
    ui.rSpeed.addEventListener('input', () => {
      S.speed = Number(ui.rSpeed.value);
      if (anim) {
        animBaseSpeed = animBaseSpeed || pxPerSec();
        anim.playbackRate = clamp(pxPerSec() / animBaseSpeed, 0.05, 20);
      } else if (S.effect === 'typer' || S.effect === 'switch') {
        renderEffect();
      }
      save();
    });
    ui.rSize.addEventListener('input', () => {
      S.size = Number(ui.rSize.value);
      renderEffect();
      save();
    });

    // 場景 / 我
    $('#saveScene').addEventListener('click', () => {
      saveScene();
      showScreen('scenes');
    });

    $('#setWake').addEventListener('change', e => {
      S.wake = e.target.checked;
      save();
      S.wake ? wakeOn() : wakeOff();
    });

    $('#setDots').addEventListener('change', e => {
      S.dots = e.target.checked;
      save();
      applyStage();
    });

    $('#setBright').addEventListener('input', e => {
      S.brightness = Number(e.target.value);
      ui.dim.style.opacity = String((100 - S.brightness) / 100);
      save();
    });

    $('#setDefaultFx').addEventListener('change', e => {
      S.effect = e.target.value;
      save();
      renderHero();
    });

    $('#resetAll').addEventListener('click', () => {
      if (!confirm('確定要清除所有設定與場景嗎？')) return;
      try {
        localStorage.removeItem(KEY);
        localStorage.removeItem(OLD_KEY);
      } catch {}
      location.reload();
    });

    // 文字編輯
    $('#textDone').addEventListener('click', () => {
      const v = ui.textInput.value.replace(/\r/g, '');
      S.text = v.trim().length ? v : ' ';
      ui.modal.hidden = true;
      save();
      renderHero();
      renderScenes();
    });

    ui.modal.addEventListener('click', e => {
      if (e.target === ui.modal) ui.modal.hidden = true;
    });

    // 鍵盤（電腦測試用）
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!ui.modal.hidden) ui.modal.hidden = true;
        else if (!ui.play.hidden && sheetOpen) setSheet(false);
      }
    });

    // 尺寸變化
    let rz = 0;
    const onResize = () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        renderHero();
        if (!ui.play.hidden) {
          updateLift();
          renderEffect();
        }
      }, 180);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 320));

    // 回到前景時重新取得螢幕常亮
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wakeOn();
      else if (!ui.play.hidden) save();
    });
  }

  function openTextModal() {
    ui.textInput.value = S.text;
    ui.modal.hidden = false;
    setTimeout(() => ui.textInput.focus(), 60);
  }

  /* ---------------- 啟動 ---------------- */

  function init() {
    buildFontChips();
    buildColorRow(ui.inkColors, INK_COLORS, 'ink');
    buildColorRow(ui.bgColors, BG_COLORS, 'bg');
    buildTools();
    buildEffectList();
    bindEvents();
    syncMe();
    renderHero();
    renderScenes();
    applyStage();
    wakeOn();

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
