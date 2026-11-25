import { createStore, hrefOf, handleOf, isStated } from './register.js';
import { evaluateGates } from './gates.js';
import { scanText } from './scan.js';
import { loadMarket } from './market.js';
import { loadOwn, composeBoard } from './own.js';
import { fmtPrice, fmtCompact, fmtChange, shortAddr, letterOf, hashIndex, DASH } from './format.js';
import { h, xIcon, ghIcon } from './dom.js';
import { initReveal, initProgress, initSpotlight, initParallax, setNumber, reduced } from './motion.js';

const BRAND = 'brand/sprl-logo-96.png';
const POLL_MS = 60000;
const store = createStore();
const $ = (s, r = document) => r.querySelector(s);
const slot = (n) => $(`[data-slot="${n}"]`);

const state = { trending: [], haveMarket: false, marketError: false, own: null, ownLoading: false };

/* ---------- register-driven chrome ---------- */
function renderSocials() {
  const box = slot('social'); box.replaceChildren();
  const defs = [['x', 'X', xIcon], ['github', 'GitHub', ghIcon]];
  for (const [name, label, icon] of defs) {
    const rec = store.record(name), href = hrefOf(rec), handle = handleOf(rec);
    box.append(href
      ? h('a', { class: 'soc', 'data-register': name, href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `SPRL on ${label}${handle ? ' (@' + handle + ')' : ''}`, title: `${label}${handle ? ' @' + handle : ''}` }, icon())
      : h('span', { class: 'soc', 'data-register': name, role: 'img', 'aria-disabled': 'true', 'aria-label': `${label} (not published yet)` }, icon()));
  }
  const x = hrefOf(store.record('x')), handle = handleOf(store.record('x'));
  slot('cta-x').replaceChildren(x
    ? h('a', { class: 'btn lg', href: x, target: '_blank', rel: 'noopener noreferrer' }, xIcon(), 'Follow' + (handle ? ' @' + handle : ''))
    : h('span', { class: 'btn lg', 'aria-disabled': 'true' }, xIcon(), 'X account soon'));
  const fc = slot('foot-community'); [...fc.querySelectorAll('a,span')].forEach((n) => n.remove());
  for (const [name, label] of [['x', 'X'], ['github', 'GitHub']]) {
    const href = hrefOf(store.record(name));
    fc.append(href ? h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label) : h('span', { 'aria-disabled': 'true' }, label));
  }
  slot('rpc').textContent = new URL(store.record('chain').rpc).host;
}

let copyTimer = 0;
function renderCA() {
  const box = slot('ca'), rec = store.record('ca'), live = isStated(rec);
  box.replaceChildren();
  const wrap = h('div', { class: 'ca', 'data-state': rec.state });
  wrap.append(h('span', { class: 'ca-label' }, 'CA'));
  if (live) {
    const btn = h('button', { class: 'ca-value', type: 'button', 'data-ca-exempt': '', 'aria-label': 'Mint address, click to copy' }, rec.value);
    const copy = h('button', { class: 'ca-copy', type: 'button', 'aria-live': 'polite' }, 'Copy');
    const doCopy = async () => {
      try { await navigator.clipboard.writeText(store.record('ca').value); }
      catch { const t = h('textarea', {}, store.record('ca').value); document.body.append(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); }
      wrap.classList.add('copied'); copy.textContent = 'Copied';
      clearTimeout(copyTimer); copyTimer = setTimeout(() => { wrap.classList.remove('copied'); copy.textContent = 'Copy'; }, 1600);
    };
    btn.addEventListener('click', doCopy); copy.addEventListener('click', doCopy);
    wrap.append(btn, copy);
  } else {
    wrap.append(h('span', { class: 'ca-value empty', 'aria-disabled': 'true' }, 'Mint address still pending'),
      h('button', { class: 'ca-copy', type: 'button', disabled: true }, 'Copy'));
  }
  box.append(wrap);
}

