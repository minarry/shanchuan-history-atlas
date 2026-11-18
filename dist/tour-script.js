import {MAX_YEAR} from './history-domain.js';
import {readingPeriods,periodContains,periodLastYear} from './timeline-periods.js';
import {axisYear} from './timeline-core.js';

export const historyChapters=[
  {id:'origins',title:'早期国家与周人东进',start:-2070,end:-770,question:'从豫西、晋南到关中与东方：政治中心怎样重新组织？',ids:['battle-0'],bridges:[-1600]},
  {id:'qin',title:'列国竞争与秦的统一',start:-770,end:-221,question:'变法、地理通道与长期消耗，怎样改变列国的力量对比？',ids:['moment-shangyang-reform','battle-4','moment-qin-unification']},
  {id:'han',title:'楚汉更替与两汉秩序',start:-221,end:25,question:'中原的胜负如何连接关中根据地、河西走廊与帝国重建？',ids:['battle-6','ancient-hexi','moment-eastern-han']},
  {id:'three-kingdoms',title:'汉末战争与三国归晋',start:25,end:280,question:'北方统一、荆州争夺和长江防线，怎样改变天下格局？',ids:['battle-9','battle-10','ancient-xiangfan','battle-14']},
  {id:'north-south',title:'南北对峙与隋的统一',start:280,end:589,question:'淮河与长江为何重要？渡江还需要哪些政治与组织条件？',ids:['battle-15','expand-luoyang-494','battle-16']},
  {id:'early-tang',title:'隋唐交通与边疆',start:589,end:755,question:'运河、中原枢纽与遥远边疆，如何被放进同一个政治空间？',ids:['moment-tongji-canal','battle-17','battle-18']},
  {id:'late-tang',title:'安史冲击与唐的终局',start:755,end:907,question:'边军进入中原后，关隘、财政与地方权力怎样相互影响？',ids:['moment-an-lushan-revolt','battle-19','moment-two-tax-law']},
  {id:'song-liao',title:'五代与宋辽金格局',start:907,end:1127,question:'燕云地形与战争后的和议，怎样塑造多个政权间的关系？',ids:['moment-sixteen-prefectures','expand-huainan-zhou','moment-chanyuan-peace','battle-21']},
  {id:'song-yuan',title:'南宋防线与蒙古扩张',start:1127,end:1279,question:'从江面防守到襄樊枢纽，战争的通道怎样逐步打开？',ids:['battle-23','battle-25','battle-26']},
  {id:'ming',title:'元明更替与北方防御',start:1279,end:1618,question:'江湖水战与北方危机，如何连接王朝更替和首都防御？',ids:['battle-27','expand-jingnan','expand-beijing-capital','battle-28']},
  {id:'ming-qing',title:'辽西走廊与明清易代',start:1618,end:1689,question:'坚城、财政与联盟选择，为何必须放在同一张大地图上看？',ids:['sarhu','battle-30','moment-nerchinsk']},
  {id:'late-qing',title:'清帝国与近代海洋压力',start:1689,end:1912,question:'港口、漕运与条约，怎样连接战场压力和政治重组？',ids:['expand-jao-modo','battle-32','moment-shimonoseki','moment-republic-1912']},
  {id:'warlords',title:'民国军阀与北伐',start:1912,end:1928,question:'中央与地方军事势力的分合，怎样沿铁路、河流和省际门户展开？',ids:['expand-zhizhan-1920','moment-first-cooperation','expand-zhifeng-1924','tingsi','expand-longtan-1927']}
];

