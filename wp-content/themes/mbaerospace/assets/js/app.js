// Manitoba Aerospace & Defence theme. Vanilla, no dependencies.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- header goes solid once the page scrolls ---------- */
  const hdr = $('.hdr');
  const solid = () => hdr && hdr.classList.toggle('solid', scrollY > 30);
  addEventListener('scroll', solid, { passive: true }); solid();

  /* ---------- menu ---------- */
  const menu = $('#menu'), openBtn = $('[data-menu-open]');
  let lastFocus = null;
  function openMenu() {
    lastFocus = document.activeElement;
    menu.hidden = false; void menu.offsetWidth; menu.classList.add('open');
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    $('.menu-close', menu).focus();
  }
  function closeMenu(restore = true) {
    menu.classList.remove('open'); openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    setTimeout(() => { if (!menu.classList.contains('open')) menu.hidden = true; }, 320);
    if (restore && lastFocus) lastFocus.focus();
  }
  if (menu && openBtn) {
    openBtn.addEventListener('click', openMenu);
    $('[data-menu-close]', menu).addEventListener('click', () => closeMenu());
    $$('a[href*="#"]', menu).forEach(a => a.addEventListener('click', () => closeMenu(false)));
    addEventListener('keydown', e => {
      if (!menu.classList.contains('open')) return;
      if (e.key === 'Escape') closeMenu();
      if (e.key === 'Tab') {   // keep focus inside the dialog
        const f = $$('a, button', menu); const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- the pin: one photo, a camera position per step ---------- */
  // f = focal point in the photo (0..1), s = where it lands on screen (0..1), z = zoom over "cover".
  // Tuned to the engine test-cell photo with four steps; any other photo or step count holds still.
  const KEYS_WIDE = [
    { z: 1.00, fx: 0.50, fy: 0.50, sx: 0.50, sy: 0.50 },  // hero: the whole test cell
    { z: 2.00, fx: 0.67, fy: 0.38, sx: 0.70, sy: 0.50 },  // machined: nozzle petals and actuators
    { z: 3.00, fx: 0.99, fy: 0.23, sx: 0.98, sy: 0.45 },  // overhauled: engine case, plume out of frame
    { z: 3.00, fx: 0.99, fy: 0.54, sx: 0.98, sy: 0.50 },  // tested: case and test stand
    { z: 1.00, fx: 0.50, fy: 0.50, sx: 0.50, sy: 0.50 },  // commanded: pull back
  ];
  const KEYS_TALL = [
    { z: 1.00, fx: 0.62, fy: 0.40, sx: 0.50, sy: 0.30 },
    { z: 1.55, fx: 0.69, fy: 0.37, sx: 0.50, sy: 0.30 },
    { z: 1.60, fx: 0.85, fy: 0.25, sx: 0.50, sy: 0.30 },
    { z: 1.60, fx: 0.82, fy: 0.50, sx: 0.50, sy: 0.30 },
    { z: 1.00, fx: 0.55, fy: 0.45, sx: 0.50, sy: 0.30 },
  ];
  const pin = $('.pin'), stage = $('.stage'), shot = $('.stage .shot');
  if (pin && stage) {
    const beats = $$('.beat', stage), ticks = $$('.ticks i', stage), N = beats.length;
    // the zoom path is drawn for the engine photo; an editor picks "Hold the photo still" for any other
    const tuned = N === 4 && pin.dataset.motion === 'engine';
    const still = Array.from({ length: N + 1 }, () => KEYS_WIDE[0]);
    const AR = shot ? +shot.dataset.ar || 1.5 : 1.5;
    let vw = 0, vh = 0, W0 = 0, H0 = 0, keys = KEYS_WIDE, beatNow = -1, raf = 0;

    const size = () => {
      vw = stage.clientWidth; vh = stage.clientHeight;
      W0 = Math.max(vw, vh * AR); H0 = W0 / AR;
      if (shot) { shot.style.width = W0 + 'px'; shot.style.height = H0 + 'px'; }
      keys = !tuned ? still : vw < 760 ? KEYS_TALL : KEYS_WIDE;
      frame();
    };
    const place = k => {
      const w = W0 * k.z, h = H0 * k.z;
      let tx = k.sx * vw - k.fx * w, ty = k.sy * vh - k.fy * h;
      tx = Math.min(0, Math.max(vw - w, tx)); ty = Math.min(0, Math.max(vh - h, ty));
      return { z: k.z, tx, ty };
    };
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    function frame() {
      raf = 0;
      const r = pin.getBoundingClientRect();
      const span = Math.max(1, pin.offsetHeight - vh);
      const p = Math.min(1, Math.max(0, -r.top / span));
      // the hero holds the first tenth, then each step gets an equal share
      const pos = p < 0.1 || !N ? 0 : 1 + Math.min(N - 0.001, (p - 0.1) / 0.9 * N);
      const beat = Math.floor(pos);
      if (beat !== beatNow) {
        beatNow = beat;
        stage.dataset.beat = beat;
        stage.toggleAttribute('data-last', N > 0 && beat === N);
        beats.forEach(b => b.classList.toggle('on', +b.dataset.i === beat));
        ticks.forEach((t, i) => t.classList.toggle('on', i + 1 === beat));
        if (beat > 0) closeResults();
      }
      if (!shot) return;
      let a, b, t;
      if (reduce) { a = b = place(keys[beat]); t = 0; }
      else {
        // hold each camera position for most of its step, move in the last third
        const i = Math.min(N, Math.floor(pos)), local = pos - i;
        const m = i === 0 ? Math.min(1, p / 0.1) : Math.max(0, (local - 0.62) / 0.38);
        a = place(keys[i]); b = place(keys[Math.min(N, i + 1)]); t = ease(i === N ? 0 : m);
      }
      const z = a.z + (b.z - a.z) * t, tx = a.tx + (b.tx - a.tx) * t, ty = a.ty + (b.ty - a.ty) * t;
      shot.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${z.toFixed(4)})`;
    }
    // ponytail: place() clamps translate for zoom >= 1 only; every key uses z >= 1.
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    addEventListener('resize', size);
    if (shot && !shot.complete) shot.addEventListener('load', size, { once: true });
    size();
  }

  /* ---------- find a supplier: member companies from wp-admin ---------- */
  const data = $('#member-data');
  const MEMBERS = data ? JSON.parse(data.textContent) : [];
  const find = $('[data-find]');
  function closeResults() { const r = $('.results'); if (r) r.classList.remove('show'); }
  const STOP = ['and', 'the', 'for', 'of', 'in', 'a', 'an', 'to', 'we', 'need', 'with'];
  function search(text) {
    const words = text.toLowerCase().replace(/[^a-z0-9\- ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.includes(w));
    if (!words.length) return [];
    return MEMBERS.map(m => {
      const name = m.n.toLowerCase(), hay = name + ' ' + m.k;
      // a match in the name or the short capability counts double
      const score = words.reduce((s, w) => {
        const stem = w.length > 4 ? w.slice(0, -1) : w;
        return s + (hay.includes(stem) ? 1 : 0) + ((name + ' ' + m.c.toLowerCase()).includes(stem) ? 1 : 0);
      }, 0);
      return { m, score };
    }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.m.n.localeCompare(b.m.n)).map(r => r.m);
  }
  if (find) {
    const q = $('input', find), box = $('.results', find), res = $('.results-in', box), t = find.dataset;
    const tag = t.tag ? `<p class="tag">${esc(t.tag)}</p>` : '';
    find.addEventListener('submit', e => {
      e.preventDefault();
      const text = q.value.trim();
      if (!text) { q.focus(); res.innerHTML = t.empty ? `<p class="miss">${esc(t.empty)}</p>` : ''; box.classList.toggle('show', !!t.empty); return; }
      const hits = search(text);
      if (hits.length) {
        const top = hits.slice(0, 4);
        res.innerHTML = `${tag}<ol>${top.map(m => `<li><a href="${esc(m.u)}"><b>${esc(m.n)}</b><span>${esc(m.c)}</span></a></li>`).join('')}</ol>` +
          (hits.length > 4 && t.more ? `<p class="more">+${hits.length - 4} <a class="tlink" href="${esc(find.action)}?q=${encodeURIComponent(text)}">${esc(t.more)}</a></p>` : '');
      } else {
        const topic = t.noneTopic ? ` data-reason="${esc(t.noneTopic)}"` : '';
        const link = t.noneUrl ? ` <a href="${esc(t.noneUrl)}"${topic}>${esc(t.noneLabel || t.noneUrl)}</a>` : '';
        res.innerHTML = `${tag}<p class="miss">${esc(t.none)}${link}</p>`;
      }
      box.classList.add('show');
    });
    q.addEventListener('keydown', e => { if (e.key === 'Escape') closeResults(); });
    // any "find a supplier" button returns to the field
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-focus-search]');
      if (!a) return;
      e.preventDefault();
      if (menu && menu.classList.contains('open')) closeMenu(false);
      scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(() => q.focus({ preventScroll: true }), reduce ? 0 : 600);
    });
  }

  /* ---------- links that preset the contact form's topic ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-reason]');
    const sel = $('.mba-form select[name="reason"]');
    if (!a || !sel) return;
    const opt = [...sel.options].find(o => o.value === a.dataset.reason || o.text === a.dataset.reason);
    if (opt) sel.value = opt.value;
  });

  /* ---------- member profiles: filter, ?q= from the home search, #company opens it ---------- */
  const filter = $('[data-member-filter]');
  if (filter) {
    const items = $$('.profile-list li'), count = $('[data-member-count]');
    const run = () => {
      const words = filter.value.toLowerCase().split(/\s+/).filter(w => w.length > 1);
      let n = 0;
      items.forEach(li => {
        const ok = !words.length || words.every(w => li.dataset.words.includes(w.length > 4 ? w.slice(0, -1) : w));
        li.hidden = !ok; if (ok) n++;
      });
      const d = count.dataset;
      count.textContent = words.length ? `${n} ${d.of} ${items.length} ${d.label}` : `${items.length} ${d.label}`;
    };
    filter.addEventListener('input', run);
    const q = new URLSearchParams(location.search).get('q');
    if (q) { filter.value = q; run(); }
    const openHash = () => {
      const li = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      const d = li && $('details', li);
      if (d) { d.open = true; li.scrollIntoView({ block: 'start' }); }
    };
    addEventListener('hashchange', openHash); openHash();
  }

  /* ---------- photo slider ---------- */
  $$('.made').forEach(sec => {
    const rail = $('.rail', sec), prev = $('.prev', sec), next = $('.next', sec);
    if (!rail || !rail.querySelector('article')) return;
    const step = () => rail.querySelector('article').offsetWidth + 24;
    prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
    const state = () => { prev.disabled = rail.scrollLeft < 8; next.disabled = rail.scrollLeft > rail.scrollWidth - rail.clientWidth - 8; };
    rail.addEventListener('scroll', state, { passive: true }); addEventListener('resize', state); state();
    rail.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
    });
  });

  /* ---------- reveal on scroll ---------- */
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else $$('.reveal').forEach(el => el.classList.add('in'));
})();
