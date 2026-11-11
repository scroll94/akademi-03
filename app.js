// Шаңырақ Code, версия 3: шапка, пульт сайта, наклейки, витрина, форма записи.
// Без библиотек. Мини-уроки живут отдельно, в lab.js.
(() => {
  const root = document.documentElement;
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Шапка: линия появляется после прокрутки ----------
  const nav = $('nav');
  const onScroll = () => nav.classList.toggle('is-stuck', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Появление блоков при прокрутке ----------
  const rise = [...document.querySelectorAll('[data-rise]')];
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    rise.forEach(el => io.observe(el));
  } else rise.forEach(el => el.classList.add('is-in'));

  // ---------- Конфетти ----------
  const party = (x, y) => {
    if (reduce) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const d = Math.min(devicePixelRatio || 1, 2), g = cv.getContext('2d');
    cv.width = innerWidth * d; cv.height = innerHeight * d;
    g.scale(d, d);
    const colors = ['#6a4dff', '#c9f73f', '#ff5a36', '#45c8ff', '#ffcb3d'];
    const bits = Array.from({ length: 130 }, () => {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 11;
      return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)] };
    });
    const t0 = performance.now();
    const tick = now => {
      const k = (now - t0) / 2200;
      g.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.vy += 0.32; b.vx *= 0.985; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.globalAlpha = Math.max(0, 1 - k * k); g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.restore();
      }
      if (k < 1) requestAnimationFrame(tick); else cv.remove();
    };
    requestAnimationFrame(tick);
  };

  // ---------- Пульт сайта: одно значение меняет всю страницу ----------
  const press = (group, btn) => [...group.querySelectorAll('button[aria-pressed]')].forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
  const note = $('console-note');
  const say = html => { if (note) note.innerHTML = html; };
  const accent = $('opt-accent'), heroOpt = $('opt-hero'), theme = $('opt-theme'), word = $('hero-word');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (accent) accent.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    press(accent, b);
    root.dataset.accent = b.dataset.v;
    say(`<b>site.accent = "${b.dataset.v}"</b> — кнопки, заголовки и форма перекрасились разом.`);
  });
  if (heroOpt && word) heroOpt.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    press(heroOpt, b);
    word.textContent = b.textContent;
    word.classList.remove('is-pop'); void word.offsetWidth; word.classList.add('is-pop');
    say(`<b>site.hero = "${b.textContent}"</b> — заголовок переписан. Этому учат на первом же уроке.`);
  });
  if (theme) theme.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'opt-party') {
      const r = b.getBoundingClientRect();
      party(r.left + r.width / 2, r.top);
      say('<b>site.party()</b> — это функция. Её написали один раз, а запускать можно сколько угодно.');
      return;
    }
    press(theme, b);
    if (b.dataset.v === 'dark') root.dataset.theme = 'dark'; else delete root.dataset.theme;
    if (meta) meta.content = b.dataset.v === 'dark' ? '#15131f' : '#f3efe6';
    say(`<b>site.theme = "${b.dataset.v === 'dark' ? 'ночь' : 'день'}"</b> — вся страница поменяла цвета одной строкой.`);
  });

  // ---------- Наклейки можно таскать ----------
  document.querySelectorAll('.sticker').forEach(st => {
    let sx = 0, sy = 0, ox = 0, oy = 0, held = false;
    st.addEventListener('pointerdown', e => { held = true; sx = e.clientX; sy = e.clientY; st.classList.add('is-held'); st.setPointerCapture(e.pointerId); });
    st.addEventListener('pointermove', e => { if (held) st.style.translate = `${ox + e.clientX - sx}px ${oy + e.clientY - sy}px`; });
    const drop = e => { if (!held) return; held = false; ox += e.clientX - sx; oy += e.clientY - sy; };
    st.addEventListener('pointerup', drop);
    st.addEventListener('pointercancel', drop);
  });

  // ---------- Витрина: 3D-сцены открываются на весь экран ----------
  const viewer = $('viewer'), frame = $('viewer-frame');
  document.querySelectorAll('.show').forEach(b => b.addEventListener('click', () => {
    if (!viewer || !viewer.showModal) { open(b.dataset.open, '_blank', 'noopener'); return; }
    $('viewer-title').textContent = b.dataset.title;
    frame.title = b.dataset.title;
    frame.src = b.dataset.open;
    viewer.showModal();
    root.style.overflow = 'hidden';
  }));
  if (viewer) {
    $('viewer-close').addEventListener('click', () => viewer.close());
    viewer.addEventListener('close', () => { frame.src = 'about:blank'; root.style.overflow = ''; });
    // фокус уходит внутрь сцены, поэтому Esc ловим и там
    frame.addEventListener('load', () => { try { frame.contentWindow.addEventListener('keydown', e => { if (e.key === 'Escape' && viewer.open) viewer.close(); }); } catch (_) {} });
  }

  // ---------- Заявка: собираем текст и открываем WhatsApp, на сервер ничего не уходит ----------
  const form = $('join-form'), done = $('join-done'), doneText = $('done-text'), copyBtn = $('copy-btn'), waBtn = $('wa-btn');
  const WA_URL = 'https://wa.me/77055823688';
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      let first = null;
      form.querySelectorAll('[required]').forEach(f => {
        const bad = f.type === 'checkbox' ? !f.checked : !f.value.trim();
        f.closest('.field').classList.toggle('is-bad', bad);
        f.setAttribute('aria-invalid', String(bad));
        if (bad && !first) first = f;
      });
      if (first) { first.focus(); return; }
      const d = new FormData(form);
      doneText.textContent = ['Сәлем! Хочу на бесплатный пробный урок в Шаңырақ Code.', `Имя: ${d.get('name').trim()}`, `Возраст: ${d.get('age')}`, `Направление: ${d.get('dir')}`].join('\n');
      const wa = WA_URL + '?text=' + encodeURIComponent(doneText.textContent);
      waBtn.href = wa;
      window.open(wa, '_blank', 'noopener');
      copyBtn.textContent = 'Скопировать';
      form.hidden = true;
      done.hidden = false;
      done.querySelector('h3').focus();
      const r = done.getBoundingClientRect();
      party(r.left + r.width / 2, r.top + 40);
    });
    form.addEventListener('input', e => {
      const f = e.target.closest('.field');
      if (f && f.classList.contains('is-bad') && (e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim())) { f.classList.remove('is-bad'); e.target.setAttribute('aria-invalid', 'false'); }
    });
    copyBtn.addEventListener('click', () => {
      const select = () => { const r = document.createRange(); r.selectNodeContents(doneText); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copyBtn.textContent = 'Текст выделен'; };
      try { navigator.clipboard.writeText(doneText.textContent).then(() => { copyBtn.textContent = 'Скопировано'; }, select); } catch (_) { select(); }
    });
    $('edit-btn').addEventListener('click', () => { done.hidden = true; form.hidden = false; $('f-name').focus(); });
  }

  // ---------- Плавающая кнопка WhatsApp: не мешает на первом экране, в мини-уроках и у формы ----------
  const fab = $('wa-float');
  if (fab && 'IntersectionObserver' in window) {
    const near = new Set();
    const io = new IntersectionObserver(es => { es.forEach(e => (e.isIntersecting ? near.add(e.target) : near.delete(e.target))); fab.classList.toggle('is-away', near.size > 0); }, { threshold: 0.2 });
    ['.hero', '.lab-box', '#join'].forEach(s => { const el = document.querySelector(s); if (el) io.observe(el); });
  }
})();
