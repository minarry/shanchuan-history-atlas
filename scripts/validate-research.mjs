import {MAX_YEAR} from '../dist/history-domain.js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n,import.meta.url)));
const events=read('events.json'),r=read('research.json'),snapshots=read('snapshots.json').snapshots;
const all=[...events,...r.milestones],sourceIds=new Set(r.sources.map(s=>s.id));
assert.equal(sourceIds.size,r.sources.length,'Source IDs must be unique');
assert.equal(new Set(all.map(x=>x.id)).size,all.length,'Event IDs must be unique');
assert(events.length>=80,'Retain broad coverage after enrichment');
assert(r.milestones.length>=30,'Provide political and institutional context');
for(let i=0;i<34;i++)assert(events.some(e=>e.id==='battle-'+i),'Retain original battle ID '+i);
const coord=f=>{assert(Number.isFinite(f.lng)&&Number.isFinite(f.lat));assert(f.lng>=62&&f.lng<=149&&f.lat>=5&&f.lat<=64,'East Asia viewport coordinate: '+JSON.stringify(f));};
for(const s of r.sources){assert(s.title&&s.note&&/^https?:\/\//.test(s.url),'Source metadata');assert(!s.url.includes('redlink=1'),'No nonexistent source pages');}
for(const e of all){
 assert(e.name&&Number.isInteger(e.year)&&e.year!==0&&e.year>=-2070&&e.year<=MAX_YEAR,e.id+' year');
 if(e.endYear)assert(e.endYear<=MAX_YEAR&&e.endYear>=e.year,e.id+' endYear');
 coord(e);assert(e.politics?.length>=15&&e.impact?.length>=10&&e.uncertainty,e.id+' explanatory fields');
 assert(e.sourceRefs?.length&&e.sourceRefs.every(id=>sourceIds.has(id)),e.id+' grounded references');
 const base=snapshots.findLast(s=>s.year<=e.year);assert(base&&base.year<=e.year,'Do not assign a later map');
 if(events.includes(e)){
  for(const k of ['terrain','logistics','outcome'])assert(e[k]?.length>=5,e.id+' '+k);
  assert(e.parties?.length>=3,e.id+' parties');
  assert(e.stages?.length>=3&&e.stages.every(s=>s.title&&s.description),e.id+' stages');
  assert(e.geoFactors?.length>=2&&e.geoFactors.every(f=>f.name&&f.role),e.id+' terrain nodes');e.geoFactors.forEach(coord);
  for(const rt of e.routes||[]){assert(rt.name&&rt.note&&rt.coordinates.length>=2);rt.coordinates.forEach(([lng,lat])=>coord({lng,lat}));}
 }else for(const k of ['summary','category','geography'])assert(e[k],e.id+' '+k);
}
for(const t of r.themes){assert(t.ids.length>=3,t.id+' must be a useful sequence');assert(t.ids.every(id=>all.some(e=>e.id===id)),t.id+' valid event IDs');}
// Chronological playback retains separate same-year events and stable deep links.
const moments=[...all].sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));
for(let i=1;i<moments.length;i++)assert(moments[i].year>=moments[i-1].year);
assert(moments.filter(e=>e.year===219).length>=2,'Same-year campaigns remain distinct');
console.log(JSON.stringify({researchValidated:true,battles:events.length,milestones:r.milestones.length,geographicNodes:events.reduce((n,e)=>n+e.geoFactors.length,0),sources:r.sources.length,themes:r.themes.length,timelineNodes:moments.length}));
