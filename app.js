/* ============================================================
 *  CRYSTAL ROYALE AI PHOTO BOOTH — frontend (Meghan turns 7)
 *  Flow: Landing → PIN → Background (frame) → Royal look (no timer) → One-shot camera (10 s countdown) →
 *        AI brewing → Pick frame → Result (QR · Print 5R · Save)
 * ============================================================ */
(() => {
  'use strict';
  const CFG = window.BOOTH_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const API_READY = /^https:\/\/script\.google\.com\/macros\/s\/(?!PASTE)/.test(CFG.API_URL);

  const state = {
    token: null, characters: CFG.CHARACTERS.slice(),
    character: null, photoB64: null, images: [], layoutId: CFG.LAYOUTS[0].id,
    finalDataUrl: null, shareCode: null, stream: null, timers: new Set()
  };
  const frames = {};   // layoutId → HTMLImageElement
  const ALL_LAYOUTS = CFG.LAYOUTS.slice();   // the Settings tab can hide or reorder these
  const framesReady = Promise.all(CFG.LAYOUTS.map(L => new Promise(res => {
    const i = new Image(); i.onload = () => { frames[L.id] = i; res(); }; i.onerror = res; i.src = L.src;
  })));

  /* ---------------- utilities ---------------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), ms); }
  function clearTimers() { state.timers.forEach(id => { clearTimeout(id); clearInterval(id); cancelAnimationFrame(id); }); state.timers.clear(); }
  function later(fn, ms) { const id = setTimeout(() => { state.timers.delete(id); fn(); }, ms); state.timers.add(id); return id; }

  function show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
    FX.mode(name === 'intro' ? 'intro' : 'calm');
    // Install banner lives on the opening screen only so it never covers booth buttons.
    if (name !== 'intro') hideInstall();
    else if (!seen() && !isStandalone()) setTimeout(openInstall, 1500);
  }

  /* ---------------- API ---------------- */
  async function api(action, data = {}, timeoutMs = 60000) {
    if (!API_READY) return mockApi(action, data);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      // Same transport as the proven King Arthur booth: every call is a POST with a
      // text/plain JSON body (a "simple" request, so the browser sends no CORS preflight).
      const r = await fetch(CFG.API_URL, {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ action }, data))
      });
      const raw = await r.text();
      try { return JSON.parse(raw); }
      catch (x) {   // Google sent a web page (sign-in / permission / error) instead of data
        return { ok: false, retry: true, setup: true, error: 'The booth server is not set up for guests yet. Please call the staff.',
                 detail: 'The server replied with a webpage instead of data. In Apps Script: Deploy → Manage deployments → ✏️ Edit → Execute as "Me", Who has access "Anyone" → Version: New version → Deploy.' };
      }
    } catch (e) {
      return { ok: false, retry: true, net: true, error: e.name === 'AbortError' ? 'The spell took too long. Please try again.' : 'Connection lost. Check the internet and try again.', detail: String(e.message || e) };
    } finally { clearTimeout(t); }
  }
  // Kept for older call sites: now a POST like every other call (no GET requests to Apps Script).
  async function apiGet(params) {
    if (!API_READY) return { ok: false };
    const { action, ...rest } = params;
    return api(action, rest, 60000);
  }
  // Offline mode (API_URL not set): the demo PIN runs with stand-in images.
  async function mockApi(action, d) {
    await sleep(action === 'generate' ? 3500 : 400);
    if (action === 'validatePin') return { ok: false, error: 'PIN not found. Please check your PIN Slip or ask the booth counter.' };
    if (action === 'generate') {
      const ch = state.characters.find(c => c.id === d.characterId) || state.characters[0];
      return { ok: true, step: 1, image: await fakeAI(d.photo, ch), characterId: ch.id };
    }
    if (action === 'animate') return { ok: true, step: 2, image: await fakeAnimated(d.image) };
    if (action === 'poll') return { ok: false, error: 'Nothing running.' };
    if (action === 'save') return { ok: true, shareCode: 'DEMO' };
    if (action === 'printOrder') {
      if (d.staffCode !== CFG.DEMO_STAFF_CODE) return { ok: false, error: `Wrong staff code. (Demo code: ${CFG.DEMO_STAFF_CODE})` };
      const total = d.items.reduce((a, i) => a + i.copies, 0);
      return { ok: true, orderId: 'DEMO-' + String(Date.now()).slice(-5), total, amount: total * pricing.price, currency: pricing.currency };
    }
    return { ok: true };
  }

  /* ---------------- offline stand-ins ----------------
   * Used ONLY when API_URL is not set (e.g. the design preview), because there is no server to reach.
   * On the real booth every PIN — including the demo PIN — goes to the backend and OpenAI. */
  // Stand-in for step 1: the photo colour-graded in the character's palette (nothing drawn on it).
  async function fakeAI(b64, ch) {
    const img = await loadImg('data:image/jpeg;base64,' + b64);
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.drawImage(img, 0, 0, W, H);
    g.globalCompositeOperation = 'soft-light';
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, ch.color || '#c7a2ff'); grad.addColorStop(1, '#f6a8d6');
    g.globalAlpha = .7; g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7);
    v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(92,47,158,.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    return c.toDataURL('image/jpeg', .9);
  }
  // Stand-in for step 2: posterised, saturated "cartoon" look of the step-1 picture.
  async function fakeAnimated(src) {
    const img = await loadImg(src), W = img.naturalWidth, H = img.naturalHeight;
    const small = document.createElement('canvas'); small.width = 160; small.height = Math.round(160 * H / W);
    small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(small, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H), px = d.data, L = 6;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], gg = px[i + 1], b = px[i + 2], m = (r + gg + b) / 3;
      px[i] = Math.round(Math.min(255, m + (r - m) * 1.5) / 255 * L) / L * 255;
      px[i + 1] = Math.round(Math.min(255, m + (gg - m) * 1.5) / 255 * L) / L * 255;
      px[i + 2] = Math.round(Math.min(255, m + (b - m) * 1.5) / 255 * L) / L * 255;
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL('image/jpeg', .9);
  }
  // A drawn sample "guest" photo for when no camera is available.
  function samplePhoto() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, '#8b6f5a'); bg.addColorStop(1, '#3f2e24'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
    const people = [{ x: 360, skin: '#c68863', hair: '#1f1410', shirt: '#2563eb', long: false }, { x: 680, skin: '#8d5a3b', hair: '#2b1a12', shirt: '#db2777', long: true }];
    people.forEach(p => {
      g.fillStyle = p.shirt; g.beginPath(); g.ellipse(p.x, 1000, 210, 260, 0, 0, 7); g.fill();
      g.fillStyle = p.skin; g.fillRect(p.x - 45, 600, 90, 110);
      if (p.long) { g.fillStyle = p.hair; g.beginPath(); g.ellipse(p.x, 560, 170, 230, 0, 0, 7); g.fill(); }
      g.fillStyle = p.skin; g.beginPath(); g.ellipse(p.x, 480, 130, 160, 0, 0, 7); g.fill();
      g.fillStyle = p.hair; g.beginPath(); g.ellipse(p.x, 370, 140, 85, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#1a1a1a'; [-48, 48].forEach(dx => { g.beginPath(); g.arc(p.x + dx, 470, 12, 0, 7); g.fill(); });
      g.strokeStyle = '#5a2a1a'; g.lineWidth = 8; g.beginPath(); g.arc(p.x, 525, 45, .2 * Math.PI, .8 * Math.PI); g.stroke();
    });
    return c.toDataURL('image/jpeg', .9);
  }

  /* ---------------- sound (tiny WebAudio, no files) ---------------- */
  const Sound = (() => {
    let ctx;
    const ac = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());
    function tone(freq, dur = .15, type = 'sine', vol = .15, when = 0) {
      try {
        const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
        o.type = type; o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur);
      } catch (e) {}
    }
    return {
      unlock() { try { ac().resume(); } catch (e) {} },
      chime() { [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => tone(f, 1.2, 'sine', .05, i * .09)); },
      tick() { tone(1318.5, .12, 'sine', .07); },
      tap() { tone(520, .06, 'sine', .08); },
      shutter() {
        try { const c = ac(), n = c.sampleRate * .18, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
          for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
          const s = c.createBufferSource(), g = c.createGain(); g.gain.value = .35; s.buffer = b; s.connect(g).connect(c.destination); s.start(); } catch (e) {}
      },
      magic() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .35, 'sine', .07, i * .08)); }
    };
  })();

  /* ---------------- ambient FX: glitter, floating crystals, sparkle bursts ---------------- */
  const FX = (() => {
    const cv = $('#fx'), ctx = cv.getContext('2d');
    let W, H, dpr, glit = [], gems = [], m = 'intro';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const COLORS = ['#ffffff', '#fff3c4', '#fbe7a6', '#f6a8d6', '#e2d0ff', '#cfe9ff'];
    const pick = a => a[Math.floor(Math.random() * a.length)];
    function resize() { dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function glitter(x, y, burst) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
      return burst
        ? { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, r: 1.2 + Math.random() * 2.6, c: pick(COLORS), tw: Math.random() * 6, life: 1, burst: true }
        : { x: Math.random() * W, y: -10 - Math.random() * H * .3, vx: (Math.random() - .5) * .3, vy: .25 + Math.random() * .7, r: .7 + Math.random() * 2.2, c: pick(COLORS), tw: Math.random() * 6, life: 1 };
    }
    function gem(initial) {
      return { x: Math.random() * W, y: initial ? Math.random() * H : H + 60, s: 8 + Math.random() * 20, vy: -(.2 + Math.random() * .5), vx: (Math.random() - .5) * .25,
               rot: Math.random() * 6, vr: (Math.random() - .5) * .008, hue: pick([280, 300, 320, 260, 210]), a: .28 + Math.random() * .35 };
    }
    function star(x, y, r, c, alpha) {
      ctx.globalAlpha = alpha; ctx.fillStyle = c; ctx.beginPath();
      ctx.moveTo(x, y - r * 2.4); ctx.lineTo(x + r * .45, y - r * .45); ctx.lineTo(x + r * 2.4, y); ctx.lineTo(x + r * .45, y + r * .45);
      ctx.lineTo(x, y + r * 2.4); ctx.lineTo(x - r * .45, y + r * .45); ctx.lineTo(x - r * 2.4, y); ctx.lineTo(x - r * .45, y - r * .45); ctx.closePath(); ctx.fill();
    }
    function drawGem(g) {
      const s = g.s; ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot); ctx.globalAlpha = 1;
      const pts = [[0, -s * 1.5], [s * .55, -s * .6], [s * .55, s * .7], [0, s * 1.5], [-s * .55, s * .7], [-s * .55, -s * .6]];
      const gr = ctx.createLinearGradient(-s, -s * 1.5, s, s * 1.5);
      gr.addColorStop(0, `hsla(${g.hue},100%,96%,${g.a})`); gr.addColorStop(.5, `hsla(${g.hue},85%,80%,${g.a * .8})`); gr.addColorStop(1, `hsla(${g.hue + 30},80%,70%,${g.a * .5})`);
      ctx.fillStyle = gr; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${g.a * 1.3})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * 1.5); ctx.lineTo(0, s * 1.5); ctx.moveTo(-s * .55, -s * .6); ctx.lineTo(0, -s * .1); ctx.lineTo(s * .55, -s * .6);
      ctx.strokeStyle = `rgba(255,255,255,${g.a * .7})`; ctx.stroke(); ctx.restore();
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      const wantG = m === 'intro' ? 110 : 55, wantC = m === 'intro' ? 16 : 7;
      while (glit.filter(p => !p.burst).length < wantG) glit.push(glitter());
      while (gems.length < wantC) gems.push(gem(gems.length < wantC && glit.length < 5));
      glit = glit.filter(p => p.life > 0 && p.y < H + 20 && p.x > -20 && p.x < W + 20);
      for (const p of glit) {
        p.x += p.vx + Math.sin(p.tw) * .15; p.y += p.vy; p.tw += .08;
        if (p.burst) { p.vx *= .96; p.vy = p.vy * .96 + .05; p.life -= .012; }
        const alpha = (p.burst ? p.life : 1) * (.45 + .55 * Math.abs(Math.sin(p.tw)));
        if (p.r > 1.7) star(p.x, p.y, p.r * .9, p.c, alpha);
        else { ctx.globalAlpha = alpha; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      }
      gems = gems.filter(g => g.y > -80);
      for (const g of gems) { g.x += g.vx; g.y += g.vy; g.rot += g.vr; drawGem(g); }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    function shimmer() {   // a soft wash of light every so often
      const el = $('.lightning'); el.classList.remove('strike'); void el.offsetWidth; el.classList.add('strike');
      setTimeout(shimmer, 12000 + Math.random() * 12000);
    }
    return {
      start() { resize(); addEventListener('resize', resize); for (let i = 0; i < 12; i++) gems.push(gem(true));
                if (!reduce) { requestAnimationFrame(frame); setTimeout(shimmer, 6000); } },
      mode(x) { m = x; },
      burstAt(x, y, n = 60) { for (let i = 0; i < n; i++) glit.push(glitter(x, y, true)); },
      swarm(n = 18) { this.burstAt(W / 2, H * .45, n * 4); }
    };
  })();

  /* ---------------- INTRO ---------------- */
  function buildTitle() {
    const el = $('#introTitle'); el.innerHTML = '';
    let d = .3;
    String(CFG.THEME_TITLE || 'Photo Booth').trim().split(/\s+/).forEach(word => {
      const w = document.createElement('span'); w.className = 'word';
      [...word].forEach((ch, i) => {
        const s = document.createElement('span'); s.className = 'ch' + (i % 3 === 1 ? ' lit' : ''); s.textContent = ch;
        s.style.animationDelay = d + 's' + (s.classList.contains('lit') ? `, ${2.5 + Math.random() * 2}s` : ''); d += .07;
        w.appendChild(s);
      });
      el.appendChild(w);
    });
  }
  // Twinkles placed on the gold lettering, tiara and crystals of the invitation (as % of the poster).
  const GLINTS = [[50, 46.5], [39, 61], [61, 59.5], [70, 63], [58, 70], [63.5, 74.5], [27, 59], [47, 66], [9, 9], [91, 9], [14, 89], [86, 90],
                  [72, 79], [30, 78], [50, 74], [21, 70], [79, 70], [50, 56.5]];
  function buildGlints() {
    const box = $('#glints'); if (!box) return; box.innerHTML = '';
    GLINTS.forEach(([x, y], i) => {
      const g = document.createElement('i'); g.style.left = x + '%'; g.style.top = y + '%';
      g.style.animationDelay = (1.6 + (i * .53) % 3.2).toFixed(2) + 's';
      g.style.transform = `scale(${.6 + (i % 4) * .15})`; box.appendChild(g);
    });
  }
  function openingBurst() {
    const b = document.createElement('div'); b.className = 'burst'; document.body.appendChild(b);
    setTimeout(() => b.remove(), 1700); setTimeout(() => FX.swarm(26), 250);
  }
  function goIntro(first) {
    resetSession(); buildTitle(); buildGlints();
    ['.subtitle', '#startBtn', '.fine', '.pin-note', '.poster-wrap', '.crown'].forEach(s => { const e = $(s); if (!e) return; e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; });
    show('intro'); first ? openingBurst() : setTimeout(() => FX.swarm(18), 700);
  }
  $('#startBtn').addEventListener('click', () => {
    Sound.unlock(); Sound.chime(); FX.swarm(12);
    if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
    goPin();
  });

  /* ---------------- PIN ---------------- */
  const PIN_LEN = 6; let pin = '';
  function renderPin() {
    const box = $('#pinBoxes'); box.innerHTML = '';
    for (let i = 0; i < PIN_LEN; i++) { const s = document.createElement('span'); s.textContent = pin[i] ? '•' : ''; if (i === pin.length) s.className = 'on'; box.appendChild(s); }
    $('#pinSubmit').disabled = pin.length !== PIN_LEN;
  }
  function pinKey(k) {
    $('#pinError').textContent = '';
    if (k === '⌫') pin = pin.slice(0, -1);
    else if (k === 'C') pin = '';
    else if (/\d/.test(k) && pin.length < PIN_LEN) pin += k;
    Sound.tap(); renderPin();
    if (pin.length === PIN_LEN) setTimeout(submitPin, 200);
  }
  (function buildKeypad() {
    const kp = $('#keypad');
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].forEach(k => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = k; b.onclick = () => pinKey(k); kp.appendChild(b);
    });
  })();
  document.addEventListener('keydown', e => {
    if (!$('[data-screen="pin"]').classList.contains('active')) return;
    if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === 'Backspace') pinKey('⌫'); else if (e.key === 'Enter' && pin.length === PIN_LEN) submitPin();
  });
  $('#pinSubmit').addEventListener('click', submitPin);
  function goPin() { pin = ''; renderPin(); show('pin'); }

  let pinBusy = false;
  async function submitPin() {
    if (pinBusy || pin.length !== PIN_LEN) return;
    if (!API_READY && CFG.DEMO_PIN && pin === CFG.DEMO_PIN) {   // offline preview only — no server to reach
      state.demo = true; state.token = 'demo'; Sound.magic();
      toast(CFG.EMBED ? 'Preview: the real booth makes these pictures with AI.' : 'Offline preview: no server set, so pictures are stand-ins.', 3200);
      return goLayout();
    }
    pinBusy = true; $('#pinSubmit').disabled = true; $('#pinSubmit').textContent = 'Checking the spirits…';
    const res = await api('validatePin', { pin });
    pinBusy = false; $('#pinSubmit').textContent = 'Unlock the Magic';
    if (!res.ok) {
      $('#pinError').textContent = res.error || 'Invalid PIN.'; const b = $('#pinBoxes'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      pin = ''; renderPin(); return;
    }
    state.token = res.token; state.demo = !!res.demo; Sound.magic();
    if (res.demo) toast('Demo session · real AI · not charged to a PIN', 3200);
    if (res.stage === 'pending') {                               // an AI step is still running: keep waiting for it
      state.character = state.characters.find(c => c.id === res.characterId) || state.characters[0];
      if (res.images && res.images.length) { await useImages(res.images.map(toUrl)); $('#shotPreview').src = state.images[0].src; }
      return runStep(res.step || 1, true);
    }
    if (res.stage === 'generated' || res.stage === 'step1') {   // resume after a reload
      state.character = state.characters.find(c => c.id === res.characterId) || state.characters[0];
      await useImages(res.images.map(toUrl));
      if (res.stage === 'step1') { $('#shotPreview').src = state.images[0].src; return runStep(2); }
      return goLayout();
    }
    if (res.stage === 'done') return resumeDone(res.shareCode);
    goLayout();
  }

  // Royal looks show the hand-drawn SVG icon for their id; custom looks added in the Sheet fall back to their emoji.
  const lookIcon = c => (window.ICON && window.ICON_NAMES.includes(c.id)) ? window.ICON(c.id) : `<span class="emo">${c.emoji || '✨'}</span>`;

  /* ---------------- CHARACTER (no timer — guests take their time) ---------------- */
  function goCharacter() {
    clearTimers(); state.character = null;
    const grid = $('#charGrid'); grid.innerHTML = '';
    state.characters.forEach((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'char'; b.style.setProperty('--c', c.color || '#7c3aed');
      b.style.animationDelay = (i * .05) + 's';
      b.innerHTML = `<span class="em">${lookIcon(c)}</span><b>${c.name}</b><small>${c.tagline || ''}</small>`;
      b.onclick = () => { state.character = c; Sound.tap(); grid.querySelectorAll('.char').forEach(x => x.classList.toggle('sel', x === b)); $('#charGo').disabled = false; };
      grid.appendChild(b);
    });
    $('#charGo').disabled = true; show('character');
  }
  $('#charGo').addEventListener('click', () => {
    if (!state.character) return;
    clearTimers();
    if (state.keepShot && state.photoB64) { state.keepShot = false; return generate(); }   // re-use the one shot
    goCamera();
  });

  function runRing(ringSel, numSel, seconds, done) {
    const ring = $(ringSel), prog = ring.querySelector('.prog'), num = $(numSel), C = 276.5, start = performance.now();
    ring.classList.remove('hurry'); let lastSec = seconds + 1;
    const step = now => {
      const left = Math.max(0, seconds - (now - start) / 1000), s = Math.ceil(left);
      prog.style.strokeDashoffset = C * (1 - left / seconds);
      if (s !== lastSec) { num.textContent = s; lastSec = s; if (s <= 3 && s > 0) { ring.classList.add('hurry'); Sound.tick(); } }
      if (left <= 0) return done();
      const id = requestAnimationFrame(step); state.timers.add(id);
    };
    state.timers.add(requestAnimationFrame(step));
  }

  /* ---------------- CAMERA (one shot) ---------------- */
  const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', capture: 'user', hidden: true });
  document.body.appendChild(fileInput);
  let shooting = false, cameraFailed = false;

  async function goCamera() {
    const c = state.character;
    $('#camBadge').innerHTML = `${lookIcon(c)}<span>${c.name}</span>`;
    $('#camTitle').textContent = 'Strike a Pose!';
    $('#shootBtn').disabled = true; $('#shootBtn').textContent = "I'm Ready!"; $('#camMsg').textContent = 'Starting camera…';
    $('#countdown').textContent = ''; shooting = false; cameraFailed = false; $('#sampleBtn').hidden = true;
    $('.cam-stage').classList.toggle('landscape', isLandscape()); $('.cam-stage').classList.toggle('portrait', !isLandscape());
    show('camera');
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      const v = $('#video'); v.srcObject = state.stream; await v.play();
      $('#camMsg').textContent = `Tap “I'm Ready” — you get ${CFG.CAMERA_COUNTDOWN} seconds to pose.`;
      $('#shootBtn').disabled = false;
    } catch (e) {
      cameraFailed = true;
      $('#camMsg').textContent = 'Camera unavailable — allow camera access, or upload a photo.';
      $('#shootBtn').disabled = false; $('#shootBtn').textContent = '📷 Upload a Photo';
      $('#sampleBtn').hidden = API_READY;   // live booth: use the camera or upload a real photo
    }
  }
  $('#shootBtn').addEventListener('click', () => cameraFailed ? fileInput.click() : startCountdown());
  $('#sampleBtn').addEventListener('click', async () => { Sound.shutter(); const im = await loadImg(samplePhoto()); finishShot(squareCrop(im, im.naturalWidth, im.naturalHeight, false)); });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0]; if (!f) return;
    const img = await loadImg(URL.createObjectURL(f));
    finishShot(squareCrop(img, img.naturalWidth, img.naturalHeight, false));
  });

  async function startCountdown() {
    if (shooting) return; shooting = true; clearTimers();
    $('#shootBtn').disabled = true; $('#camMsg').textContent = '';
    const cd = $('#countdown');
    for (let n = CFG.CAMERA_COUNTDOWN; n > 0; n--) {
      cd.textContent = n; cd.classList.remove('tick'); void cd.offsetWidth; cd.classList.add('tick'); Sound.tick();
      await sleep(1000);
    }
    cd.textContent = ''; Sound.shutter();
    const fl = $('#flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    const v = $('#video');
    const data = squareCrop(v, v.videoWidth, v.videoHeight, CFG.MIRROR_OUTPUT);
    await sleep(500);
    finishShot(data);
  }
  // Crops the shot to the chosen frame's shape: 2:3 portrait (1024×1536) or 3:2 landscape (1536×1024).
  function squareCrop(src, w, h, mirror) {
    const land = isLandscape(), ow = land ? 1536 : 1024, oh = land ? 1024 : 1536, ratio = ow / oh;
    let sw = w, sh = w / ratio; if (sh > h) { sh = h; sw = h * ratio; }
    const c = document.createElement('canvas'); c.width = ow; c.height = oh; const g = c.getContext('2d');
    if (mirror) { g.translate(ow, 0); g.scale(-1, 1); }
    g.drawImage(src, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, ow, oh);
    return c.toDataURL('image/jpeg', .9);
  }
  function stopCamera() { if (state.stream) { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; } }
  function finishShot(dataUrl) { stopCamera(); state.photoB64 = dataUrl.split(',')[1]; $('#shotPreview').src = dataUrl; generate(); }

  /* ---------------- GENERATING (2 steps) ----------------
   * Step 1: guest photo → photoreal character   (frame window 1)
   * Step 2: step-1 picture → 3D animated version (frame window 2) */
  const STEP_MSGS = [
    ['Polishing the palace crystals', 'Fitting your royal attire', 'Keeping your face exactly you', 'Lighting the crystal chandeliers', 'Placing the tiara just so'],
    ['Turning you into an animated film star', 'Rendering in glorious 3D', 'Adding a sprinkle of movie magic', 'Polishing every sparkle', 'Rolling the cameras…']
  ];
  const toUrl = b => b.startsWith('data:') ? b : 'data:image/jpeg;base64,' + b;
  let genStep = 1;

  const POLL_MS = 3000, STEP_LIMIT_MS = 330000;
  const QUEUE_MSGS = { queued: 'Waiting in the AI queue…', requeued: 'The queue was stuck — re-sent your photo…', starting: 'Starting the spell…', checking: 'Checking on your picture…' };

  async function runStep(step, resume) {
    genStep = step; show('generating'); clearTimers();
    $('#genError').textContent = ''; $('#genDetail').textContent = ''; $('#genRetry').hidden = true;
    $('#genTitle').textContent = step === 1 ? 'Creating Your Royal Portrait…' : 'Making Your 3D Film Still…';
    $('#genStep').textContent = `Step ${step} of 2 · ${step === 1 ? 'Crystal Royale portrait' : '3D animated film'}`;
    const bar = $('#genBar'), base = step === 1 ? 0 : 50, t0 = Date.now(); let mi = 0, queueMsg = '';
    const msgs = STEP_MSGS[step - 1];
    bar.style.width = (base + 2) + '%'; $('#genMsg').textContent = msgs[0];
    const iv = setInterval(() => {
      const t = (Date.now() - t0) / 1000; bar.style.width = (base + Math.min(47, 50 * (1 - Math.exp(-t / 45)))) + '%';
      if (Math.floor(t) % 5 === 0) $('#genMsg').textContent = queueMsg || msgs[mi = (mi + 1) % msgs.length];
    }, 1000); state.timers.add(iv);

    // 1) start the step (or pick up a job that is already running after a reload)
    let res = resume ? { ok: true, pending: true } : (step === 1
      ? await api('generate', { token: state.token, characterId: state.character.id, photo: state.photoB64, size: aiSize() }, 330000)
      : await api('animate', Object.assign({ token: state.token },          // the server re-reads step 1 from Drive;
          !API_READY ? { image: state.images[0].src } : {}), 330000));   // direct engine waits for the picture (can take 1–3 min)      // only the offline preview needs it here

    // 2) background engine: check back every few seconds until the picture is ready
    let netFails = 0;
    while ((res.ok && res.pending) || (res.net && netFails < 6)) {
      if (Date.now() - t0 > STEP_LIMIT_MS) { res = { ok: false, retry: true, error: 'The spell took too long. Please tap Try Again.', detail: 'Booth stopped waiting after ' + Math.round(STEP_LIMIT_MS / 1000) + ' s.' }; break; }
      if (!$('[data-screen="generating"]').classList.contains('active')) { clearInterval(iv); return; }   // guest left / reset
      if (res.ok) { queueMsg = QUEUE_MSGS[res.status] || ''; if (queueMsg) $('#genMsg').textContent = queueMsg; }
      await sleep(POLL_MS);
      const next = await api('poll', { token: state.token }, 30000);
      netFails = next.net ? netFails + 1 : 0;
      if (!next.net) res = next; else res = Object.assign({}, next);
    }
    clearInterval(iv);
    if (!res.ok) {
      $('#genTitle').textContent = 'The Magic Paused'; $('#genMsg').textContent = '';
      $('#genError').textContent = res.error || 'Something went wrong.';
      if (res.detail) $('#genDetail').textContent = 'Details for staff: ' + res.detail;
      $('#genRetry').hidden = !res.retry; bar.style.width = base + '%';
      $('#genOther').hidden = !(res.retry && step === 1 && /safety|another (character|look)/i.test(res.error || ''));
      return;
    }
    bar.style.width = (base + 50) + '%'; Sound.magic();
    const img = await loadImg(toUrl(res.image));
    if (step === 1) {
      state.images = [img];
      $('#shotPreview').src = img.src;           // show the character photo while step 2 runs
      return runStep(2);
    }
    state.images = [state.images[0], img];
    finalize();
  }
  function generate() { return runStep(1); }
  $('#genRetry').addEventListener('click', () => runStep(genStep));   // same photo — still one shot
  $('#genOther').addEventListener('click', () => { state.keepShot = true; goCharacter(); });   // same photo, new character
  async function useImages(urls) { state.images = await Promise.all(urls.map(loadImg)); }

  /* ---------------- COMPOSITE ---------------- */
  function composite(layout, imgs, scale) {
    const c = document.createElement('canvas'); c.width = Math.round(layout.width * scale); c.height = Math.round(layout.height * scale);
    const g = c.getContext('2d'); g.fillStyle = '#12061f'; g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = 'high';
    layout.slots.forEach((s, i) => {
      const img = imgs[i % imgs.length]; if (!img) return;
      const W = (s.w + 30) * scale, H = (s.h + 30) * scale;   // overscan; the frame art hides the edges
      g.save(); g.translate(s.cx * scale, s.cy * scale); g.rotate(s.angle * Math.PI / 180);
      g.beginPath(); g.rect(-W / 2, -H / 2, W, H); g.clip();
      const r = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      g.drawImage(img, -img.naturalWidth * r / 2, -img.naturalHeight * r / 2, img.naturalWidth * r, img.naturalHeight * r);
      g.restore();
    });
    g.drawImage(frames[layout.id], 0, 0, c.width, c.height);
    return c;
  }

  /* ---------------- BACKGROUND (your frames) — chosen first, so the camera matches its shape ---------------- */
  const layoutOf = () => CFG.LAYOUTS.find(l => l.id === state.layoutId) || CFG.LAYOUTS[0];
  const isLandscape = L => (L || layoutOf()).width > (L || layoutOf()).height;
  const aiSize = () => isLandscape() ? '1536x1024' : '1024x1536';
  function goLayout() {
    clearTimers();
    const grid = $('#layoutGrid'); grid.innerHTML = '';
    CFG.LAYOUTS.forEach(L => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'layout-opt' + (L.id === state.layoutId ? ' sel' : '');
      b.style.aspectRatio = `${L.width} / ${L.height}`; b.classList.toggle('wide', isLandscape(L));
      const im = new Image(); im.src = L.thumb || L.src; im.alt = L.name; b.appendChild(im);
      const tag = document.createElement('span'); tag.textContent = L.name; b.appendChild(tag);
      b.onclick = () => { state.layoutId = L.id; Sound.tap(); grid.querySelectorAll('.layout-opt').forEach(x => x.classList.toggle('sel', x === b)); };
      grid.appendChild(b);
    });
    show('layout');
  }
  // After a reload with both pictures already made, the frame choice goes straight to the result.
  $('#layoutGo').addEventListener('click', () => state.images.length >= 2 ? finalize() : goCharacter());

  /* ---------------- RESULT ---------------- */
  async function finalize() {
    clearTimers(); await framesReady;
    const L = CFG.LAYOUTS.find(l => l.id === state.layoutId) || CFG.LAYOUTS[0];
    state.finalDataUrl = composite(L, state.images, CFG.FRAME_SCALE).toDataURL('image/jpeg', .92);
    showResult();
    await uploadFinal(L.id);
  }
  async function uploadFinal(layoutId) {
    $('#qr').innerHTML = '<span class="muted small">Saving…</span>'; $('#qrNote').textContent = '';
    const res = await api('save', { token: state.token, layoutId, image: state.finalDataUrl.split(',')[1] }, 90000);
    if (!res.ok) {
      $('#qr').innerHTML = '<span class="muted small">Not saved</span>';
      $('#qrNote').innerHTML = `${res.error || 'Upload failed.'} <button class="btn btn-ghost sm" id="retrySave">Retry</button>`;
      $('#retrySave').onclick = () => uploadFinal(layoutId); return;
    }
    state.shareCode = res.shareCode; renderQR();
  }
  function renderQR() {
    const url = new URL('download.html?c=' + encodeURIComponent(state.shareCode), location.href).href;
    const el = $('#qr'); el.innerHTML = '';
    if (window.QRCode) new QRCode(el, { text: url, width: 240, height: 240, colorDark: '#12061f', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    else el.textContent = state.shareCode;
    const days = 7;
    $('#qrNote').textContent = API_READY ? `Photo code: ${state.shareCode} · available for ${days} days${state.demo ? ' · demo' : ''}` : 'Offline preview — QR is a sample';
  }
  function showResult() {
    const L = layoutOf();
    $('.result').classList.toggle('landscape', isLandscape(L)); $('.result-photo').style.aspectRatio = `${L.width} / ${L.height}`;
    $('#finalImg').src = state.finalDataUrl; show('result'); FX.swarm(20); Sound.chime(); startIdle();
  }
  async function resumeDone(code) {
    state.shareCode = code; show('generating'); $('#genTitle').textContent = 'Welcome Back!'; $('#genMsg').textContent = 'Fetching your photo…';
    const r = await apiGet({ action: 'photo', c: code });
    if (!r.ok) { $('#genError').textContent = r.error || 'Could not load your photo.'; return; }
    state.finalDataUrl = r.dataUrl || r.url;
    if (r.photos) state.photos = r.photos.map(p => ({ id: p.id, label: p.label, src: p.dataUrl || p.url, download: p.download }));
    showResult(); renderQR();
  }

  // Idle reset for kiosk use
  let idleT, idleLeft;
  function startIdle() {
    clearInterval(idleT); idleLeft = CFG.RESULT_IDLE_SECONDS;
    idleT = setInterval(() => {
      idleLeft--; $('#idleNote').textContent = idleLeft <= 30 ? `Returning to start in ${idleLeft}s…` : '';
      if (idleLeft <= 0) { clearInterval(idleT); goIntro(); }
    }, 1000);
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (idleT && $('[data-screen="result"]').classList.contains('active')) idleLeft = CFG.RESULT_IDLE_SECONDS; }));

  /* ---------------- THE 3 PHOTOS ---------------- */
  const PHOTO_LABELS = { collage: 'Photo collage', photo1: 'Crystal Royale portrait', photo2: '3D animated film photo' };
  function photoList() {
    if (state.photos && state.photos.length) return state.photos;
    return [
      { id: 'collage', label: PHOTO_LABELS.collage, src: state.finalDataUrl },
      { id: 'photo1', label: PHOTO_LABELS.photo1, src: state.images[0] && state.images[0].src },
      { id: 'photo2', label: PHOTO_LABELS.photo2, src: state.images[1] && state.images[1].src }
    ].filter(p => p.src);
  }
  const money = n => `${pricing.currency}${n.toLocaleString()}`;
  const pricing = { price: CFG.PRINT_PRICE, currency: CFG.CURRENCY, maxCopies: CFG.MAX_COPIES, enabled: CFG.PRINTING_ENABLED === true };
  function applyPricing() {
    document.querySelectorAll('.price-each, #priceEach').forEach(e => e.textContent = money(pricing.price));
    document.querySelectorAll('.pin-price').forEach(e => e.textContent = pricing.currency + Number(CFG.PIN_PRICE).toFixed(2));
    $('#printBtn').hidden = pricing.enabled === false;
  }

  /* Settings tab in the Google Sheet → this booth (texts, prices, timers, layouts). */
  function applySettings(st) {
    if (!st) return;
    const num = (v, d) => (isFinite(+v) && +v > 0 ? +v : d);
    if (st.BOOTH_NAME) { CFG.BOOTH_NAME = st.BOOTH_NAME; document.title = st.BOOTH_NAME; $('#installTitle').textContent = 'Install ' + st.BOOTH_NAME; }
    if (st.THEME_TITLE) { CFG.THEME_TITLE = st.THEME_TITLE; $('#introTitle').setAttribute('aria-label', st.THEME_TITLE); }
    if (st.SUBTITLE != null) $('.subtitle').textContent = st.SUBTITLE;
    if (st.TAGLINE != null) $('.fine').textContent = st.TAGLINE;
    if (st.CURRENCY) { CFG.CURRENCY = st.CURRENCY; pricing.currency = st.CURRENCY; }
    CFG.PIN_PRICE = num(st.PIN_PRICE, CFG.PIN_PRICE);
    if (st.DEMO_PIN !== undefined) CFG.DEMO_PIN = String(st.DEMO_PIN || '');
    CFG.CAMERA_COUNTDOWN = Math.round(num(st.CAMERA_COUNTDOWN, CFG.CAMERA_COUNTDOWN));
    CFG.RESULT_IDLE_SECONDS = Math.round(num(st.RESULT_IDLE_SECONDS, CFG.RESULT_IDLE_SECONDS));
    if (typeof st.MIRROR_OUTPUT === 'boolean') CFG.MIRROR_OUTPUT = st.MIRROR_OUTPUT;
    if (st.LAYOUTS) {
      const want = String(st.LAYOUTS).split(/[\s,]+/).filter(Boolean);
      const picked = want.map(id => ALL_LAYOUTS.find(l => l.id === id)).filter(Boolean);
      if (picked.length) { CFG.LAYOUTS = picked; if (!picked.some(l => l.id === state.layoutId)) state.layoutId = picked[0].id; }
    }
    applyPricing();
    if ($('[data-screen="intro"]').classList.contains('active')) buildTitle();
  }

  /* ---------------- SAVE (3 downloads) ---------------- */
  async function saveFile(p) {
    if (p.download) { const a = Object.assign(document.createElement('a'), { href: p.download, rel: 'noopener' }); document.body.appendChild(a); a.click(); a.remove(); return null; }
    const name = `crystal-royale-${state.shareCode || Date.now()}-${p.id}.jpg`;
    const blob = await (await fetch(p.src)).blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    return new File([blob], name, { type: 'image/jpeg' });
  }
  $('#downloadBtn').addEventListener('click', () => {
    const grid = $('#saveGrid'); grid.innerHTML = '';
    photoList().forEach(p => {
      const card = document.createElement('div'); card.className = 'pick';
      card.innerHTML = `<div class="thumb"><img alt=""></div><b>${p.label}</b>`;
      card.querySelector('img').src = p.src;
      const btn = document.createElement('button'); btn.className = 'btn btn-ghost sm'; btn.textContent = '⬇️ Save';
      btn.onclick = () => CFG.CAN_DOWNLOAD === false ? blockedNote() : saveFile(p);
      card.appendChild(btn); grid.appendChild(card);
    });
    $('#saveNote').textContent = ''; $('#saveModal').hidden = false;
  });
  function blockedNote() { $('#saveNote').textContent = 'Saving is blocked in this preview. On the booth or the QR page each button downloads that photo. Here you can right-click or long-press a picture to save it.'; }
  $('#saveAll').addEventListener('click', async () => {
    if (CFG.CAN_DOWNLOAD === false) return blockedNote();
    const list = photoList();
    if (navigator.canShare && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      const files = await Promise.all(list.map(async p => new File([await (await fetch(p.src)).blob()], `crystal-royale-${p.id}.jpg`, { type: 'image/jpeg' })));
      if (navigator.canShare({ files })) { try { await navigator.share({ files, title: 'My Crystal Royale photos' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    }
    for (const p of list) { await saveFile(p); await sleep(400); }
  });
  $('#saveClose').addEventListener('click', () => { $('#saveModal').hidden = true; });

  /* ---------------- PAID PRINTS (5R = 5 × 7 in) ---------------- */
  const order = {};
  function make5R(srcImg) {
    const dpi = CFG.PRINT_DPI, PW = 5 * dpi, PH = 7 * dpi;
    const c = document.createElement('canvas'); c.width = PW; c.height = PH; const g = c.getContext('2d');
    if (CFG.PRINT_FIT === 'cover') {
      const r = Math.max(PW / srcImg.width, PH / srcImg.height);
      g.drawImage(srcImg, (PW - srcImg.width * r) / 2, (PH - srcImg.height * r) / 2, srcImg.width * r, srcImg.height * r);
    } else {
      // blurred, darkened fill behind the whole picture (no ctx.filter needed, works everywhere)
      const t = document.createElement('canvas'); t.width = 24; t.height = 34; t.getContext('2d').drawImage(srcImg, 0, 0, 24, 34);
      g.imageSmoothingEnabled = true; g.drawImage(t, -40, -40, PW + 80, PH + 80);
      g.fillStyle = 'rgba(10,4,20,.35)'; g.fillRect(0, 0, PW, PH);
      const r = Math.min(PW / srcImg.width, PH / srcImg.height), w = srcImg.width * r, h = srcImg.height * r;
      g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 40;
      g.drawImage(srcImg, (PW - w) / 2, (PH - h) / 2, w, h);
    }
    return c.toDataURL('image/jpeg', .95);
  }
  const pages5R = {};   // photo id → 5R page data URL (cached)
  async function page5R(p) { return pages5R[p.id] || (pages5R[p.id] = make5R(await loadImg(p.src))); }

  function renderOrder() {
    const total = Object.values(order).reduce((a, n) => a + n, 0), amount = total * pricing.price;
    const parts = photoList().filter(p => order[p.id]).map(p => `${order[p.id]}× ${p.label}`);
    $('#orderSummary').textContent = total ? `${parts.join(' · ')}  (${total} × ${money(pricing.price)})` : 'No photos selected';
    $('#orderTotal').textContent = money(amount); $('#payAmount').textContent = money(amount);
    $('#payStep').hidden = !total;
    $('#demoCodeHint').hidden = API_READY;
    document.querySelectorAll('#printGrid .pick').forEach(card => {
      const n = order[card.dataset.id] || 0; card.classList.toggle('on', n > 0);
      card.querySelector('output').textContent = n;
      card.querySelector('.minus').disabled = n === 0; card.querySelector('.plus').disabled = n >= pricing.maxCopies;
    });
  }
  $('#printBtn').addEventListener('click', async () => {
    Object.keys(order).forEach(k => delete order[k]);
    const grid = $('#printGrid'); grid.innerHTML = '';
    for (const p of photoList()) {
      const card = document.createElement('div'); card.className = 'pick'; card.dataset.id = p.id;
      card.innerHTML = `<div class="thumb"><img alt=""></div><b>${p.label}</b>
        <div class="stepper"><button type="button" class="minus" aria-label="Fewer">−</button><output>0</output><button type="button" class="plus" aria-label="More">+</button></div>`;
      grid.appendChild(card);
      page5R(p).then(u => card.querySelector('img').src = u);          // thumbnail shows the real 5R page
      card.querySelector('.thumb').onclick = () => { order[p.id] = order[p.id] ? 0 : 1; Sound.tap(); renderOrder(); };
      card.querySelector('.minus').onclick = () => { order[p.id] = Math.max(0, (order[p.id] || 0) - 1); Sound.tap(); renderOrder(); };
      card.querySelector('.plus').onclick = () => { order[p.id] = Math.min(pricing.maxCopies, (order[p.id] || 0) + 1); Sound.tap(); renderOrder(); };
    }
    $('#staffCode').value = ''; $('#printError').textContent = '';
    $('#printPick').hidden = false; $('#printDone').hidden = true; $('#printModal').hidden = false;
    renderOrder();
  });
  $('#printClose').addEventListener('click', () => { $('#printModal').hidden = true; });
  $('#printDoneClose').addEventListener('click', () => { $('#printModal').hidden = true; });
  $('#staffCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#payConfirm').click(); });

  let paying = false;
  $('#payConfirm').addEventListener('click', async () => {
    if (paying) return;
    const items = Object.entries(order).filter(([, n]) => n > 0).map(([id, copies]) => ({ id, copies }));
    if (!items.length) return;
    const staffCode = $('#staffCode').value.trim();
    if (!staffCode) { $('#printError').textContent = 'Staff: enter the code after taking payment.'; return; }
    paying = true; $('#payConfirm').disabled = true; $('#payConfirm').textContent = 'Checking…'; $('#printError').textContent = '';
    const res = await api('printOrder', { token: state.token, items, staffCode });
    paying = false; $('#payConfirm').disabled = false; $('#payConfirm').textContent = 'Confirm & Print';
    if (!res.ok) { $('#printError').textContent = res.error || 'Could not confirm payment.'; $('#staffCode').select(); return; }

    // Build the print job: one 5R page per copy.
    const pages = [];
    for (const p of photoList()) for (let i = 0; i < (order[p.id] || 0); i++) pages.push(await page5R(p));
    const area = $('#printArea'); area.innerHTML = '';
    pages.forEach(u => { const im = new Image(); im.src = u; area.appendChild(im); });
    const strip = $('#printStrip'); strip.innerHTML = '';
    pages.forEach(u => { const im = new Image(); im.src = u; im.alt = '5R print'; strip.appendChild(im); });
    $('#printDoneMsg').textContent = `Order ${res.orderId} · ${res.total} print${res.total > 1 ? 's' : ''} · ${money(res.amount)} paid`;
    $('#printAgain').hidden = CFG.CAN_PRINT === false;
    $('#printNote').textContent = CFG.CAN_PRINT === false
      ? 'Printing is switched off in this preview. On the booth the print dialog opens with these pages at 5×7 in.'
      : 'In the print dialog choose 5×7 in (127×178 mm) paper, scale 100%, borderless.';
    $('#printPick').hidden = true; $('#printDone').hidden = false; Sound.magic();
    if (CFG.CAN_PRINT !== false) setTimeout(() => window.print(), 400);
  });
  $('#printAgain').addEventListener('click', () => window.print());   // reprints the same paid job (e.g. paper jam)

  $('#finishBtn').addEventListener('click', goIntro);

  function resetSession() {
    clearTimers(); clearInterval(idleT); idleT = null; stopCamera();
    Object.keys(pages5R).forEach(k => delete pages5R[k]);
    ['#saveModal', '#printModal'].forEach(m => $(m).hidden = true); $('#printArea').innerHTML = '';
    Object.assign(state, { demo: false, keepShot: false, photos: null, token: null, character: null, photoB64: null, images: [], layoutId: CFG.LAYOUTS[0].id, finalDataUrl: null, shareCode: null });
    $('#shotPreview').removeAttribute('src'); $('#qr').innerHTML = ''; $('#idleNote').textContent = '';
  }

  /* ---------------- PWA: service worker + first-open install banner ---------------- */
  let deferredPrompt = null;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const seen = () => { try { return localStorage.getItem('installSeen') === '1'; } catch (e) { return false; } };
  const markSeen = () => { try { localStorage.setItem('installSeen', '1'); } catch (e) {} };

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (!seen()) openInstall(); });
  addEventListener('appinstalled', () => { markSeen(); hideInstall(); toast('👑 Installed! Open it from your home screen.'); });
  function openInstall() {
    if (isStandalone() || seen() || !$('[data-screen="intro"]').classList.contains('active')) return;
    const sh = $('#installSheet'), btn = $('#installBtn'), hint = $('#installHint');
    if (deferredPrompt) { hint.textContent = 'Add it to your home screen for full-screen magic.'; btn.hidden = false; }
    else if (isIOS) { hint.innerHTML = 'Tap <b>Share</b> <span aria-hidden="true">⬆️</span> then <b>Add to Home Screen</b>.'; btn.hidden = true; }
    else { hint.textContent = 'Use your browser menu → "Install app" / "Add to Home screen".'; btn.hidden = true; }
    sh.hidden = false; document.body.classList.add('has-install');
  }
  function hideInstall() { $('#installSheet').hidden = true; document.body.classList.remove('has-install'); }
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return; deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {}); deferredPrompt = null; markSeen(); hideInstall();
  });
  $('#installClose').addEventListener('click', () => { markSeen(); hideInstall(); });

  if ('serviceWorker' in navigator && !CFG.EMBED) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  function staffBanner(text) {
    const b = document.createElement('div'); b.className = 'staff-banner'; b.setAttribute('role', 'alert'); b.textContent = text;
    document.body.appendChild(b); document.body.classList.add('has-banner');
  }

  /* ---------------- BOOT ---------------- */
  async function boot() {
    FX.start(); applyPricing(); goIntro(true);
    if (!API_READY) console.warn('[Booth] API_URL not set — running in DEMO mode (PIN 000000).');
    const conf = await apiGet({ action: 'config' });
    // Staff warning: make it obvious when the booth is NOT talking to the real backend.
    if (!API_READY && !CFG.EMBED) staffBanner('⚠️ Offline preview — API_URL in config.js is not set, so pictures are stand-ins (no real AI).');
    else if (API_READY && !conf.ok) staffBanner('⚠️ Cannot reach the booth server. In Apps Script: Deploy → Manage deployments → Edit → Execute as "Me", Who has access "Anyone" → New version. Also check API_URL in config.js.');
    if (conf.ok && conf.print) Object.assign(pricing, conf.print);
    if (conf.ok) applySettings(conf.settings || {});
    if (conf.ok && conf.characters && conf.characters.length) {
      state.characters = conf.characters;
    }
  }
  boot();
})();