/* ---------- logos ---------- */
function letterTile(sym, key) { return h('div', { class: `tile t${hashIndex(key || sym, 6)}`, 'aria-hidden': 'true' }, letterOf(sym)); }
function setLogo(slotEl, logos, sym, key, brand = false) {
  const sig = logos.join('|') + '#' + sym;
  if (slotEl._sig === sig) return; slotEl._sig = sig;
  const list = [...logos];
  const next = () => {
    const src = list.shift();
    if (!src) { slotEl.replaceChildren(letterTile(sym, key)); return; }
    const img = h('img', { class: 'pic' + (brand ? ' brand' : ''), src, alt: '', width: 44, height: 44, loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', next, { once: true });
    slotEl.replaceChildren(img);
  };
  next();
}

/* ---------- board ---------- */
const rowMap = new Map();
function makeRow(key, kind) {
  const tag = kind === 'live' || kind === 'trend' ? 'a' : 'div';
  const el = h(tag, { class: 'row coin-row is-new' + (kind === 'placeholder' || kind === 'live' ? ' own' : '') + (kind === 'placeholder' ? ' placeholder' : ''), 'data-spot': '', 'data-key': key });
  const e = { el, kind,
    lg: h('span', { class: 'lg' }), tick: h('span', { class: 't' }), name: h('div', { class: 'sub' }), meta: h('div', { class: 'sub meta-m' }),
    price: h('span', { class: 'r cell num c-price' }), chg: h('span', { class: 'r cell num c-chg' }), vol: h('span', { class: 'r cell num c-vol' }), liq: h('span', { class: 'r cell num c-liq' }) };
  const tickWrap = h('div', { class: 'tick' }, e.tick, kind === 'placeholder' || kind === 'live' ? h('span', { class: 'ver' }, 'Own') : null);
  el.append(e.lg, h('div', { class: 'who' }, tickWrap, e.name, e.meta), e.price, e.chg, e.vol, e.liq);
  return e;
}
function skeletonRow(i) {
  return h('div', { class: 'row coin-row', 'data-skeleton': '', style: `--i:${i}` },
    h('span', { class: 'sk tile-sk' }), h('div', { class: 'who' }, h('span', { class: 'sk w60' }), h('br'), h('span', { class: 'sk w40' })),
    h('span', { class: 'r' }, h('span', { class: 'sk' })), h('span', { class: 'r' }, h('span', { class: 'sk' })),
    h('span', { class: 'r c-vol' }, h('span', { class: 'sk' })), h('span', { class: 'r c-liq' }, h('span', { class: 'sk' })));
}
const DOTS = '\u00b7 \u00b7 \u00b7 \u00b7 \u00b7';
function fill(e, m) {
  e.tick.textContent = m.symbol ? (m.own ? '$' : '') + m.symbol : shortAddr(m.address);
  e.name.textContent = m.name || (m.ok === false ? 'Data unavailable' : '');
  setLogo(e.lg, m.logos || [], m.symbol || '?', m.address);
  setNumber(e.price, m.price ?? null, fmtPrice);
  setNumber(e.chg, m.change24 ?? null, fmtChange);
  e.chg.classList.toggle('up', m.change24 > 0); e.chg.classList.toggle('down', m.change24 < 0);
  setNumber(e.vol, m.volume24 ?? null, fmtCompact);
  setNumber(e.liq, m.liquidity ?? null, fmtCompact);
  e.meta.textContent = `Vol ${fmtCompact(m.volume24)} \u00b7 Liq ${fmtCompact(m.liquidity)}`;
  if (e.kind !== 'placeholder') e.el.setAttribute('href', store.record('dex').page + m.address), e.el.setAttribute('target', '_blank'), e.el.setAttribute('rel', 'noopener noreferrer');
}
function fillPlaceholder(e) {
  e.tick.textContent = '$SPRL'; e.name.textContent = 'SPRL \u00b7 awaiting mint address'; e.meta.textContent = DOTS;
  setLogo(e.lg, [BRAND], 'S', 'sprl', true);
  for (const c of [e.price, e.chg, e.vol, e.liq]) { c.textContent = DOTS; c.classList.add('dots'); }
}

function renderBoard() {
  const rows = slot('rows'), reg = store.get(), ca = isStated(reg.ca) ? reg.ca.value : null;
  const desired = [];
  if (state.own && ca) desired.push({ key: 'own:' + ca, kind: 'live', model: state.own });
  else if (ca) desired.push({ key: 'own:' + ca, kind: 'live', model: { address: ca, own: true, symbol: 'SPRL', name: 'SPRL', logos: [BRAND], ok: !state.ownLoading ? false : undefined } });
  else desired.push({ key: 'own:placeholder', kind: 'placeholder' });
  const trend = composeBoard(null, state.trending, ca).slice(1);
  trend.forEach((m) => desired.push({ key: m.address, kind: 'trend', model: m }));

  const showSkel = !state.haveMarket && !state.marketError;
  const keep = new Set(desired.map((d) => d.key));
  for (const [k, e] of rowMap) if (!keep.has(k)) { e.el.remove(); rowMap.delete(k); }
  rows.querySelectorAll('[data-skeleton]').forEach((n) => n.remove());
  let i = 0;
  for (const d of desired) {
    let e = rowMap.get(d.key);
    if (e && e.kind !== d.kind) { e.el.remove(); rowMap.delete(d.key); e = null; }
    if (!e) { e = makeRow(d.key, d.kind); e.el.style.setProperty('--i', i); rowMap.set(d.key, e); }
    d.kind === 'placeholder' ? fillPlaceholder(e) : fill(e, d.model);
    rows.append(e.el); i++;
  }
  if (showSkel) for (let s = 0; s < 9; s++) rows.append(skeletonRow(s));
  if (state.marketError && !state.haveMarket) {
    // source down and nothing cached: dash rows + error note
    for (let s = 0; s < 9; s++) {
      const r = skeletonRow(s); r.removeAttribute('data-skeleton'); r.setAttribute('data-error-row', '');
      r.querySelectorAll('.sk').forEach((n) => { n.className = 'dots'; n.textContent = DASH; n.style.width = 'auto'; });
      rows.append(r);
    }
  }
  renderTicker();
}

function tkChip(m) {
  const img = h('span', { class: 'lg' });
  setLogo(img, m.logos || [], m.symbol || '?', m.address);
  return h('span', { class: 'tk' }, img, h('b', {}, m.symbol || shortAddr(m.address)), h('span', { class: 'num' }, fmtPrice(m.price)),
    h('span', { class: 'num chg ' + (m.change24 > 0 ? 'up' : m.change24 < 0 ? 'down' : '') }, fmtChange(m.change24)));
}
function renderTicker() {
  const track = slot('ticker-track');
  const items = [...(state.own && isStated(store.record('ca')) ? [state.own] : []), ...state.trending];
  const sig = items.map((m) => [m.address, m.price, m.change24].join(':')).join('|');
  if (track._sig === sig && track.childElementCount) return; track._sig = sig;
  track.replaceChildren();
  if (!items.length) { for (let i = 0; i < 12; i++) track.append(h('span', { class: 'tk' }, h('span', { class: 'sk tile-sk', style: 'width:26px;height:26px;border-radius:50%' }), h('span', { class: 'sk', style: 'width:90px' }))); return; }
  const once = items.map(tkChip);
  track.append(...once, ...items.map(tkChip));
  track.setAttribute('aria-hidden', 'false');
}

function setStatus(kind, label) {
  const p = slot('board-status'); p.dataset.state = kind; p.lastElementChild.textContent = label;
  const note = slot('board-note');
  note.textContent = kind === 'error' ? 'Silence from the data source. Trying again with growing pauses.' : kind === 'retry' ? 'Data source stumbled. Last good figures stay visible during retries.' : '';
}

/* ---------- polling ---------- */
let timer = 0, marketBusy = false, ownBusy = false;
async function pollMarket() {
  if (marketBusy) return; marketBusy = true;
  try {
    const rows = await loadMarket(store.get());
    state.trending = rows; state.haveMarket = true; state.marketError = false;
    setStatus('live', 'Live');
  } catch {
    state.marketError = true;
    setStatus(state.haveMarket ? 'retry' : 'error', state.haveMarket ? 'Retrying' : 'Source down');
  } finally { marketBusy = false; renderBoard(); }
}
async function pollOwn() {
  if (ownBusy) return; ownBusy = true;
  const caAtStart = store.record('ca').value;
  try {
    state.ownLoading = true;
    const own = await loadOwn(store.get(), { fallbackLogo: BRAND });
    if (store.record('ca').value === caAtStart) state.own = own;
  } catch { /* keep last good */ }
  finally { ownBusy = false; state.ownLoading = false; renderBoard(); }
}
function pollAll() { return Promise.allSettled([pollMarket(), pollOwn()]); }
function schedule() { clearTimeout(timer); if (!document.hidden) timer = setTimeout(async () => { await pollAll(); schedule(); }, POLL_MS); }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(timer); return; }
  pollAll().then(schedule);
});

