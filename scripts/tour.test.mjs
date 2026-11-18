import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTour,historyChapters,geographyStops,readingDuration,mapSignature,impactSnapshot,TourClock} from '../dist/tour-script.js';
import {readingPeriods,periodContains} from '../dist/timeline-periods.js';
const read=name=>JSON.parse(readFileSync(new URL('../dist/data/'+name,import.meta.url)));
const snapshots=read('snapshots.json').snapshots.sort((a,b)=>a.year-b.year);
const raw=read('events.json'),research=read('research.json');
const moments=[...(raw.events||raw),...research.milestones],themes=research.themes;
const make=options=>buildTour({snapshots,moments,themes,...options});

test('player uses real stops, preserves a paused selection when changing speed, and restores reading on exit',async()=>{
  const {createTourPlayer}=await import('../dist/tour-player.js');
  const prior={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  class Element{constructor(){this.value='';this.style={};this.dataset={};this.hidden=false;this.attrs={};this.classList={add(){},remove(){},toggle(){}};}setAttribute(k,v){this.attrs[k]=v;}querySelectorAll(){return [];}showModal(){this.open=true;}close(){this.open=false;}}
  const nodes=new Map(),node=s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s);};
  const raf=new Map();let serial=0,exited=false,player;const shown=[];
  globalThis.document={querySelector:node,querySelectorAll:()=>[],addEventListener(){},hidden:false};
  globalThis.requestAnimationFrame=fn=>{raf.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>raf.delete(id);
  node('input[name="tourMode"]:checked').value='period';node('#tourStartAt').value='beginning';node('#tourSetupRate').value='1';node('#tourThemeSelect').value=themes[0].id;
  try{
    player=createTourPlayer({snapshots,moments,themes,getYear:()=>208,onEnter(){},onExit(){exited=true;},onScene:s=>shown.push(s),onCamera(){},onReadDetail(){}});
    player.openSetup();assert.match(node('#tourPreviewStats').textContent,/4个事件/);
    node('#tourStartBtn').onclick();const first=raf.values().next().value;raf.clear();first();player.pause();
    assert.equal(player.scene.phase,'event');assert.match(node('#tourPhaseRail').innerHTML,/局势与改变/);
    assert.doesNotMatch(node('#tourPhaseRail').innerHTML,/全图|事件形势|政治影响/);
    player.step(1);assert.equal(player.scene.phase,'focus');const focus=player.scene,applied=shown.length;
    node('#tourRate').onchange({target:{value:'2'}});assert.equal(player.scene,focus);assert.equal(shown.length,applied);assert.match(node('#tourPlaybackStatus').textContent,/已暂停/);
    node('#tourRefocus').onclick();assert.equal(shown.length,applied+1);
    player.exit();assert.ok(exited);assert.equal(player.active,false);assert.ok(node('#tourShell').hidden);
  }finally{player?.exit();for(const [k,v]of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});

test('history keeps every curated event once and adds only evidence-rich geography stops',()=>{
 const deck=make({mode:'history'}),ids=new Set(moments.map(m=>m.id));
 for(const c of historyChapters)for(const id of c.ids){assert.ok(ids.has(id));const stops=deck.scenes.filter(s=>s.itemId===id);assert.equal(stops.filter(s=>s.phase==='event').length,1);assert.ok(stops.length<=2);if(stops.length===2){assert.ok(geographyStops.has(id));assert.equal(stops[1].phase,'focus');assert.ok(stops[1].nodes.length>=3);assert.equal(stops[0].camera.key,stops[1].camera.key);}}
 assert.equal(deck.chapters.length,13);assert.equal(deck.eventCount,new Set(historyChapters.flatMap(c=>c.ids)).size);assert.ok(deck.scenes.length<60);assert.ok(deck.duration<8*60000);
});

test('all routes advance chronologically with real map indexes and distinct before/after dates',()=>{
  const decks=[make({mode:'history'}),make({mode:'overview'}),...readingPeriods.map(p=>make({mode:'period',year:p.start})),...themes.map(t=>make({mode:'theme',themeId:t.id}))];
  for(const deck of decks){
    assert.ok(deck.scenes.length,deck.title);
    deck.scenes.forEach((s,i)=>{
      assert.ok(s.year!==0&&s.year>=(deck.scenes[i-1]?.year??-Infinity),`${deck.title}: ${s.title} at ${s.year}`);
      assert.ok(snapshots[s.snapshotIndex]);assert.ok(s.year<=1928,'tour must stay in coverage');
      assert.ok(snapshots[s.snapshotIndex].year<=s.year);
      if(s.compareIndex!==null)assert.ok(snapshots[s.compareIndex].year<snapshots[s.snapshotIndex].year);
      if(s.phase==='event'||s.phase==='focus')assert.ok(snapshots[s.snapshotIndex].year<=moments.find(m=>m.id===s.itemId).year);
    });
  }
});

test('map overview selects turning points, retains endpoints, and never changes the global camera',()=>{
 const deck=make({mode:'overview'}),indexes=deck.scenes.map(s=>s.snapshotIndex);
 assert.equal(indexes[0],0);assert.equal(indexes.at(-1),snapshots.length-1);
 assert.ok(indexes.length<45&&indexes.length>20);assert.equal(new Set(indexes).size,indexes.length);
 assert.equal(new Set(deck.scenes.map(s=>s.camera.key)).size,1);assert.equal(deck.eventCount,0);
 assert.ok(deck.chapters.every(c=>c.sceneEnd>=c.sceneStart));assert.ok(deck.duration<5*60000);
});

test('map comparisons contain a real change and periods do not force empty before/after interludes',()=>{
 for(const s of make({mode:'history'}).scenes.filter(s=>s.compareIndex!==null))assert.notEqual(mapSignature(snapshots[s.compareIndex]),mapSignature(snapshots[s.snapshotIndex]));
 const period=make({mode:'period',year:208});assert.ok(period.scenes.every(s=>s.itemId));assert.equal(new Set(period.scenes.map(s=>s.camera.key)).size,1);
});

test('reading time follows content and remains bounded',()=>{
 assert.ok(readingDuration({text:'短句'})<readingDuration({text:'较长的解释。'.repeat(25)}));
 assert.ok(readingDuration({text:'长'.repeat(10000)})<=14500);
 assert.ok(new Set(make({mode:'history'}).scenes.map(s=>s.duration)).size>8);
});

test('regional camera frames include every current event and geographic node',()=>{
 const deck=make({mode:'history'});for(const s of deck.scenes.filter(s=>s.camera.kind==='region')){const m=moments.find(m=>m.id===s.itemId),[[south,west],[north,east]]=s.camera.bounds;for(const p of [m,...m.geoFactors||[]]){assert.ok(p.lat>=south&&p.lat<=north,m.name);assert.ok(p.lng>=west&&p.lng<=east,m.name);}}
});

test('period and theme routes retain every selected event, including same-year events',()=>{
  for(const p of readingPeriods){
    const actual=make({mode:'period',year:p.start}).scenes.filter(s=>s.phase==='event').map(s=>s.itemId).sort();
    assert.deepEqual(actual,moments.filter(m=>periodContains(p,m.year)).map(m=>m.id).sort(),p.name);
  }
  for(const theme of themes)assert.deepEqual(make({mode:'theme',themeId:theme.id}).scenes.filter(s=>s.phase==='event').map(s=>s.itemId).sort(),[...theme.ids].sort());
});

test('impact maps do not jump past the next event or invent unavailable aftermath',()=>{
  const list=[{year:100},{year:140},{year:200},{year:1945},{year:1949}];
  assert.deepEqual(impactSnapshot(list,{year:110},130),{base:0,index:0,hasLater:false});
  assert.deepEqual(impactSnapshot(list,{year:110},150),{base:0,index:1,hasLater:true});
  assert.deepEqual(impactSnapshot(list,{year:110,endYear:145},200),{base:0,index:0,hasLater:false});
  assert.deepEqual(impactSnapshot(list,{year:1945},1949),{base:3,index:4,hasLater:true});
});

test('playback clock preserves paused progress and rejects callbacks after seeking or exiting',()=>{
  let now=0,serial=0,fired=0;const callbacks=new Map();
  const clock=new TourClock({now:()=>now,set:fn=>{callbacks.set(++serial,fn);return serial;},clear:()=>{}});
  clock.start(1000,()=>fired++);const stale=callbacks.get(serial);
  now=400;clock.pause();assert.equal(clock.remaining,600);assert.equal(clock.fraction,.4);
  stale();assert.equal(fired,0);
  now=2000;clock.resume();assert.equal(clock.deadline,2600);
  now=2600;callbacks.get(serial)();assert.equal(fired,1);assert.equal(clock.fraction,1);
  clock.start(1000,()=>fired++);const skipped=callbacks.get(serial);
  clock.start(1000,()=>fired++);skipped();assert.equal(fired,1);
  const exited=callbacks.get(serial);clock.stop();exited();assert.equal(fired,1);
});
