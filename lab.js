// ===== Мини-уроки: бот, парабола и игра =====
// Без библиотек. Каждая сцена рисуется, только пока её вкладка открыта и видна на экране.
(() => {
  const lab = document.getElementById('try');
  if (!lab) return;
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cssVar = (name, fallback) => getComputedStyle(lab.querySelector('.lab-box')).getPropertyValue(name).trim() || fallback;
  const COL = {
    gold: cssVar('--gold', '#e8b64a'), goldSoft: cssVar('--gold-soft', '#f4d48a'), sky: cssVar('--sky', '#3cc6dc'),
    felt: cssVar('--felt', '#e65f43'), milk: cssVar('--milk', '#f4ecdf'), night: cssVar('--night', '#0a1430'), night3: cssVar('--night-3', '#172856')
  };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);
  // Холст под размер блока; возвращает false, пока блок скрыт
  const fitCanvas = (cv, box) => {
    const w = box.clientWidth, h = box.clientHeight, d = dprOf();
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    return { w, h, d };
  };
  // Задание выполнено: подпись меняется на «Готово» и объясняет, что будет на уроке
  const done = (id, text) => {
    const el = $(id);
    if (!el) return;
    el.classList.add('is-done');
    el.querySelector('b').textContent = 'Готово';
    el.querySelector('span').textContent = text;
  };
  const hint = (id, text) => { const el = $(id); if (el && !el.classList.contains('is-done')) el.querySelector('span').textContent = text; };

  // ---------- Вкладки ----------
  const tabs = [...lab.querySelectorAll('[role="tab"]')];
  const panes = tabs.map(t => $(t.getAttribute('aria-controls')));
  const hooks = {}; // id панели → { show, hide }
  const select = (i, focus) => {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (!on && !panes[k].hidden && hooks[panes[k].id]) hooks[panes[k].id].hide();
      panes[k].hidden = !on;
    });
    if (focus) tabs[i].focus();
    if (hooks[panes[i].id]) hooks[panes[i].id].show();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', e => {
      const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if (to === null) return;
      e.preventDefault();
      select((to + tabs.length) % tabs.length, true);
    });
  });

  // ---------- Код: чат-бот ----------
  (() => {
    const nameIn = $('bot-name'), helloIn = $('bot-hello'), log = $('chat-log'), form = $('chat-form'), input = $('chat-in');
    if (!nameIn || !helloIn || !log || !form) return;
    const fitInput = el => { el.style.width = Math.max(4, [...el.value].length + 1) + 'ch'; };
    const botName = () => nameIn.value.trim() || 'Бот';
    const syncName = () => {
      fitInput(nameIn);
      $('chat-name').textContent = botName();
      $('chat-ava').textContent = [...botName()][0].toUpperCase();
    };
    let edited = false;
    nameIn.addEventListener('input', syncName);
    helloIn.addEventListener('input', () => { fitInput(helloIn); edited = true; });
    syncName();
    fitInput(helloIn);

    const say = (text, mine) => {
      const p = document.createElement('p');
      p.className = 'chat-msg ' + (mine ? 'is-me' : 'is-bot');
      p.textContent = text;
      log.appendChild(p);
      while (log.children.length > 40) log.firstElementChild.remove();
      log.scrollTop = log.scrollHeight;
    };

    // Пример считается своим разбором, без eval: числа, скобки, + − × ÷.
    // Возвращает { text, value } или null, если в сообщении нет примера.
    const calc = msg => {
      const m = msg.match(/[\d(][\d\s.,+\-*/×÷:()xх·−–]*[\d)]/i);
      if (!m) return null;
      const s = m[0].replace(/\s+/g, '').replace(/[×xх·]/gi, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-').replace(/,/g, '.');
      if (!/[+\-*/]/.test(s.slice(1))) return null;
      let i = 0;
      const num = () => {
        const from = i;
        while (i < s.length && /[\d.]/.test(s[i])) i++;
        const v = Number(s.slice(from, i));
        if (from === i || Number.isNaN(v)) throw new Error('число');
        return v;
      };
      const atom = () => {
        if (s[i] === '(') { i++; const v = sum(); if (s[i] !== ')') throw new Error('скобка'); i++; return v; }
        if (s[i] === '-') { i++; return -atom(); }
        if (s[i] === '+') { i++; return atom(); }
        return num();
      };
      const mul = () => { let v = atom(); while (s[i] === '*' || s[i] === '/') { const op = s[i++], r = atom(); v = op === '*' ? v * r : v / r; } return v; };
      const sum = () => { let v = mul(); while (s[i] === '+' || s[i] === '-') { const op = s[i++], r = mul(); v = op === '+' ? v + r : v - r; } return v; };
      try {
        const value = sum();
        if (i !== s.length) return null;
        const text = s.replace(/\./g, ',').replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ').replace(/([\d)])-/g, '$1 − ').replace(/-/g, '−');
        return { text, value };
      } catch (_) { return null; }
    };
    const fmt = v => (Math.round(v * 1e6) / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 6 }).replace('-', '−');

    let solved = false;
    const answer = msg => {
      const t = msg.toLowerCase();
      if (/привет|сәлем|салем|салам|здравств|добрый|hello|хай/.test(t)) return { text: helloIn.value.trim() || 'Сәлем!', greeting: true };
      const c = calc(msg);
      if (c) return { text: Number.isFinite(c.value) ? `${c.text} = ${fmt(c.value)}` : 'На ноль делить нельзя' };
      return { text: 'Я пока учусь: умею здороваться и считать. На уроке научишь меня большему' };
    };
    const send = raw => {
      const msg = raw.trim().slice(0, 60);
      if (!msg) return;
      say(msg, true);
      const { text, greeting: isGreeting } = answer(msg);
      const typing = document.createElement('p');
      typing.className = 'chat-msg is-bot is-typing';
      typing.setAttribute('aria-hidden', 'true');
      typing.innerHTML = '<i></i><i></i><i></i>';
      log.appendChild(typing);
      log.scrollTop = log.scrollHeight;
      setTimeout(() => {
        typing.remove();
        say(text, false);
        if (solved) return;
        if (isGreeting && edited) { solved = true; done('code-task', 'Бот отвечает твоими словами. На уроках подключим его к Telegram и к нейросети.'); }
        else if (isGreeting) hint('code-task', 'Бот ответил. Теперь измени приветствие во второй строке кода и напиши «привет» ещё раз.');
      }, reduce ? 0 : 520);
    };
    form.addEventListener('submit', e => { e.preventDefault(); send(input.value); input.value = ''; });
    $('chat-chips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) send(b.textContent); });
    say('Напиши мне «привет» или пример: 2 + 2 * 2', false);
  })();

  // ---------- Математика: парабола через звёзды ----------
  (() => {
    const cv = $('m-cv'), A = $('m-a'), Pm = $('m-p'), Q = $('m-q');
    if (!cv || !A || !Pm || !Q) return;
    const g = cv.getContext('2d'), box = cv.parentElement, next = $('m-next'), badge = $('m-level');
    // Звёзды подобраны так, чтобы ответ попадал на деления ползунков
    const LEVELS = [
      [[-1, 2], [3, 2]],
      [[-2, -1], [0, 3], [2, -1]],
      [[-3, -2], [-1, -4], [1, -2]]
    ];
    let level = 0, solved = false, everSolved = false, pulse = 0, raf = 0;
    const num = v => String(Math.round(v * 100) / 100).replace('-', '−').replace('.', ',');
    const val = () => ({ a: +A.value, p: +Pm.value, q: +Q.value });
    const f = (x, v) => v.a * (x - v.p) * (x - v.p) + v.q;
    const formula = v => {
      if (v.a === 0) return 'y = ' + num(v.q);
      const head = v.a === 1 ? '' : v.a === -1 ? '−' : num(v.a) + '·';
      const core = v.p === 0 ? 'x²' : `(x ${v.p > 0 ? '−' : '+'} ${num(Math.abs(v.p))})²`;
      const tail = v.q === 0 ? '' : ` ${v.q > 0 ? '+' : '−'} ${num(Math.abs(v.q))}`;
      return `y = ${head}${core}${tail}`;
    };
    const hits = v => LEVELS[level].map(([x, y]) => Math.abs(f(x, v) - y) < 0.13);

    const star = (x, y, r, lit) => {
      g.save();
      g.translate(x, y);
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath();
      if (lit) { g.shadowColor = COL.gold; g.shadowBlur = 16; g.fillStyle = COL.goldSoft; g.fill(); }
      else { g.fillStyle = rgba(COL.night, 0.9); g.fill(); g.lineWidth = 1.6; g.strokeStyle = rgba(COL.gold, 0.85); g.stroke(); }
      g.restore();
    };
    const draw = () => {
      const s = fitCanvas(cv, box);
      if (!s) return;
      const { w: W, h: H } = s, v = val();
      g.setTransform(s.d, 0, 0, s.d, 0, 0);
      g.clearRect(0, 0, W, H);
      const u = Math.min(H / 11, W / 11.5), ox = W / 2, oy = H / 2 + u * 0.5;
      const X = x => ox + x * u, Y = y => oy - y * u;
      // сетка и оси
      g.lineWidth = 1;
      g.strokeStyle = rgba(COL.milk, 0.07);
      g.beginPath();
      for (let x = Math.ceil(-ox / u); x * u + ox <= W; x++) { g.moveTo(Math.round(X(x)) + 0.5, 0); g.lineTo(Math.round(X(x)) + 0.5, H); }
      for (let y = Math.ceil(-(H - oy) / u); oy - y * u >= 0; y++) { g.moveTo(0, Math.round(Y(y)) + 0.5); g.lineTo(W, Math.round(Y(y)) + 0.5); }
      g.stroke();
      g.strokeStyle = rgba(COL.milk, 0.34);
      g.beginPath();
      g.moveTo(0, Math.round(oy) + 0.5); g.lineTo(W, Math.round(oy) + 0.5);
      g.moveTo(Math.round(ox) + 0.5, 0); g.lineTo(Math.round(ox) + 0.5, H);
      g.stroke();
      g.fillStyle = rgba(COL.milk, 0.45);
      g.font = '500 11px ui-monospace, Menlo, Consolas, monospace';
      g.textAlign = 'center'; g.textBaseline = 'top';
      [-4, -2, 2, 4].forEach(n => g.fillText(String(n).replace('-', '−'), X(n), oy + 5));
      g.textAlign = 'right'; g.textBaseline = 'middle';
      [-4, -2, 2, 4].forEach(n => g.fillText(String(n).replace('-', '−'), ox - 6, Y(n)));
      g.fillText('x', W - 8, oy - 10);
      g.textAlign = 'left';
      g.fillText('y', ox + 8, 10);
      // парабола
      const hit = hits(v), all = hit.every(Boolean);
      g.save();
      g.lineWidth = 2.6; g.lineJoin = 'round';
      g.strokeStyle = all ? COL.goldSoft : COL.sky;
      g.shadowColor = all ? COL.gold : COL.sky;
      g.shadowBlur = all ? 14 + pulse * 10 : 8;
      g.beginPath();
      let pen = false;
      for (let px = -2; px <= W + 2; px += 2) {
        const y = Y(f((px - ox) / u, v));
        if (y < -40 || y > H + 40) { pen = false; continue; }
        if (pen) g.lineTo(px, y); else { g.moveTo(px, y); pen = true; }
      }
      g.stroke();
      g.restore();
      // вершина
      if (v.a !== 0) {
        g.fillStyle = all ? COL.goldSoft : COL.sky;
        g.beginPath(); g.arc(X(v.p), Y(v.q), 4, 0, Math.PI * 2); g.fill();
      }
      // звёзды
      LEVELS[level].forEach(([x, y], i) => star(X(x), Y(y), (hit[i] ? 11 : 9) * (1 + (hit[i] ? pulse * 0.25 : 0)), hit[i]));
      return all;
    };
    const update = () => {
      const v = val();
      $('m-a-o').textContent = num(v.a); $('m-p-o').textContent = num(v.p); $('m-q-o').textContent = num(v.q);
      $('m-main').textContent = formula(v);
      $('m-exp').textContent = v.a === 0 ? 'при a = 0 это уже прямая' : `вершина в точке (${num(v.p)}; ${num(v.q)})`;
      const all = draw();
      if (all && !solved) {
        solved = true; everSolved = true;
        badge.textContent = `Задача ${level + 1} из ${LEVELS.length}: решена`;
        done('math-task', `Решено: ${formula(v)}. Так на уроках формула превращается в картинку.`);
        next.hidden = false;
        if (!reduce) {
          const t0 = performance.now();
          cancelAnimationFrame(raf);
          const tick = now => { const k = (now - t0) / 700; pulse = k >= 1 ? 0 : Math.sin(k * Math.PI); draw(); if (k < 1) raf = requestAnimationFrame(tick); };
          raf = requestAnimationFrame(tick);
        }
      }
    };
    [A, Pm, Q].forEach(el => el.addEventListener('input', update));
    next.addEventListener('click', () => {
      level = (level + 1) % LEVELS.length;
      solved = false;
      A.value = 1; Pm.value = 0; Q.value = 0;
      badge.textContent = `Задача ${level + 1} из ${LEVELS.length}`;
      next.hidden = true;
      const el = $('math-task');
      el.classList.remove('is-done');
      el.querySelector('b').textContent = 'Задание';
      el.querySelector('span').textContent = LEVELS[level].length > 2 ? 'Теперь звёзд три: через них проходит только одна парабола.' : 'Двигай ползунки, чтобы парабола прошла через все звёзды.';
      update();
      A.focus();
    });
    hooks['lab-p-math'] = { show: update, hide: () => cancelAnimationFrame(raf) };
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (!cv.closest('[hidden]')) draw(); }).observe(box);
    update();
  })();

  // ---------- Игра: раннер, который настраивается числами в коде ----------
  (() => {
    const cv = $('g-cv'), stage = $('g-stage');
    if (!cv || !stage) return;
    const g = cv.getContext('2d');
    const ctl = { jump: $('g-jump'), gravity: $('g-gravity'), speed: $('g-speed') };
    const out = { jump: $('g-jump-o'), gravity: $('g-gravity-o'), speed: $('g-speed-o') };
    const startBtn = $('g-start'), startText = $('g-start-t'), tip = $('g-tip'), scoreEl = $('g-score'), bestEl = $('g-best');
    const P = { jump: +ctl.jump.value, gravity: +ctl.gravity.value, speed: +ctl.speed.value };
    const GROUND = 34, SIZE = 24, GOAL = 5, STEP = 1 / 60;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const HOW = matchMedia('(hover: none), (pointer: coarse)').matches ? 'Нажимай на поле — герой прыгает' : 'Пробел или клик — прыжок';
    tip.textContent = HOW;
    let W = 0, H = 0, D = 1, state = 'idle', onScreen = false, won = false, byKey = false;
    let hero = { z: 0, vz: 0, rot: 0, squash: 0, air: false }, obs = [], coins = [], parts = [];
    let score = 0, best = 0, dist = 0, nextObs = 0, buffer = 0, shake = 0, last = 0, acc = 0, raf = 0;
    // звёзды неба в долях холста: не прыгают при изменении размера
    const sky = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: rnd(0.5, 1.4), a: rnd(0.25, 0.8) }));
    const heroX = () => Math.max(44, W * 0.2);
    const airFrames = () => (2 * P.jump) / P.gravity;
    const apex = () => (P.jump * P.jump) / (2 * P.gravity);

    const puff = (x, z, n, color) => {
      if (reduce) return;
      for (let i = 0; i < n; i++) parts.push({ x, z, vx: rnd(-2.2, 2.2), vz: rnd(0.5, 3.6), life: 1, size: rnd(2, 4.5), color });
    };
    const add = n => {
      score += n;
      scoreEl.textContent = score;
      if (score > best) { best = score; bestEl.textContent = best; }
      if (score >= GOAL && !won) { won = true; done('game-task', `${GOAL} очков! На уроках соберём такую игру в Roblox Studio или Godot — уже с твоими уровнями.`); }
    };
    const reset = () => {
      hero = { z: 0, vz: 0, rot: 0, squash: 0, air: false };
      obs = []; coins = []; parts = [];
      score = 0; dist = 0; nextObs = 260; buffer = 0; shake = 0;
      scoreEl.textContent = '0';
    };
    const hop = () => {
      if (hero.air) { buffer = 7; return; }
      hero.vz = P.jump; hero.z = 0.01; hero.air = true; hero.squash = -0.5;
      puff(heroX() + SIZE / 2, 0, 5, COL.goldSoft);
    };
    const spawn = () => {
      const gap = Math.max(210, airFrames() * P.speed * rnd(1.15, 1.9) + 60);
      obs.push({ x: W + 30, w: rnd(16, 24), h: rnd(20, 40), done: false });
      // монета посередине следующего промежутка: её можно взять только в прыжке
      if (Math.random() < 0.6) coins.push({ x: W + 30 + gap / 2, z: Math.min(84, Math.max(38, apex() * 0.7)), t: Math.random() * 6 });
      nextObs = dist + gap;
    };
    const crash = o => {
      state = 'over';
      shake = reduce ? 0 : 9;
      puff(heroX() + SIZE / 2, hero.z + SIZE / 2, 18, COL.felt);
      stage.classList.remove('is-run');
      tip.textContent = apex() < o.h + 4 ? 'Прыжок ниже препятствия: увеличь jump или уменьши gravity' : 'Бум! Поменяй числа в коде и попробуй ещё';
      startText.textContent = 'Ещё раз';
      startBtn.hidden = false;
      // играли с клавиатуры — фокус на кнопку: следующий пробел перезапустит игру, а не прокрутит страницу
      if (byKey) startBtn.focus({ preventScroll: true });
    };
    const stepParts = () => {
      for (const p of parts) { p.x += p.vx; p.z += p.vz; p.vz -= 0.22; p.life -= 0.035; }
      parts = parts.filter(p => p.life > 0);
      shake *= 0.86;
    };
    const step = () => {
      if (buffer > 0) buffer--;
      if (hero.air) {
        hero.vz -= P.gravity;
        hero.z += hero.vz;
        hero.rot += Math.PI / Math.max(8, airFrames());
        if (hero.z <= 0) {
          hero.z = 0; hero.vz = 0; hero.air = false; hero.squash = 1;
          hero.rot = Math.round(hero.rot / (Math.PI / 2)) * (Math.PI / 2);
          puff(heroX() + SIZE / 2, 0, 4, COL.gold);
          if (buffer > 0) { buffer = 0; hop(); }
        }
      }
      hero.squash *= 0.8;
      dist += P.speed;
      if (dist >= nextObs) spawn();
      const hx = heroX();
      for (const o of obs) {
        o.x -= P.speed;
        if (!o.done && o.x + o.w < hx) { o.done = true; add(1); }
        if (o.x < hx + SIZE - 4 && o.x + o.w > hx + 4 && hero.z < o.h - 3) { crash(o); return; }
      }
      obs = obs.filter(o => o.x + o.w > -10);
      for (const c of coins) {
        c.x -= P.speed; c.t += 0.12;
        if (Math.abs(c.x - (hx + SIZE / 2)) < 17 && c.z > hero.z - 9 && c.z < hero.z + SIZE + 9) { c.got = true; add(1); puff(c.x, c.z, 9, COL.goldSoft); }
      }
      coins = coins.filter(c => !c.got && c.x > -20);
      stepParts();
    };

    const yurt = (x, gy, s) => {
      // силуэт юрты на горизонте
      const w = 74 * s, wall = 15 * s, dome = 24 * s;
      g.beginPath();
      g.moveTo(x - w / 2, gy); g.lineTo(x - w / 2, gy - wall);
      g.quadraticCurveTo(x - w * 0.36, gy - wall - dome, x - w * 0.07, gy - wall - dome - 3 * s);
      g.lineTo(x + w * 0.07, gy - wall - dome - 3 * s);
      g.quadraticCurveTo(x + w * 0.36, gy - wall - dome, x + w / 2, gy - wall);
      g.lineTo(x + w / 2, gy); g.closePath(); g.fill();
    };
    const draw = () => {
      const s = fitCanvas(cv, stage);
      if (!s) return;
      W = s.w; H = s.h; D = s.d;
      g.setTransform(D, 0, 0, D, 0, 0);
      g.clearRect(0, 0, W, H);
      g.save();
      if (shake > 0.5) g.translate(rnd(-shake, shake) * 0.5, rnd(-shake, shake) * 0.5);
      const gy = H - GROUND, hx = heroX();
      // небо: звёзды и шаңырақ вместо луны
      for (const st of sky) { g.fillStyle = rgba(COL.milk, st.a); g.beginPath(); g.arc(st.x * W, st.y * gy, st.r, 0, Math.PI * 2); g.fill(); }
      const mx = W - Math.min(76, W * 0.2), my = Math.min(70, gy * 0.34), mr = Math.min(30, gy * 0.15);
      const glow = g.createRadialGradient(mx, my, 0, mx, my, mr * 3);
      glow.addColorStop(0, rgba(COL.gold, 0.26)); glow.addColorStop(1, rgba(COL.gold, 0));
      g.fillStyle = glow; g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
      g.strokeStyle = rgba(COL.gold, 0.7); g.lineWidth = 2.4;
      g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = rgba(COL.gold, 0.4); g.lineWidth = 1.6;
      g.beginPath();
      for (const k of [-0.36, 0.36]) {
        g.moveTo(mx - mr * 0.93, my + mr * k); g.quadraticCurveTo(mx, my + mr * (k - 0.22), mx + mr * 0.93, my + mr * k);
        g.moveTo(mx + mr * k, my - mr * 0.93); g.quadraticCurveTo(mx + mr * (k - 0.22), my, mx + mr * k, my + mr * 0.93);
      }
      g.stroke();
      // далёкие юрты едут медленнее земли
      g.fillStyle = '#262240';
      const period = 320, shift = (dist * 0.22) % period;
      for (let x = -period; x < W + period; x += period) { yurt(x + 90 - shift, gy, 1); yurt(x + 236 - shift, gy, 0.66); }
      // земля с орнаментом
      g.fillStyle = COL.night3; g.fillRect(0, gy, W, GROUND);
      g.fillStyle = COL.gold; g.fillRect(0, gy, W, 2);
      g.fillStyle = rgba(COL.gold, 0.5);
      const off = dist % 30;
      for (let x = -off; x < W + 30; x += 30) { g.save(); g.translate(x + 15, gy + 17); g.rotate(Math.PI / 4); g.fillRect(-3.5, -3.5, 7, 7); g.restore(); }
      // пунктир: как далеко и высоко прыгнет герой с такими числами
      if (state !== 'run') {
        g.fillStyle = rgba(COL.milk, 0.6);
        const n = Math.ceil(airFrames());
        for (let k = 0; k <= n; k += 2) {
          const z = Math.max(0, k * P.jump - (P.gravity * k * (k + 1)) / 2), x = hx + SIZE / 2 + P.speed * k;
          if (x > W) break;
          g.beginPath(); g.arc(x, gy - z - SIZE / 2, 1.7, 0, Math.PI * 2); g.fill();
        }
      }
      // препятствия
      for (const o of obs) {
        const top = gy - o.h, cap = o.w * 0.48;
        g.fillStyle = COL.felt;
        g.beginPath(); g.moveTo(o.x, gy); g.lineTo(o.x, top + cap); g.lineTo(o.x + o.w / 2, top); g.lineTo(o.x + o.w, top + cap); g.lineTo(o.x + o.w, gy); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.2)';
        g.beginPath(); g.moveTo(o.x, gy); g.lineTo(o.x, top + cap); g.lineTo(o.x + o.w / 2, top); g.lineTo(o.x + o.w / 2, gy); g.closePath(); g.fill();
      }
      // монеты крутятся
      for (const c of coins) {
        const k = Math.abs(Math.cos(c.t));
        g.save(); g.translate(c.x, gy - c.z); g.scale(0.25 + 0.75 * k, 1); g.rotate(Math.PI / 4);
        g.fillStyle = COL.gold; g.fillRect(-6, -6, 12, 12);
        g.fillStyle = COL.goldSoft; g.fillRect(-3, -3, 6, 6);
        g.restore();
      }
      // герой: тень, квадрат с глазом, сжимается при приземлении
      if (state !== 'over') {
        const k = Math.max(0.25, 1 - hero.z / 150);
        g.fillStyle = `rgba(0,0,0,${0.32 * k})`;
        g.beginPath(); g.ellipse(hx + SIZE / 2, gy + 3, (SIZE / 2 + 2) * k, 3.2 * k, 0, 0, Math.PI * 2); g.fill();
        g.save();
        g.translate(hx + SIZE / 2, gy - hero.z - SIZE / 2 + hero.squash * 3);
        g.rotate(hero.rot);
        g.scale(1 + hero.squash * 0.2, 1 - hero.squash * 0.24);
        g.fillStyle = COL.milk;
        g.beginPath();
        if (g.roundRect) g.roundRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE, 5); else g.rect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
        g.fill();
        g.lineWidth = 1.5; g.strokeStyle = COL.gold; g.stroke();
        g.fillStyle = COL.night; g.fillRect(3, -6, 5, 5);
        g.restore();
      }
      // частицы
      for (const p of parts) { g.fillStyle = rgba(p.color, Math.max(0, p.life)); g.fillRect(p.x - p.size / 2, gy - p.z - p.size / 2, p.size, p.size); }
      g.restore();
    };

    const frame = now => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (state === 'run') { acc += dt; while (acc >= STEP && state === 'run') { step(); acc -= STEP; } }
      else stepParts();
      draw();
      if (state === 'run' || parts.length || shake > 0.5) raf = requestAnimationFrame(frame);
    };
    const run = () => { cancelAnimationFrame(raf); last = performance.now(); acc = 0; raf = requestAnimationFrame(frame); };
    const start = () => {
      reset();
      state = 'run';
      stage.classList.add('is-run');
      startBtn.hidden = true;
      run();
    };
    // Игра не идёт сама по себе: уходит с экрана или со вкладки — ждёт кнопку «Играть»
    const stop = () => {
      if (state !== 'run') return;
      cancelAnimationFrame(raf);
      state = 'idle';
      stage.classList.remove('is-run');
      tip.textContent = HOW;
      startText.textContent = 'Играть';
      startBtn.hidden = false;
      reset();
      draw();
    };

    startBtn.addEventListener('click', start);
    cv.addEventListener('pointerdown', e => { if (e.button > 0) return; byKey = false; if (state === 'run') hop(); });
    addEventListener('keydown', e => {
      if (state !== 'run' || (e.code !== 'Space' && e.code !== 'ArrowUp')) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, button, a, [role="tab"]')) return;
      e.preventDefault();
      byKey = true;
      hop();
    });
    Object.keys(ctl).forEach(k => ctl[k].addEventListener('input', () => {
      P[k] = +ctl[k].value;
      out[k].textContent = String(P[k]);
      if (state !== 'run') draw();
    }));
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (!onScreen) stop(); }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (!cv.closest('[hidden]') && state !== 'run') draw(); }).observe(stage);
    hooks['lab-p-game'] = { show: draw, hide: stop };
    reset();
  })();

  // ---------- Кнопки «Хочу на такой урок»: направление сразу подставляется в форму записи ----------
  document.querySelectorAll('[data-pick]').forEach(a => a.addEventListener('click', () => {
    const sel = $('f-dir'), form = $('join-form'), ready = $('join-done');
    if (!sel) return;
    if (ready && form && !ready.hidden) { ready.hidden = true; form.hidden = false; }
    sel.value = a.dataset.pick;
  }));
})();
