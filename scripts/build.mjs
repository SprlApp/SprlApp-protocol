// Build: src/ -> dist/ (deploy output). Logo is explicitly produced into dist/brand/, favicon traced from pixels.
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';

const SRC = 'src', DIST = 'dist';
const LOGO = 'brand/LOGO SPRL PNG...png'; // RGBA (IHDR colourtype 6) with pure-black transparent regions

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(SRC, DIST, { recursive: true });

// theme-color is read from the tokens file so index.html holds no colour literal.
const tokens = fs.readFileSync(path.join(SRC, 'styles/tokens.css'), 'utf8');
const paper = tokens.match(/--c-paper:\s*(#[0-9a-fA-F]{6})/)[1];
const idx = path.join(DIST, 'index.html');
fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replaceAll('%THEME_COLOR%', paper));

// ---- logo: trim to alpha bbox, square, premultiplied resize (no black fringe from transparent px)
const { data, info } = await sharp(LOGO).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
const side = Math.max(x1 - x0, y1 - y0) + 1, pad = Math.round(side * 0.03), S = side + pad * 2;
const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
const sq = Buffer.alloc(S * S * 4); // premultiplied RGBA, transparent outside
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const sx = cx - (S >> 1) + x, sy = cy - (S >> 1) + y; if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
  const i = (sy * W + sx) * 4, o = (y * S + x) * 4, a = data[i + 3];
  sq[o] = Math.round((data[i] * a) / 255); sq[o + 1] = Math.round((data[i + 1] * a) / 255); sq[o + 2] = Math.round((data[i + 2] * a) / 255); sq[o + 3] = a;
}
fs.mkdirSync(path.join(DIST, 'brand'), { recursive: true });
const sized = (n) => sharp(sq, { raw: { width: S, height: S, channels: 4, premultiplied: true } }).resize(n, n, { kernel: 'lanczos3' });
for (const n of [96, 192, 512]) await sized(n).png({ compressionLevel: 9 }).toFile(path.join(DIST, 'brand', `sprl-logo-${n}.png`));
fs.copyFileSync(LOGO, path.join(DIST, 'brand', 'sprl-logo-full.png')); // explicit copy of the source logo

// ---- favicon: 32x32 SVG traced from the real 32x32 pixel grid of the logo
const f = await sized(32).raw().toBuffer(); // un-premultiplied RGBA out
const hex = (v) => v.toString(16).padStart(2, '0');
let rects = '';
for (let y = 0; y < 32; y++) {
  let x = 0;
  while (x < 32) {
    const i = (y * 32 + x) * 4, a = f[i + 3];
    if (a < 12) { x++; continue; }
    const key = [f[i] >> 2, f[i + 1] >> 2, f[i + 2] >> 2, a >> 4].join();
    let run = 1;
    while (x + run < 32) { const j = (y * 32 + x + run) * 4; if (f[j + 3] < 12 || [f[j] >> 2, f[j + 1] >> 2, f[j + 2] >> 2, f[j + 3] >> 4].join() !== key) break; run++; }
    rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="#${hex(f[i])}${hex(f[i + 1])}${hex(f[i + 2])}"${a < 250 ? ` fill-opacity="${(a / 255).toFixed(2)}"` : ''}/>`;
    x += run;
  }
}
fs.writeFileSync(path.join(DIST, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">${rects}</svg>\n`);

console.log(`build ok: logo bbox ${x1 - x0 + 1}x${y1 - y0 + 1} -> ${S}px square; favicon ${(rects.match(/<rect/g) || []).length} runs; files:`);
for (const p of fs.readdirSync(DIST, { recursive: true })) console.log('  dist/' + p);
