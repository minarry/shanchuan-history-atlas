import {axisYear,historicalYear,fitWindow,yearTicks,clusterMoments,createTimeScale} from './timeline-core.js';
import {periodStatistics,periodContains,periodLastYear,denseWindows} from './timeline-periods.js';

export function createChronologyTimeline({snapshots,moments,getActive,getMode,onYear,onEntry,onPause,onList,onFiction=()=>{},isFiction=()=>false}) {
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short=y=>y<0?`前${Math.abs(y)}`:String(y);
  const date=y=>y<0?`公元前${Math.abs(y)}年`:`公元${y}年`;
  const min=axisYear(snapshots[0].year),max=axisYear(snapshots.at(-1).year);
  const track=$('#chronologyTrack'),drawer=$('#timelineDrawer');
  const eras=periodStatistics(moments);
  const initialPeriod=eras.find(p=>periodContains(p,getActive().year))||eras[0];
  let compact=true,scale;
  let view=fitWindow((axisYear(initialPeriod.start)+axisYear(periodLastYear(initialPeriod)))/2,axisYear(initialPeriod.end)-axisYear(initialPeriod.start)-1,min,max),previewYear=null,drag=null,drawerItems=[],observer,activeEra=-1;
  const span=()=>view.end-view.start;
  const width=()=>Math.max(200,track.clientWidth-32);
  const px=year=>16+scale.toPixel(axisYear(year));
  const yearAt=x=>historicalYear(Math.max(min,Math.min(max,scale.toYear(x-16))));
  const visibleMoments=()=>moments.filter(m=>axisYear(m.year)>=view.start&&axisYear(m.year)<=view.end);
  const closeDrawer=()=>{drawer.hidden=true;$('#visibleEventsBtn').setAttribute('aria-expanded','false');};
  function changeView(center,size){view=fitWindow(center,size,min,max);closeDrawer();render();}
  function zoom(factor,anchor=.5){onPause();const point=view.start+span()*anchor,newSpan=Math.max(5,Math.min(max-min,span()*factor));changeView(point+newSpan*(.5-anchor),newSpan);}
  function pan(direction){onPause();changeView((view.start+view.end)/2+span()*.65*direction,span());}
  function ensure(year){const x=axisYear(year);if(x<view.start||x>view.end)view=fitWindow(x,span(),min,max);}
  function choose(item){onPause();closeDrawer();onEntry(item);}
  function eraScrollButtons(){const nav=$('#eraTrack');$('#eraNavPrev').disabled=nav.scrollLeft<2;$('#eraNavNext').disabled=nav.scrollLeft+nav.clientWidth>=nav.scrollWidth-2;}
  function selectEra(i){
    onPause();const period=eras[i],start=axisYear(period.start),end=Math.min(max,axisYear(period.end)-1);
    const knownYears=[...snapshots,...period.items].filter(item=>periodContains(period,item.year)).map(item=>item.year);
    changeView((start+end)/2,end-start);onYear(knownYears.length?Math.min(...knownYears):period.start);
  }
  function renderPeriodFocus(i){
    const period=eras[i],windows=denseWindows(period);
    $('#eraSelect').value=period.id;
    $('#periodEventsBtn').textContent=`${period.name} · ${period.count}事 ▤`;
    $('#periodEventsBtn').title=`查看${period.name}全部${period.count}个已收录事件`;
    $('#periodEventsBtn').onclick=()=>showItems(period.items,`${period.name} · ${period.count} 个已收录事件`);
    $('#periodFocus').innerHTML=windows.length?windows.map((w,k)=>`<button class="period-hotspot" data-window="${k}" title="${esc(w.items.map(m=>`${date(m.year)} ${m.name}`).join('\n'))}"><span>${short(w.firstYear)}${w.firstYear===w.lastYear?'':'—'+short(w.lastYear)}年</span><b>${w.count}事</b></button>`).join(''):`<span class="period-focus-empty">${period.count?'本期事件较分散，可查看全期列表':'本期暂无事件条目，可查看版图'}</span>`;
    $('#periodFocus').querySelectorAll('button').forEach(b=>b.onclick=()=>{onPause();const w=windows[+b.dataset.window];changeView((axisYear(w.start)+axisYear(w.end))/2,axisYear(w.end)-axisYear(w.start));onYear(w.firstYear);});
  }
  function showItems(items,title){
    if(onList){onPause();onList(items,title);return;}
    drawerItems=items;
    $('#timelineDrawerTitle').textContent=title;
    $('#timelineDrawerList').innerHTML=items.map((m,i)=>`<button data-drawer-item="${i}" class="drawer-item ${getActive().id===m.id?'current':''}"><time>${date(m.year)}</time><span class="node-kind ${m._kind}">${m._kind==='event'?'战役':'历史'}</span><strong>${esc(m.name)}</strong><span>↗</span></button>`).join('')||'<p class="empty">这一段暂无已收录的战役或历史事件，可继续查看版图切片。</p>';
    drawer.hidden=false;$('#visibleEventsBtn').setAttribute('aria-expanded','true');
    drawer.querySelectorAll('[data-drawer-item]').forEach(b=>b.onclick=()=>choose(drawerItems[+b.dataset.drawerItem]));
    $('#timelineDrawerClose').focus({preventScroll:true});
  }
  function render(){
    if(isFiction())return;
    const active=getActive(),year=previewYear??active.year,w=width(),visible=visibleMoments(),mode=getMode();
    scale=createTimeScale(view.start,view.end,w,mode==='slices'?snapshots:moments,compact);
    const {step,ticks}=yearTicks(view.start,view.end,w);
    const gapAt=axis=>scale.gaps.some(g=>axis>g.start&&axis<g.end);
    const candidates=scale.gaps.length?[...ticks.filter(t=>!gapAt(t.axis)),...visible.map(m=>({year:m.year,axis:axisYear(m.year),major:true})),{year:historicalYear(view.start),axis:view.start,major:true},{year:historicalYear(view.end),axis:view.end,major:true}].sort((a,b)=>a.axis-b.axis):ticks;
    let tickEnd=-Infinity;const renderedTicks=[];for(const t of candidates){const x=scale.toPixel(t.axis);if(t.major){if(x<tickEnd+48)continue;tickEnd=x;}renderedTicks.push(t);}
    $('#timelineSpacing').setAttribute('aria-pressed',String(compact));$('#timelineSpacing').textContent=compact?'智能间距':'按年等距';
    $('#timelineSpacingNote').textContent=scale.gaps.length?'智能间距 · 斜纹为压缩区间，可点击展开':compact?'智能间距 · 点击事件查看详情':'按年等距 · 拖动平移 / 滚轮缩放';
    $('#timeGaps').innerHTML=scale.gaps.map((g,i)=>'<button class="time-gap" data-time-gap="'+i+'" style="left:'+(16+g.x)+'px;width:'+Math.max(2,g.right-g.x)+'px" title="'+date(historicalYear(g.start))+'—'+date(historicalYear(g.end))+'：此区间暂无已收录事件，点击按年展开" aria-label="展开压缩区间 '+date(historicalYear(g.start))+'至'+date(historicalYear(g.end))+'"><span>⋯</span><small>'+Math.round(g.end-g.start)+'年</small></button>').join('');
    $('#timeGaps').querySelectorAll('button').forEach(b=>b.onclick=()=>{onPause();const g=scale.gaps[+b.dataset.timeGap];compact=false;changeView((g.start+g.end)/2,g.end-g.start);});
    $('#timelineRange').textContent=`${short(historicalYear(view.start))} — ${short(historicalYear(view.end))}年`;
    $('#timelineScale').textContent=scale.gaps.length?'空疏时段已压缩':`主刻度 ${step}年`;
    $('#visibleEventsBtn').textContent=`本段 ${visible.length} 个事件 ▤`;
    $('#timeZoomOut').disabled=span()>=max-min;$('#timeZoomIn').disabled=span()<=5;
    $('#timePanPrev').disabled=view.start<=min;$('#timePanNext').disabled=view.end>=max;
    const presets=[...$('#timeScale').options];$('#timeScale').value=presets.find(o=>Math.abs(+o.value-span())<.1)?.value||'custom';
    $('#overviewWindow').style.left=`${(view.start-min)/(max-min)*100}%`;
    $('#overviewWindow').style.width=`${span()/(max-min)*100}%`;
    $('#overviewCursor').style.left=`${(axisYear(year)-min)/(max-min)*100}%`;
    $('#eraTrack').querySelectorAll('button[data-era]').forEach((b,i)=>{const active=periodContains(eras[i],year);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));if(active&&activeEra!==i){activeEra=i;renderPeriodFocus(i);const nav=$('#eraTrack');nav.scrollTo({left:b.offsetLeft-nav.offsetLeft-nav.clientWidth/2+b.clientWidth/2,behavior:'auto'});}});
    $('#eraSelect').value=eras.find(p=>periodContains(p,year))?.id||eras[0].id;
    eraScrollButtons();
    $('#rulerTicks').innerHTML=renderedTicks.map(t=>`<span class="year-tick ${t.major?'major':''}" style="left:${16+scale.toPixel(t.axis)}px">${t.major?`<b>${short(t.year)}</b>`:''}</span>`).join('');
    // Boundary snapshots remain separate from dated events, even in the shared chronology.
    $('#sliceMarkers').hidden=mode==='moments';
    $('#sliceMarkers').innerHTML=snapshots.map((s,i)=>({s,i})).filter(({s})=>axisYear(s.year)>=view.start&&axisYear(s.year)<=view.end).map(({s,i})=>`<button class="slice-tick ${active.sliceIndex===i?'active':''}" data-slice="${i}" style="left:${px(s.year)}px" aria-label="${date(s.year)}，${esc(s.name)}版图切片" title="${date(s.year)} · ${esc(s.name)}版图"></button>`).join('');
    $('#sliceMarkers').querySelectorAll('button').forEach(b=>b.onclick=()=>choose({...snapshots[+b.dataset.slice],id:`slice-${b.dataset.slice}`,_kind:'slice',sliceIndex:+b.dataset.slice}));
    const groups=clusterMoments(visible,view.start,view.end,w,scale.toPixel),ends=[-Infinity,-Infinity,-Infinity];
    $('#eventMarkers').hidden=mode==='slices';
    $('#eventMarkers').innerHTML=groups.map((g,i)=>{
      const first=g.items[0],last=g.items.at(-1),multiple=g.items.length>1;
      const label=multiple?`${g.items.length} 个事件`:first.name;
      const labelW=Math.min(128,Math.max(76,label.length*11+18));
      const left=Math.max(0,Math.min(w+32-labelW,g.x+16-labelW/2));
      let lane=ends.findIndex(end=>left>=end+5);if(lane<0)lane=ends.indexOf(Math.min(...ends));ends[lane]=left+labelW;
      const isActive=g.items.some(m=>m.id===active.id),kind=multiple?'cluster':first._kind;
      return `<button class="event-node ${kind} ${isActive?'active':''}" data-group="${i}" style="left:${g.x+16}px;--label-left:${left-g.x-16}px;--label-width:${labelW}px;--node-top:${lane*20}px" aria-label="${date(first.year)}${first.year!==last.year?'至'+date(last.year):''}，${esc(multiple?g.items.map(m=>m.name).join('、'):label)}" title="${esc(g.items.map(m=>`${date(m.year)} ${m.name}`).join('\n'))}"><span class="event-node-label">${multiple?'◉':kind==='event'?'⚔':'◆'} ${esc(label)}</span><i class="event-stem"></i><b class="event-dot">${multiple?g.items.length:''}</b></button>`;
    }).join('');
    $('#eventMarkers').querySelectorAll('button').forEach(b=>b.onclick=()=>{const items=groups[+b.dataset.group].items;if(items.length===1)choose(items[0]);else showItems(items,`${date(items[0].year)}${items[0].year!==items.at(-1).year?' — '+date(items.at(-1).year):''} · ${items.length} 个事件`)});
    if(!visible.length&&mode!=='slices'){
      const next=moments.find(m=>axisYear(m.year)>view.end),target=next||moments.findLast(m=>axisYear(m.year)<view.start);
      $('#eventMarkers').innerHTML='<div class="timeline-empty"><span>本段暂无已收录事件</span>'+(target?'<button id="nextRecordedEvent">'+(next?'下一事件':'上一事件')+' · '+short(target.year)+'年 '+esc(target.name)+' →</button>':'')+'<button id="viewStoredMaps">只看版图</button></div>';
      if(target)$('#nextRecordedEvent').onclick=()=>{changeView(axisYear(target.year),Math.min(50,span()));choose(target);};
      $('#viewStoredMaps').onclick=()=>{$('#timelineMode').value='slices';$('#timelineMode').dispatchEvent(new Event('change'));};
    }
    const cursor=$('#yearCursor'),inside=axisYear(year)>=view.start&&axisYear(year)<=view.end;
    cursor.hidden=!inside;cursor.style.left=`${px(year)}px`;
    cursor.style.setProperty('--cursor-label-offset',`${Math.max(50,Math.min(track.clientWidth-50,px(year)))-px(year)+12}px`);
    $('#cursorYear').textContent=date(year);cursor.setAttribute('aria-valuenow',String(year));cursor.setAttribute('aria-valuetext',date(year));
    $('#timelineSelection').textContent=previewYear!==null?`松开定位 · ${date(year)}`:active.label;
    track.setAttribute('aria-label',`历史时间主线，${date(historicalYear(view.start))}至${date(historicalYear(view.end))}。点击选年，拖动平移，滚轮缩放。`);
  }
  const maxDensity=Math.max(...eras.map(p=>Math.log1p(p.density)));
  $('#eraTrack').innerHTML=eras.map((p,i)=>{
    const heat=Math.log1p(p.density)/maxDensity;
    return `<button class="era-segment ${heat>.6?'event-rich':''}" data-era="${i}" style="--density:${Math.round(heat*100)}%;--era-width:${Math.max(p.count?74:48,p.name.length*11+19)+Math.round(Math.sqrt(p.count)*7)}px" aria-label="${esc(p.name)}，${date(p.start)}至${date(periodLastYear(p))}，${p.count}个已收录事件" title="${esc(p.name)} · 阅读区间 ${date(p.start)} — ${date(periodLastYear(p))}\n已收录 ${p.count} 个战役与历史事件；分段不表示同期各政权完整存续期。"><span>${esc(p.name)}</span><small>${p.count}</small><i></i></button>`;
  }).join('');
  $('#eraTrack').insertAdjacentHTML('beforeend','<button id="butianEntry" class="era-segment bt-era-segment" aria-label="补天，独立架空篇章" aria-pressed="false"><span>补天</span><small>架空</small></button>');
  $('#butianEntry').onclick=onFiction;
  $('#eraTrack').querySelectorAll('button[data-era]').forEach(b=>b.onclick=()=>selectEra(+b.dataset.era));
  $('#eraTrack').addEventListener('scroll',eraScrollButtons,{passive:true});
  $('#eraNavPrev').onclick=()=>$('#eraTrack').scrollBy({left:-$('#eraTrack').clientWidth*.65,behavior:'smooth'});
  $('#eraNavNext').onclick=()=>$('#eraTrack').scrollBy({left:$('#eraTrack').clientWidth*.65,behavior:'smooth'});
  $('#eraTrack').addEventListener('wheel',e=>{if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;e.preventDefault();$('#eraTrack').scrollLeft+=e.deltaY;},{passive:false});
  $('#eraSelect').innerHTML=[...new Set(eras.map(p=>p.group))].map(group=>`<optgroup label="${esc(group)}">${eras.filter(p=>p.group===group).map(p=>`<option value="${p.id}">${esc(p.name)} · ${p.count}事</option>`).join('')}</optgroup>`).join('');
  $('#eraSelect').insertAdjacentHTML('beforeend','<optgroup label="独立架空篇章"><option value="butian">补天 · 架空</option></optgroup>');
  $('#eraSelect').onchange=e=>e.target.value==='butian'?onFiction():selectEra(eras.findIndex(p=>p.id===e.target.value));
  const bins=Array.from({length:100},()=>0);
  for(const m of moments)bins[Math.max(0,Math.min(99,Math.floor((axisYear(m.year)-min)/(max-min)*100)))]++;
  const peak=Math.max(...bins);
  $('#overviewDensity').innerHTML=bins.map(n=>`<i style="opacity:${n?Math.max(.15,Math.sqrt(n/peak)):0}"></i>`).join('');
  $('#timelineSpacing').onclick=()=>{onPause();compact=!compact;render();};
  $('#timeZoomIn').onclick=()=>zoom(.5);$('#timeZoomOut').onclick=()=>zoom(2);
  $('#timePanPrev').onclick=()=>pan(-1);$('#timePanNext').onclick=()=>pan(1);
  $('#timeScale').onchange=e=>{if(e.target.value==='custom')return;onPause();changeView(axisYear(getActive().year),+e.target.value);};
  $('#timeFollow').onclick=()=>{onPause();changeView(axisYear(getActive().year),span());};
  $('#timeAll').onclick=()=>{onPause();changeView((min+max)/2,max-min);};
  $('#visibleEventsBtn').onclick=()=>drawer.hidden?showItems(visibleMoments(),$('#timelineRange').textContent+' · 事件列表'):closeDrawer();
  $('#timelineDrawerClose').onclick=()=>{closeDrawer();$('#visibleEventsBtn').focus({preventScroll:true});};
  $('#timelineOverview').onclick=e=>{onPause();const r=e.currentTarget.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));changeView(min+x*(max-min),span());};
  track.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.target.closest('.event-node,.slice-tick,.time-gap,.timeline-empty'))return;
    onPause();closeDrawer();const r=track.getBoundingClientRect();
    drag={id:e.pointerId,x:e.clientX,start:view.start,end:view.end,scrub:!!e.target.closest('#yearCursor'),moved:false,left:r.left};
    track.setPointerCapture(e.pointerId);track.classList.add('dragging');
  });
  track.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x;if(Math.abs(dx)>4)drag.moved=true;
    if(drag.scrub){previewYear=yearAt(e.clientX-drag.left);render();}
    else if(drag.moved){view=fitWindow((drag.start+drag.end)/2-dx/width()*(drag.end-drag.start),drag.end-drag.start,min,max);render();}
  });
  const finish=(e,cancel=false)=>{if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;track.classList.remove('dragging');if(track.hasPointerCapture(e.pointerId))track.releasePointerCapture(e.pointerId);const year=previewYear??yearAt(e.clientX-d.left);previewYear=null;if(!cancel&&(d.scrub||!d.moved))onYear(year);else render();};
  track.addEventListener('pointerup',e=>finish(e));track.addEventListener('pointercancel',e=>finish(e,true));
  track.addEventListener('wheel',e=>{e.preventDefault();const r=track.getBoundingClientRect();if(Math.abs(e.deltaX)>Math.abs(e.deltaY)){onPause();changeView((view.start+view.end)/2+e.deltaX/width()*span(),span());}else zoom(e.deltaY>0?1.15:1/1.15,Math.max(0,Math.min(1,(e.clientX-r.left-16)/width())));},{passive:false});
  $('#yearCursor').addEventListener('keydown',e=>{const y=axisYear(getActive().year);let target;if(e.key==='ArrowRight')target=y+(e.shiftKey?10:1);if(e.key==='ArrowLeft')target=y-(e.shiftKey?10:1);if(e.key==='Home')target=min;if(e.key==='End')target=max;if(target!==undefined){e.preventDefault();e.stopPropagation();onPause();onYear(historicalYear(Math.max(min,Math.min(max,target))));}});
  track.addEventListener('keydown',e=>{if(e.target!==track)return;if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.5)}else if(e.key==='-'){e.preventDefault();zoom(2)}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();pan(e.key==='ArrowLeft'?-1:1)}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
  observer=new ResizeObserver(()=>render());observer.observe(track);
  return {showPeriod(){const p=eras.find(p=>periodContains(p,getActive().year));if(p)showItems(p.items,p.name+' · '+p.count+' 个已收录事件');},sync(){ensure(getActive().year);render();},render,close:closeDrawer};
}
