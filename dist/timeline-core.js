// Continuous historical years: 1 BCE is immediately followed by 1 CE.
export const axisYear = year => year < 0 ? year + 1 : year;
export const historicalYear = value => Math.round(value) <= 0 ? Math.round(value) - 1 : Math.round(value);
export function fitWindow(center, span, min, max) {
  span = Math.min(max - min, Math.max(5, span));
  const start = Math.max(min, Math.min(max - span, center - span / 2));
  return {start, end: start + span};
}
export function yearTicks(start, end, width) {
  const target = (end - start) / Math.max(2, width / 85);
  const step = end-start<=10 ? 1 : [1,2,5,10,20,25,50,100,200,250,500,1000,2000].find(n => n >= target) || 2000;
  const minor = step >= 10 ? step / 5 : 1;
  const ticks = [];
  for (let year = Math.floor(historicalYear(start) / minor) * minor; year <= historicalYear(end); year += minor) {
    if (year===0) continue;
    const axis=axisYear(year);
    if (axis<start || axis>end) continue;
    ticks.push({axis,year,major:Math.abs(year / step - Math.round(year / step)) < .001});
  }
  return {step, ticks};
}
export function mergeTimeline(snapshots, moments) {
  return [...snapshots.map((s,i) => ({id:`slice-${i}`,name:s.name,year:s.year,_kind:'slice',sliceIndex:i})), ...moments]
    .sort((a,b) => axisYear(a.year)-axisYear(b.year) || (a._kind==='slice'?-1:b._kind==='slice'?1:0) || (a.sequence??50)-(b.sequence??50) || a.id.localeCompare(b.id));
}
export function clusterMoments(items, start, end, width, project) {
  const groups=[];
  for (const item of items) {
    if(axisYear(item.year)<start||axisYear(item.year)>end)continue;
    const x=project?project(axisYear(item.year)):(axisYear(item.year)-start)/(end-start)*width;
    if(x<0 || x>width) continue;
    const last=groups.at(-1);
    if(last && x-last.firstX<40) {last.items.push(item);last.x=(last.firstX+x)/2;}
    else groups.push({x,firstX:x,items:[item]});
  }
  return groups;
}

// Piecewise time scale: empty stretches can be compact, but remain reversible
// and explicitly marked. All dates and ordering are preserved, including BCE.
export function createTimeScale(start,end,width,items,compact=true){
  const duration=end-start,radius=Math.max(2,Math.min(12,duration*.015));
  const anchors=[...new Set(items.map(m=>axisYear(m.year)).filter(y=>y>=start&&y<=end))].sort((a,b)=>a-b);
  const intervals=[];
  if(compact&&duration>20&&anchors.length){
    for(const year of anchors){const a=Math.max(start,year-radius),b=Math.min(end,year+radius),last=intervals.at(-1);if(last&&a<=last.end)last.end=Math.max(last.end,b);else intervals.push({start:a,end:b});}
  }
  const segments=[];
  const add=(a,b,gap)=>{if(b<=a)return;const compressed=gap&&(b-a)>radius*4;segments.push({start:a,end:b,compressed,weight:compressed?radius:b-a});};
  if(!intervals.length)add(start,end,false);
  else{let cursor=start;for(const interval of intervals){add(cursor,interval.start,true);add(interval.start,interval.end,false);cursor=interval.end;}add(cursor,end,true);}
  const total=segments.reduce((sum,s)=>sum+s.weight,0);let offset=0;
  for(const segment of segments){segment.x=offset/total*width;offset+=segment.weight;segment.right=offset/total*width;}
  const toPixel=year=>{const y=Math.max(start,Math.min(end,year)),s=segments.find(s=>y<=s.end)||segments.at(-1);return s.x+(y-s.start)/(s.end-s.start)*(s.right-s.x);};
  const toYear=pixel=>{const x=Math.max(0,Math.min(width,pixel)),s=segments.find(s=>x<=s.right)||segments.at(-1);return s.start+(x-s.x)/(s.right-s.x)*(s.end-s.start);};
  return {toPixel,toYear,segments,gaps:segments.filter(s=>s.compressed)};
}