export const phaseLabels={overview:'时代速写',event:'局势与改变',focus:'地理细读',transition:'版图转折'};
export function snapshotAt(snapshots,year){let index=0;for(let i=0;i<snapshots.length;i++){if(snapshots[i].year<=year)index=i;else break}return index;}
export function snapshotChanges(before,after){const a=new Set(before.geojson.features.map(f=>f.properties.name)),b=new Set(after.geojson.features.map(f=>f.properties.name));return {added:[...b].filter(n=>!a.has(n)),removed:[...a].filter(n=>!b.has(n))};}
export function mapSignature(snapshot){return snapshot.geojson.features.map(f=>[f.properties.name,f.geometryRef||JSON.stringify(f.geometry)].join(':')).sort().join('|');}
export function impactSnapshot(snapshots,item,cap){const base=snapshotAt(snapshots,item.year),maxGap=item.year>=1840?10:item.year>=0?40:80;const next=snapshots.findIndex((s,i)=>i>base&&s.year>(item.endYear??item.year)&&s.year<=cap&&axisYear(s.year)-axisYear(item.year)<=maxGap);return {base,index:next<0?base:next,hasLater:next>=0};}
export function readingDuration(scene){const count=[scene.text,scene.secondary,...(scene.nodes||[]).map(n=>n.name+n.role)].filter(Boolean).join('').length;return Math.round(Math.max(6000,Math.min(14500,3200+count*48))/100)*100;}
// Extra scenes are editorial choices, never a mandatory template for every event.
export const geographyStops=new Set(['battle-9','battle-10','battle-15','battle-25','battle-30']);
const mapTurns=new Set(['qin','three-kingdoms','north-south','song-yuan','ming-qing','warlords']);
const overviewYears=[-2070,-1600,-1046,-770,-403,-221,-202,-108,25,184,208,222,280,383,420,589,618,755,907,960,1127,1279,1368,1449,1618,1644,1689,1759,1840,1895,1912,1916,1920,1924,1926,1927,1928];
const validPoint=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lng);
function boundsFor(points){const lat=points.map(p=>p.lat),lng=points.map(p=>p.lng);return {south:Math.min(...lat),north:Math.max(...lat),west:Math.min(...lng),east:Math.max(...lng)};}
function regionBounds(points){const b=boundsFor(points),lat=(b.south+b.north)/2,lng=(b.west+b.east)/2;const h=Math.max(7,(b.north-b.south)*1.5),w=Math.max(10,(b.east-b.west)*1.5);return [[lat-h/2,lng-w/2],[lat+h/2,lng+w/2]];}
export function planCameras(scenes,moments){
 const byId=new Map(moments.map(m=>[m.id,m]));let group=[],points=[],serial=0;
 const flush=()=>{if(!group.length)return;const bounds=regionBounds(points),camera={kind:'region',key:'region-'+serial+++'-'+bounds.flat().join(':'),bounds};group.forEach(s=>s.camera=camera);group=[];points=[];};
 for(const s of scenes){const item=byId.get(s.itemId);if(!item||s.phase==='transition'||!validPoint(item)){flush();s.camera={kind:'global',key:'global'};continue;}
  const next=[item,...(item.geoFactors||[])].filter(validPoint),combined=[...points,...next],b=boundsFor(combined);
  if(group.length&&(group[0].chapterId!==s.chapterId||b.east-b.west>14||b.north-b.south>10))flush();
  group.push(s);points.push(...next);
 }
 flush();return scenes;
}
export function buildTour({snapshots,moments,themes,mode='history',year=-2070,themeId}){
 const byId=new Map(moments.map(m=>[m.id,m]));let chapters,title;
 if(mode==='period'){const p=readingPeriods.find(p=>periodContains(p,year))||readingPeriods[0];chapters=[{...p,end:Math.min(MAX_YEAR,periodLastYear(p)),title:p.name,question:'沿本期事件，观察局势为什么改变。',ids:moments.filter(m=>periodContains(p,m.year)).map(m=>m.id)}];title=p.name+' · 事件串读';}
 else if(mode==='theme'){const t=themes.find(t=>t.id===themeId)||themes[0];const entries=(t?.ids||[]).map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>a.year-b.year);chapters=[{id:t?.id||'theme',title:t?.name||'专题线索',start:entries[0]?.year??year,end:Math.min(MAX_YEAR,entries.length?Math.max(...entries.map(m=>m.endYear??m.year)):year),question:t?.description||'',ids:entries.map(m=>m.id)}];title=t?.name||'专题线索';}
 else{chapters=historyChapters.map(c=>({...c}));title=mode==='overview'?'关键版图速览':'通史精选';}
 const scenes=[];
 const overviewIndexes=[...new Set([0,...overviewYears.map(y=>snapshotAt(snapshots,y)),snapshots.length-1])].sort((a,b)=>a-b).filter((i,j,list)=>!j||i===snapshots.length-1||mapSignature(snapshots[i])!==mapSignature(snapshots[list[j-1]]));
 for(let chapterIndex=0;chapterIndex<chapters.length;chapterIndex++){
  const c=chapters[chapterIndex],items=c.ids.map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>a.year-b.year||(a.sequence??50)-(b.sequence??50)||a.id.localeCompare(b.id));
  c.items=mode==='overview'?[]:items;c.sceneStart=scenes.length;
  const first=snapshotAt(snapshots,c.start),last=snapshotAt(snapshots,c.end);
  const append=s=>{const scene={id:c.id+'-'+scenes.length,chapterIndex,chapterId:c.id,chapterTitle:c.title,question:c.question,chapterBefore:first,chapterAfter:last,compareIndex:null,...s};scene.duration=readingDuration(scene);scenes.push(scene);};
  if(mode==='overview'){
   for(const i of overviewIndexes){const s=snapshots[i];if(s.year<c.start||s.year>c.end||(s.year===c.end&&chapterIndex<chapters.length-1))continue;const prev=scenes.at(-1);append({phase:prev?'transition':'overview',title:s.name,year:s.year,snapshotIndex:i,compareIndex:prev?.snapshotIndex??null,text:s.subtitle||s.description,secondary:''});}
  }else{
   if(!scenes.length&&mode==='history')append({phase:'overview',title:c.title,year:c.start,snapshotIndex:first,text:c.question,secondary:snapshots[first].subtitle||snapshots[first].description});
   for(const item of items){const current=snapshotAt(snapshots,item.year);const primary=item.summary||item.politics||item.outcome||'',impact=item.impact||item.outcome||'';
    append({phase:'event',itemId:item.id,title:item.name,year:item.year,snapshotIndex:current,text:primary,secondary:impact!==primary?impact:'',secondaryLabel:'带来什么改变',nodes:[]});
    const nodes=(item.geoFactors||[]).filter(n=>validPoint(n)&&n.role);
    if(geographyStops.has(item.id)&&nodes.length>=3&&(item.terrain||'').length>=24){append({phase:'focus',itemId:item.id,title:item.name,year:item.year,snapshotIndex:current,text:item.terrain,secondary:item.logistics&&item.logistics!==item.terrain?item.logistics:'',secondaryLabel:'补给与组织',nodes});}
   }
   // Compare only selected turning points with a genuinely different stored map.
   if(mode==='history'&&mapTurns.has(c.id)&&last!==first&&mapSignature(snapshots[first])!==mapSignature(snapshots[last])){
    append({phase:'transition',title:'格局转折 · '+c.title,year:c.end,snapshotIndex:last,compareIndex:first,text:snapshots[last].subtitle||snapshots[last].description,secondary:'对照本段起点与终点，观察多年间的分合；期间还有其他事件。'});
   }
   if(scenes.length===c.sceneStart)append({phase:'overview',title:c.title,year:c.start,snapshotIndex:first,text:snapshots[first].subtitle||snapshots[first].description,secondary:'这一分段尚未收录独立事件，简看已有版图后即可继续。'});
  }
  c.sceneEnd=scenes.length-1;
 }
 planCameras(scenes,moments);
 return {title,mode,chapters,scenes,eventCount:new Set(scenes.map(s=>s.itemId).filter(Boolean)).size,mapCount:new Set(scenes.map(s=>s.snapshotIndex)).size,duration:scenes.reduce((n,s)=>n+s.duration,0),focusCount:scenes.filter(s=>s.phase==='focus').length};
}

// A generation guard prevents stale callbacks after scrubbing, pausing or exiting.
export class TourClock{
  constructor({now=()=>performance.now(),set=(fn,ms)=>setTimeout(fn,ms),clear=id=>clearTimeout(id)}={}){this.now=now;this.set=set;this.clear=clear;this.token=0;this.playing=false;this.remaining=0;this.duration=0;}
  start(ms,done){this.stop();this.duration=ms;this.remaining=ms;this.done=done;this.resume();}
  resume(){if(this.playing||this.remaining<=0)return;this.playing=true;this.deadline=this.now()+this.remaining;const token=++this.token;this.timer=this.set(()=>{if(token!==this.token||!this.playing)return;this.playing=false;this.remaining=0;this.done?.();},this.remaining);}
  pause(){if(this.playing)this.remaining=Math.max(0,this.deadline-this.now());this.playing=false;this.token++;this.clear(this.timer);}
  stop(){this.pause();this.remaining=0;this.duration=0;this.done=null;}
  get fraction(){return this.duration?Math.max(0,Math.min(1,1-(this.playing?this.deadline-this.now():this.remaining)/this.duration)):0;}
}
