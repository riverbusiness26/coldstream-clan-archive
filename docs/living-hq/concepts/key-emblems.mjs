import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(new URL('../../../site/package.json', import.meta.url));
const sharp = require('sharp');
const here = path.dirname(fileURLToPath(import.meta.url));
const names = ['events','leaderboard','history','media','profile','join'];
// River requested green-screen masters. Only green-dominant pixels are keyed;
// neutral shadows and the dark interiors of metal and cloth must remain opaque.
for (const name of names) {
  const input = path.join(here,'chroma-masters',name+'.png');
  const output = path.resolve(here,'../../../site/public/museum/emblem-'+name+'-keyed.png');
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let transparent = 0, solid = 0;
  for (let i=0;i<data.length;i+=4) {
    const r=data[i],g=data[i+1],b=data[i+2];
    const dominance=g-Math.max(r,b);
    if (dominance>24 && g>70) {
      const keep=1-Math.min(1,Math.max(0,(dominance-24)/120));
      data[i+3]=Math.round(data[i+3]*keep);
      data[i+1]=Math.min(g,Math.max(r,b));
    }
    if(data[i+3]===0) { transparent++; data[i]=data[i+1]=data[i+2]=0; }
    if(data[i+3]===255) solid++;
  }
  const ratio=transparent/(info.width*info.height);
  if(ratio<.08||ratio>.85||solid<1000) throw new Error(name+': unexpected key coverage '+ratio);
  await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(output);
  console.log(JSON.stringify({name,width:info.width,height:info.height,transparentPercent:+(ratio*100).toFixed(1),solidPixels:solid,output}));
}
