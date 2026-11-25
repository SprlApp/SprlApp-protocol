// GATES — each gate reads its register record at call time (no cached state) and reports its branch.
import { isStated, hrefOf } from './register.js';

export const GATES = [
  { id: 'ca-slot',        record: 'ca',     eval: (r) => (isStated(r.ca) ? 'copy-live' : 'inert') },
  { id: 'own-row',        record: 'ca',     eval: (r) => (isStated(r.ca) ? 'live-pinned' : 'logo-placeholder') },
  { id: 'social-x',       record: 'x',      eval: (r) => (hrefOf(r.x) ? 'link' : 'inert') },
  { id: 'social-github',  record: 'github', eval: (r) => (hrefOf(r.github) ? 'link' : 'inert') },
  { id: 'market',         record: 'market', eval: (r) => (isStated(r.market) ? 'polling' : 'dash') },
  { id: 'address-scan',   record: 'ca',     eval: (r) => (isStated(r.ca) ? 'ca-exempt+registry' : 'registry') },
];

export const evaluateGates = (register) => Object.fromEntries(GATES.map((g) => [g.id, g.eval(register)]));
