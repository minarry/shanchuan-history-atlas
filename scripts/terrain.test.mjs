import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geographyLabels,riverStyle,landformTypes} from '../dist/terrain-style.js';
const geography=JSON.parse(readFileSync(new URL('../dist/data/geography.json',import.meta.url))).features;

test('geography distinguishes plains, basins and plateau instead of one generic class',()=>{
 assert.equal(geography.find(f=>f.name==='华北平原').kind,'plain');
 assert.equal(geography.find(f=>f.name==='四川盆地').kind,'basin');
 assert.equal(geography.find(f=>f.name==='青藏高原').kind,'plateau');
 for(const f of geography)assert.ok(landformTypes[f.kind],f.name);
});
test('real landform labels avoid overlap at regional and mobile map scales',()=>{
 for(const viewport of [{x:360,y:400},{x:1100,y:600}])for(const zoom of [3.5,4.5,5.5,7]){
  const project=f=>({x:(f.lng-110)*2**zoom+viewport.x/2,y:(36-f.lat)*2**zoom+viewport.y/2});
  const labels=geographyLabels(geography,project,zoom,viewport);
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
   const a=labels[i],b=labels[j],p=project(a.feature),q=project(b.feature);
   assert.ok(Math.abs(p.x-q.x)>=(a.width+b.width)/2||Math.abs(p.y-q.y)>=(a.height+b.height)/2,`${a.feature.name} / ${b.feature.name}`);
  }
 }
});
test('a selected pass remains visible and can displace a conflicting general label',()=>{
 const mountain={id:'mountain',name:'山脉',kind:'mountain',minZoom:4},pass={id:'pass',name:'关口',kind:'pass',minZoom:6};
 const result=geographyLabels([mountain,pass],()=>({x:100,y:100}),4,{x:300,y:300},'pass');
 assert.deepEqual(result.map(x=>x.feature.id),['pass']);
});
test('major river hierarchy remains clear across supported zoom levels',()=>{
 for(const zoom of [2.2,4,6,8.2]){
  assert.ok(riverStyle(3,zoom).weight>riverStyle(8,zoom).weight*2);
  assert.ok(riverStyle(3,zoom).opacity>riverStyle(8,zoom).opacity);
  assert.ok(riverStyle(3,zoom).weight<4,'rivers must not obscure narrow landforms');
 }
});
