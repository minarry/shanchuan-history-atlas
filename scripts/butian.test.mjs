import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {butianHash,readButianHash} from '../dist/butian.js';
import {MAX_YEAR} from '../dist/history-domain.js';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n,import.meta.url)));
const world=read('butian.json'),history=read('snapshots.json');
const feature=(phase,id)=>world.phases.find(p=>p.id===phase).geojson.features.find(f=>f.properties.id===id);
const inRing=(p,ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const contains=(f,p)=>{const g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;return polys.some(poly=>inRing(p,poly[0])&&!poly.slice(1).some(r=>inRing(p,r)));};

test('fiction remains an appendix with relative phases, outside the historical years',()=>{
 assert.equal(world.kind,'fiction');assert.equal(MAX_YEAR,1928);
 assert.equal(history.snapshots.at(-1).year,1928);
 assert.ok(history.snapshots.some(s=>s.id===world.baseSnapshotId));
 assert.deepEqual(world.phases.map(p=>p.id),['before','after']);
 for(const p of world.phases)assert.equal(p.year,undefined);
 for(const phase of ['before','after'])assert.equal(readButianHash(butianHash(phase)),phase);
 assert.equal(readButianHash('#year=189'),null);
 assert.equal(readButianHash('#chapter=butian&phase=invalid'),'after');
});
test('all six factions retain the requested races, elements and source territories',()=>{
 assert.equal(world.factions.length,6);
 assert.deepEqual(Object.fromEntries(world.factions.map(f=>[f.id,f.element])),{li:'金',yao:'火','human-fire':'火',ling:'木','human-water':'水',earth:'土'});
 assert.equal(world.factions.find(f=>f.id==='yao').territories.length,3);
 assert.ok(world.factions.find(f=>f.id==='ling').territories.some(n=>n.includes('交州')));
 for(const p of world.phases)assert.equal(new Set(p.geojson.features.map(f=>f.properties.id)).size,6);
});
test('every sampled point in old Jingzhou changes from earth to exactly one water/fire owner',()=>{
 let north=0,south=0;
 for(let lng=108.4;lng<116.2;lng+=.17)for(let lat=24.7;lat<32.7;lat+=.17){
  const p=[lng,lat];if(!contains(world.oldJingzhou,p))continue;
  assert.ok(contains(feature('before','earth'),p),'original Earth territory');
  const fire=contains(feature('after','human-fire'),p),water=contains(feature('after','human-water'),p);
  assert.notEqual(fire,water,'a point must have exactly one new owner');
  assert.equal(contains(feature('after','earth'),p),false);
  if(fire)north++;else south++;
 }
 assert.ok(north>100&&south>100);
 assert.ok(contains(feature('after','human-fire'),[112.14,32.04]),'Xiangyang north of the dividing river');
 assert.ok(contains(feature('after','human-water'),[112.98,28.2]),'Changsha south of the dividing river');
});
test('earth survives around Chang’an with an explicit refuge marker',()=>{
 assert.ok(contains(feature('after','earth'),[108.94,34.27]));
 assert.equal(feature('after','earth').properties.refuge,true);
 assert.equal(feature('before','earth').properties.refuge,false);
 assert.equal(world.portal.lng,94.5);assert.equal(world.portal.lat,35.7);
 assert.ok(world.portal.realmAnchor[0]<world.portal.lng);
 assert.match(world.places.find(p=>p.id==='birthplace').name,/暂定/);
});