/* ---------- scanner ---------- */
function runScan() {
  const reg = store.get(), skip = (n) => n.closest('[data-slot="board"],[data-slot="ticker"]');
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let bad = 0, n;
  while ((n = w.nextNode())) {
    if (skip(n.parentElement) || /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) continue;
    for (const r of scanText(n.nodeValue, reg)) if (r.verdict === 'unmatched') { bad++; console.warn('[gate] address-shaped string not in registry:', r.value); }
  }
  document.documentElement.dataset.scanWarnings = String(bad);
}

/* ---------- UI wiring ---------- */
function initUI() {
  document.querySelectorAll('.faq-q').forEach((b) => b.addEventListener('click', () => {
    const it = b.closest('.faq-item'), on = it.classList.toggle('on'); b.setAttribute('aria-expanded', String(on));
  }));
  const tabs = slot('tabs');
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tabs.querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === b.dataset.tab));
  });
}

function renderAll() { renderSocials(); renderCA(); renderBoard(); runScan(); }
store.subscribe((name) => {
  renderAll();
  if (name === 'ca') { state.own = null; pollOwn(); }
  if (name === 'market') pollMarket();
});

// Runtime hook: anchors read the live record, so any state can be set and re-read.
window.SPRL = {
  store,
  gates: () => evaluateGates(store.get()),
  setRecord: (name, patch) => store.set(name, patch),
  state,
  reducedMotion: reduced,
};

initUI(); renderAll();
initProgress($('#progress')); initSpotlight(); initParallax($('.hero2')); initReveal();
pollAll().then(schedule);
