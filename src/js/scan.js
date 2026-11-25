// GATE WARNING scanner — never blanket-rejects 0x hex. Address-shaped strings are matched against
// the stated registry; the stated CA is exempt. Anything else is a warning, not a rejection.
import { isStated } from './register.js';

const SHAPES = /\b0x[0-9a-fA-F]{40}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

export function registryValues(register) {
  const out = new Set();
  for (const rec of Object.values(register)) {
    if (!isStated(rec)) continue;
    for (const v of Object.values(rec)) if (typeof v === 'string') out.add(v);
  }
  return out;
}

export function scanText(text, register) {
  const known = registryValues(register);
  const ca = isStated(register.ca) ? register.ca.value : null;
  return [...String(text).matchAll(SHAPES)].map((m) => {
    const s = m[0];
    const verdict = s === ca ? 'ca-exempt' : [...known].some((k) => k.includes(s)) ? 'registry' : 'unmatched';
    return { value: s, verdict };
  });
}
