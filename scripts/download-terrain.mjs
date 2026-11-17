/* Reproduce upstream downloads; Node >=18. Run before build-terrain.py. */
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(root+'.cache',{recursive:true});
const files=[['https://naturalearth.s3.amazonaws.com/10m_raster/SR_HR.zip','SR_HR.zip'],...['rivers_lake_centerlines','lakes','land'].map((x,i)=>[`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_${x}.geojson`,['rivers.geojson','lakes.geojson','land.geojson'][i]])];
for(const [url,name] of files){const res=await fetch(url);if(!res.ok)throw new Error(name+': '+res.status);await writeFile(root+'.cache/'+name,new Uint8Array(await res.arrayBuffer()));console.log('Saved '+name)}
console.log('Extract .cache/SR_HR.zip to .cache/relief; install Pillow, then run python scripts/build-terrain.py.');
