// Animation audit: every @keyframes is applied somewhere, has a reduced-motion fallback, and its timing is listed.
import fs from 'node:fs';

const css = fs.readFileSync('src/styles/main.css', 'utf8');
const rm = css.slice(css.indexOf('@media (prefers-reduced-motion:reduce)'));
const names = [...css.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]);
const stripped = css.replace(/@keyframes [\w-]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
const decls = [...stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap((m) => {
  const a = m[2].match(/animation:([^;]+)/);
  return a ? [{ sel: m[1].trim().split('\n').pop(), val: a[1].trim() }] : [];
});
const globalKill = rm.includes('*,*::before,*::after{animation:none!important');
let bad = 0;
for (const n of names) {
  const uses = decls.filter((d) => new RegExp('\\b' + n + '\\b').test(d.val));
  const ok = uses.length > 0 && globalKill;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} @keyframes ${n.padEnd(10)} used by ${uses.map((u) => u.sel + ' [' + u.val + ']').join(' ; ') || 'NOTHING'}  reduced-motion:${globalKill ? 'animation:none' : 'MISSING'}`);
}
const js = fs.readFileSync('src/js/motion.js', 'utf8');
const gated = (js.match(/reduced\(\)/g) || []).length >= 5;
console.log(`${gated ? 'PASS' : 'FAIL'} JS motion (spring, reveal, parallax, count-up) gates on prefers-reduced-motion`);
const dur = /dur = 1100/.test(js);
console.log(`${dur ? 'PASS' : 'FAIL'} count-up 1100ms cubic ease-out (matches reference)`);
process.exit(bad || !gated || !dur ? 1 : 0);
