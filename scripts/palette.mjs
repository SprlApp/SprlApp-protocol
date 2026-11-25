// Samples palette from the alpha-aware logo (opaque pixels only) via hue-bucketed means.
import sharp from 'sharp';
const src='brand/LOGO SPRL PNG...png';
const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const buckets={};
for(let i=0;i<data.length;i+=4){ if(data[i+3]<250) continue;
  const [r,g,b]=[data[i],data[i+1],data[i+2]]; const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  const l=(mx+mn)/510, s=mx===mn?0:(mx-mn)/255; let h=0;
  if(mx!==mn){const d=mx-mn; h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4; h=(h*60+360)%360;}
  const k=s<.08?'neutral':Math.floor(h/30);
  (buckets[k]??=[0,0,0,0,0]); const B=buckets[k]; B[0]+=r;B[1]+=g;B[2]+=b;B[3]++; B[4]+=s;
}
const hex=(B)=>'#'+[0,1,2].map(j=>Math.round(B[j]/B[3]).toString(16).padStart(2,'0')).join('');
for(const [k,B] of Object.entries(buckets).sort((a,b)=>b[1][3]-a[1][3])) console.log(k,B[3],hex(B),'sat',(B[4]/B[3]).toFixed(2));
