import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {axisYear,historicalYear,fitWindow,yearTicks,mergeTimeline,clusterMoments,createTimeScale} from '../dist/timeline-core.js';
import {readingPeriods,periodContains,periodStatistics,denseWindows} from '../dist/timeline-periods.js';
test('a single year separates 1 BCE and 1 CE, with no year zero',()=>{
  assert.equal(axisYear(1)-axisYear(-1),1);
  for(const y of [-2070,-221,-1,1,208,1928])assert.equal(historicalYear(axisYear(y)),y);
  assert.equal(historicalYear(axisYear(-1)+1),1);
});
test('zoom and pan stay within the historical domain, including endpoints',()=>{
  const min=axisYear(-2070),max=1928;
  for(const center of [-5000,min,0,208,max,5000])for(const span of [1,5,50,300,10000]){
    const w=fitWindow(center,span,min,max);
    assert.ok(w.start>=min&&w.end<=max);
    assert.equal(w.end-w.start,Math.max(5,Math.min(max-min,span)));
  }
});
test('year ruler uses natural BCE round numbers, and never zero',()=>{
  const ticks=yearTicks(axisYear(-350),axisYear(-150),900).ticks;
  assert.ok(ticks.some(t=>t.major&&t.year===-300));
  const fine=yearTicks(axisYear(-3),axisYear(3),900);
  assert.equal(fine.step,1);
  assert.deepEqual(fine.ticks.map(t=>t.year),[-3,-2,-1,1,2,3]);
});
const snapshots=JSON.parse(readFileSync(new URL('../dist/data/snapshots.json',import.meta.url))).snapshots;
const events=JSON.parse(readFileSync(new URL('../dist/data/events.json',import.meta.url)));
const research=JSON.parse(readFileSync(new URL('../dist/data/research.json',import.meta.url)));
const moments=[...(events.events||events).map(e=>({...e,_kind:'event'})),...research.milestones.map(e=>({...e,_kind:'moment'}))].sort((a,b)=>a.year-b.year||(a.sequence??50)-(b.sequence??50));
test('unified playback preserves every snapshot and event in chronological order',()=>{
  const line=mergeTimeline(snapshots,moments);
  assert.equal(line.length,316);
  assert.equal(new Set(line.map(i=>i.id)).size,line.length);
  for(let i=1;i<line.length;i++)assert.ok(line[i].year>=line[i-1].year);
  const y219=line.filter(e=>e.year===219);
  assert.equal(y219[0]._kind,'slice');
  assert.ok(y219.findIndex(e=>e.name==='汉中之战')<y219.findIndex(e=>e.name==='襄樊之战与荆州易手'));
});
test('clustering never drops events at mobile widths or dense years',()=>{
  for(const width of [280,390,1200])for(const [start,end] of [[-2069,1928],[1916,1928],[200,230]]){
    const groups=clusterMoments(moments,start,end,width);
    const expected=moments.filter(e=>axisYear(e.year)>=start&&axisYear(e.year)<=end);
    assert.deepEqual(groups.flatMap(g=>g.items.map(e=>e.id)),expected.map(e=>e.id));
  }
});
test('fine periods cover every event exactly once, including the final year',()=>{
  assert.equal(readingPeriods.length,32);
  for(let i=1;i<readingPeriods.length;i++)assert.equal(readingPeriods[i-1].end,readingPeriods[i].start);
  for(const event of moments)assert.equal(readingPeriods.filter(p=>periodContains(p,event.year)).length,1,event.name);
  for(const [year,name] of [[-202,'西汉'],[-1,'西汉'],[9,'新与更始'],[25,'东汉'],[184,'汉末群雄'],[220,'三国'],[265,'西晋'],[755,'安史之乱'],[763,'安史之乱'],[764,'中晚唐'],[1912,'民国初年'],[1916,'北洋军阀'],[1920,'直皖直奉争衡'],[1924,'军阀多方对峙'],[1928,'北伐时期']]){
    assert.equal(readingPeriods.find(p=>periodContains(p,year))?.name,name);
  }
  assert.equal(periodStatistics(moments).reduce((total,p)=>total+p.count,0),111);
});
test('dense windows retain their events, stay in the period, and do not overlap',()=>{
  const periods=periodStatistics(moments);
  for(const p of periods){
    const windows=denseWindows(p);
    assert.ok(windows.length<=3);
    for(const [i,w] of windows.entries()){
      assert.ok(w.start>=p.start&&w.end<p.end);
      assert.ok(axisYear(w.lastYear)-axisYear(w.firstYear)<=24);
      assert.equal(w.count,p.items.filter(m=>m.year>=w.firstYear&&m.year<=w.lastYear).length);
      if(i)assert.ok(w.firstYear>windows[i-1].lastYear);
    }
  }
  assert.deepEqual(denseWindows(periods.find(p=>p.name==='汉末群雄')).map(w=>[w.firstYear,w.lastYear,w.count]),[[200,219,4]]);
  assert.equal(periodStatistics(moments).find(p=>p.name==='北伐时期').count,1);
});

test('smart spacing gives eventful years more room while preserving every selectable year',()=>{
  const scale=createTimeScale(58,358,1000,moments,true);
  assert.ok(scale.gaps.length>0);
  assert.ok(scale.toPixel(190)-scale.toPixel(58)<200,'empty opening should take less than 20%');
  assert.ok(scale.toPixel(228)-scale.toPixel(200)>100,'dense events receive more than linear spacing');
  let last=-1;
  for(let y=58;y<=358;y+=.25){const px=scale.toPixel(y);assert.ok(px>last);assert.ok(Math.abs(scale.toYear(px)-y)<1e-8);last=px;}
  assert.equal(scale.toPixel(58),0);assert.equal(scale.toPixel(358),1000);
});

test('smart and proportional scales keep BCE continuity, endpoints and all event IDs',()=>{
  for(const [start,end] of [[axisYear(-2070),1928],[axisYear(-202),8],[-3,3],[1916,1928]])for(const width of [280,1000])for(const compact of [true,false]){
    const scale=createTimeScale(start,end,width,moments,compact);
    for(let i=0;i<=200;i++){const y=start+(end-start)*i/200;assert.ok(Math.abs(scale.toYear(scale.toPixel(y))-y)<1e-7);}
    assert.deepEqual(clusterMoments(moments,start,end,width,scale.toPixel).flatMap(g=>g.items.map(m=>m.id)),moments.filter(m=>axisYear(m.year)>=start&&axisYear(m.year)<=end).map(m=>m.id));
    if(!compact||end-start<=20)assert.equal(scale.gaps.length,0);
  }
  const empty=createTimeScale(420,580,1000,[],true);assert.equal(empty.gaps.length,0);assert.equal(empty.toPixel(500),500);
});
