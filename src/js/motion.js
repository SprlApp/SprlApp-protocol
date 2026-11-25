// Motion layer. Every function degrades to an instant, motionless result under prefers-reduced-motion.
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
export const reduced = () => mq.matches;

// Damped spring (semi-implicit Euler, fixed 1/240s substeps). x runs 0 -> 1.
export function spring(onUpdate, { stiffness = 170, damping = 22, mass = 1, delay = 0 } = {}) {
  if (reduced()) { onUpdate(1); return () => {}; }
  let x = 0, v = 0, last = 0, raf = 0, dead = false;
  const step = (t) => {
    if (dead) return;
    if (!last) last = t;
    let dt = Math.min(0.05, (t - last) / 1000); last = t;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      v += ((-stiffness * (x - 1) - damping * v) / mass) * h;
      x += v * h; dt -= h;
    }
    onUpdate(x);
    if (Math.abs(x - 1) < 0.0008 && Math.abs(v) < 0.01) { onUpdate(1); return; }
    raf = requestAnimationFrame(step);
  };
  onUpdate(0);
  const start = setTimeout(() => { raf = requestAnimationFrame(step); }, delay);
  return () => { dead = true; clearTimeout(start); cancelAnimationFrame(raf); };
}

export function initReveal(root = document) {
  const items = [...root.querySelectorAll('[data-reveal]')];
  if (reduced() || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
  const apply = (el, p) => { el.style.opacity = Math.max(0, Math.min(1, p)); el.style.transform = `translate3d(0,${(1 - p) * 28}px,0)`; };
  items.forEach((el) => apply(el, 0));
  const io = new IntersectionObserver((entries) => {
    const batch = entries.filter((e) => e.isIntersecting);
    batch.forEach((e, i) => {
      const el = e.target; io.unobserve(el);
      const d = Number(el.dataset.revealDelay || 0) + i * 70;
      spring((p) => apply(el, p), { delay: d });
      setTimeout(() => { el.style.opacity = ''; el.style.transform = ''; el.classList.add('is-in'); }, d + 1400);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach((el) => io.observe(el));
}

export function initProgress(bar) {
  if (!bar) return;
  const upd = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
  };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
}

export function initSpotlight(root = document) {
  root.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('[data-spot]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', e.clientX - r.left + 'px');
    el.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
}

export function initParallax(scope) {
  if (!scope || reduced()) return;
  const layers = [...scope.querySelectorAll('[data-depth]')];
  let px = 0, py = 0, tx = 0, ty = 0, sy = 0, raf = 0;
  addEventListener('pointermove', (e) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; kick(); }, { passive: true });
  addEventListener('scroll', () => { sy = scrollY; kick(); }, { passive: true });
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick() {
    raf = 0; px += (tx - px) * 0.08; py += (ty - py) * 0.08;
    for (const el of layers) {
      const d = Number(el.dataset.depth);
      el.style.setProperty('--px', (px * d * 40).toFixed(2) + 'px');
      el.style.setProperty('--py', (py * d * 40 - sy * d * 0.18).toFixed(2) + 'px');
    }
    if (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) kick();
  }
  tick();
}

// Count-up on first paint, count + directional flash on value change.
export function setNumber(el, value, fmt) {
  const prev = el._v;
  el._v = value;
  if (value === null || value === undefined) { el.textContent = fmt(null); return; }
  if (prev === value) { el.textContent = fmt(value); return; }
  if (!reduced() && prev !== undefined && prev !== null) {
    el.dataset.flash = value > prev ? 'up' : 'down';
    clearTimeout(el._ft); el._ft = setTimeout(() => { delete el.dataset.flash; }, 900);
  }
  if (reduced()) { el.textContent = fmt(value); return; }
  const from = prev === undefined || prev === null ? 0 : prev;
  const t0 = performance.now(), dur = 1100;
  cancelAnimationFrame(el._raf);
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (value - from) * e);
    if (k < 1) el._raf = requestAnimationFrame(tick); else el.textContent = fmt(value);
  };
  el._raf = requestAnimationFrame(tick);
}
