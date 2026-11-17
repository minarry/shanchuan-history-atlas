import {END_YEAR} from './history-domain.js';
import {axisYear,historicalYear} from './timeline-core.js';

// Consecutive reading windows, not a table of each concurrent polity's lifespan.
// The early chronology follows the atlas's approximate dates. An event on a
// boundary belongs to the following window; 1928 remains included at the end.
const starts=[
  ['夏',-2070,'先秦'],['商',-1600,'先秦'],['西周',-1046,'先秦'],
  ['春秋',-770,'先秦'],['战国',-475,'先秦'],
  ['秦',-221,'秦汉'],['楚汉之争',-206,'秦汉'],['西汉',-202,'秦汉'],
  ['新与更始',9,'秦汉'],['东汉',25,'秦汉'],['汉末群雄',184,'秦汉'],
  ['三国',220,'魏晋南北朝'],['西晋',265,'魏晋南北朝'],
  ['东晋十六国',317,'魏晋南北朝'],['南北朝',420,'魏晋南北朝'],
  ['隋',581,'隋唐五代'],['初盛唐',618,'隋唐五代'],
  ['安史之乱',755,'隋唐五代'],['中晚唐',764,'隋唐五代'],['五代十国',907,'隋唐五代'],
  ['北宋·辽夏',960,'宋辽金元'],['南宋·金',1127,'宋辽金元'],['元',1279,'宋辽金元'],
  ['明',1368,'明清'],['明末争衡',1618,'明清'],['清前中期',1644,'明清'],
  ['晚清',1840,'晚清与民国'],['民国初年',1912,'晚清与民国'],
  ['北洋军阀',1916,'晚清与民国'],['直皖直奉争衡',1920,'晚清与民国'],
  ['军阀多方对峙',1924,'晚清与民国'],['北伐时期',1926,'晚清与民国']
];
export const readingPeriods=starts.map(([name,start,group],i)=>({
  id:`period-${i}`,name,start,group,end:starts[i+1]?.[1]??END_YEAR
}));
export const periodContains=(period,year)=>year>=period.start&&year<period.end;
export const periodLastYear=period=>historicalYear(axisYear(period.end)-1);
export function periodStatistics(moments){
  return readingPeriods.map(period=>{
    const items=moments.filter(m=>periodContains(period,m.year));
    const duration=axisYear(period.end)-axisYear(period.start);
    return {...period,items,count:items.length,density:items.length/duration*100};
  });
}
export function denseWindows(period){
  const items=[...period.items].sort((a,b)=>a.year-b.year);
  const candidates=[];
  for(const firstYear of new Set(items.map(m=>m.year))){
    const subset=items.filter(m=>m.year>=firstYear&&axisYear(m.year)-axisYear(firstYear)<=24);
    if(subset.length<3&&!(subset.length===2&&subset[0].year===subset[1].year))continue;
    const lastYear=subset.at(-1).year;
    candidates.push({firstYear,lastYear,count:subset.length,items:subset,score:subset.length**2/Math.max(5,axisYear(lastYear)-axisYear(firstYear)+1)});
  }
  candidates.sort((a,b)=>b.score-a.score||b.count-a.count||a.firstYear-b.firstYear);
  const chosen=[];
  for(const c of candidates){
    if(chosen.some(w=>c.firstYear<=w.lastYear&&c.lastYear>=w.firstYear))continue;
    chosen.push({...c,start:historicalYear(Math.max(axisYear(period.start),axisYear(c.firstYear)-2)),end:historicalYear(Math.min(axisYear(period.end)-1,axisYear(c.lastYear)+2))});
    if(chosen.length===3)break;
  }
  return chosen.sort((a,b)=>a.firstYear-b.firstYear);
}
