export const DASH = '\u2014';
const nf = (o) => new Intl.NumberFormat('en-US', o);
const usd2 = nf({ style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const compact = nf({ style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });

export const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export function fmtPrice(v) {
  v = num(v);
  if (v === null) return DASH;
  if (v >= 1) return usd2.format(v);
  if (v === 0) return '$0.00';
  const digits = Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(v)) + 2));
  return '$' + v.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
}
export const fmtCompact = (v) => (num(v) === null ? DASH : compact.format(num(v)));
export function fmtChange(v) {
  v = num(v);
  if (v === null) return DASH;
  return (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(v).toFixed(2) + '%';
}
export const shortAddr = (a) => (a && a.length > 10 ? a.slice(0, 4) + '\u2026' + a.slice(-4) : a || DASH);
export const letterOf = (s) => (String(s || '?').replace(/[^A-Za-z0-9]/g, '')[0] || '?').toUpperCase();
export function hashIndex(s, n) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % n;
}
