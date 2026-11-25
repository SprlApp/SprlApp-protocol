import sharp from 'sharp';
const hx=(a)=>'#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
async function px(p){return sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
// logo: most saturated opaque pixels per hue family (top 300 by saturation, averaged)
{const {data}=await px('brand/LOGO SPRL PNG...png'); const fam={};
for(let i=0;i<data.length;i+=4){if(data[i+3]<250)continue;const r=data[i],g=data[i+1],b=data[i+2];const mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx===mn)continue;const d=mx-mn;let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;const s=d/mx;const k=Math.floor(h/30);(fam[k]??=[]).push([s,r,g,b]);}
for(const k of Object.keys(fam)){const a=fam[k].sort((x,y)=>y[0]-x[0]).slice(0,300);if(a.length<100)continue;const m=[1,2,3].map(j=>a.reduce((s,v)=>s+v[j],0)/a.length);console.log('logo hue',k*30,hx(m),'n',fam[k].length);}}
// reference: deep ocean navy (darkest 15% of the dominant blue field) from SPRL 1
{const {data,info}=await px('reference/SPRL 1.jpg.jpeg');const L=[];for(let y=450;y<900;y++)for(let x=0;x<1600;x++){const i=(y*1600+x)*4;L.push([data[i]*.3+data[i+1]*.59+data[i+2]*.11,data[i],data[i+1],data[i+2]]);}
L.sort((a,b)=>a[0]-b[0]);const lo=L.slice(0,Math.floor(L.length*.05));console.log('ref navy deep',hx([1,2,3].map(j=>lo.reduce((s,v)=>s+v[j],0)/lo.length)));
const mid=L.slice(Math.floor(L.length*.4),Math.floor(L.length*.5));console.log('ref ocean mid',hx([1,2,3].map(j=>mid.reduce((s,v)=>s+v[j],0)/mid.length)));}
// cover: slate sky
{const {data}=await px('reference/SAMPUL SPRL JPG.jpg.jpeg');const L=[];for(let i=0;i<data.length;i+=4)L.push([data[i]*.3+data[i+1]*.59+data[i+2]*.11,data[i],data[i+1],data[i+2]]);L.sort((a,b)=>a[0]-b[0]);const lo=L.slice(0,Math.floor(L.length*.1));console.log('cover slate dark',hx([1,2,3].map(j=>lo.reduce((s,v)=>s+v[j],0)/lo.length)));}
