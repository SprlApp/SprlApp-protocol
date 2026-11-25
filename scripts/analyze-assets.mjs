// Reads every file in brand/ and reference/: IHDR colour type, alpha histogram, dominant pixels.
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
for (const dir of ['brand','reference']) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir,f); const buf = fs.readFileSync(p);
    const isPng = buf.slice(1,4).toString()==='PNG';
    let ihdr = 'n/a (JPEG)';
    if (isPng) ihdr = `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)} depth=${buf[24]} colourtype=${buf[25]} interlace=${buf[28]}`;
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const hist = new Array(8).fill(0); const q = new Map(); let blackT=0, n=info.width*info.height;
    for (let i=0;i<data.length;i+=4){
      const a=data[i+3]; hist[a>>5]++;
      if(a<255 && data[i]+data[i+1]+data[i+2]===0) blackT++;
      if(a>128){const k=[data[i]>>4,data[i+1]>>4,data[i+2]>>4].join(','); q.set(k,(q.get(k)||0)+1);}
    }
    const top=[...q.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>'#'+k.split(',').map(x=>((+x<<4)|8).toString(16).padStart(2,'0')).join('')+` ${(100*v/n).toFixed(1)}%`);
    console.log(`\n${p}\n  ${info.width}x${info.height} IHDR: ${ihdr}\n  alpha hist (8 bins 0..255): ${hist.join(' ')}\n  pure-black transparent px: ${blackT}\n  dominant: ${top.join('  ')}`);
  }
}
