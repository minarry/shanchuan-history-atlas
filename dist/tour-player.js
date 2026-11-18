import {buildTour,phaseLabels,snapshotChanges,TourClock} from './tour-script.js';
import {readingPeriods,periodContains} from './timeline-periods.js';

export function createTourPlayer({snapshots,moments,themes,sources=[],getYear,getPoliticalCaption=()=>null,onEnter,onExit,onScene,onCamera,onReadDetail}){
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yr=y=>y<0?`公元前${Math.abs(y)}年`:`公元${y}年`;
  const byId=new Map(moments.map(m=>[m.id,m])),clock=new TourClock();
  let active=false,deck=null,index=0,rate=1,autoCamera=true,loop=false,finished=false,frame=null,setupYear=getYear(),preview=null;
  const scene=()=>deck?.scenes[index];
  const mode=()=>$('input[name="tourMode"]:checked').value;
  const duration=()=>scene().duration/rate;
  function startIndex(d){if($('#tourStartAt').value!=='current'||!['history','overview'].includes(mode()))return 0;const at=d.scenes.findIndex(s=>s.year>=setupYear);return at<0?d.scenes.length-1:at;}
  function updateSetup(){
    $('#tourThemeWrap').hidden=mode()!=='theme';$('#tourStartWrap').hidden=!['history','overview'].includes(mode());
    preview=buildTour({snapshots,moments,themes,mode:mode(),year:setupYear,themeId:$('#tourThemeSelect').value});
    const minutes=Math.max(1,Math.ceil(preview.scenes.slice(startIndex(preview)).reduce((n,s)=>n+s.duration,0)/+$('#tourSetupRate').value/60000));
    $('#tourPreviewTitle').textContent=preview.title;
    $('#tourPreviewStats').textContent=`${preview.chapters.length}章 · ${mode()==='overview'?preview.mapCount+'幅关键版图':preview.eventCount+'个事件 / '+preview.focusCount+'处地理细读'} · 约${minutes}分钟`;
    $('#tourPreviewRoute').textContent=preview.chapters.map(c=>c.title).join(' → ');
  }
  function openSetup(){
    pause();setupYear=getYear();const p=readingPeriods.find(p=>periodContains(p,setupYear));$('#tourCurrentPeriod').textContent=`${p?.name||'当前时期'} · 展开本期全部事件`;
    updateSetup();$('#tourDialog').showModal();
  }
  function progress(){
    $('#tourShotProgress').style.width=`${clock.fraction*100}%`;
    if(active&&clock.playing)frame=requestAnimationFrame(progress);
  }
  function controls(){
    $('#tourPlay').textContent=clock.playing?'Ⅱ':finished?'↻':'▶';
    $('#tourPlay').setAttribute('aria-label',clock.playing?'暂停导览':finished?'重新播放导览':'继续导览');
    $('#tourPlaybackStatus').textContent=finished?'本次导览已完成':clock.playing?'自动播放中':'已暂停 · 可自由查看地图';
    $('#tourPrev').disabled=index===0;$('#tourNext').disabled=index===deck.scenes.length-1;
    $('#tourSeek').max=deck.scenes.length-1;$('#tourSeek').value=index;
    $('#tourPosition').textContent=`${index+1} / ${deck.scenes.length} 幕`;
    const remaining=deck.scenes.slice(index+1).reduce((n,s)=>n+s.duration,0)/rate+(clock.playing?Math.max(0,clock.deadline-clock.now()):clock.remaining);
    $('#tourTotal').textContent=`余约${Math.ceil(remaining/60000)}分钟`;
    const next=deck.scenes[index+1];$('#tourNextLabel').textContent=next?`接下来 · ${phaseLabels[next.phase]} / ${next.title}`:'从局部事件，回望整体历史';
    $('#tourAutoCamera').setAttribute('aria-pressed',String(autoCamera));$('#tourAutoCamera').textContent=autoCamera?'自动镜头 ✓':'镜头已固定';
    $('#tourLoop').setAttribute('aria-pressed',String(loop));
    $('#tourShotProgress').style.width=`${clock.fraction*100}%`;
  }
  function pause(){if(!active)return;clock.pause();cancelAnimationFrame(frame);controls();}
  function continuePlay(){
    if(finished){go(0,true);return;}
    if(!clock.remaining){arm();return;}
    // Re-establish the narrated scene after freely inspecting the map.
    applyScene(autoCamera,true);clock.resume();controls();cancelAnimationFrame(frame);progress();
  }
  function toggle(){if(clock.playing)pause();else continuePlay();}
  function advance(){if(!active)return;if(index===deck.scenes.length-1){if(loop)go(0,true);else{finished=true;controls();}}else go(index+1,true);}
  function arm(){clock.start(duration(),advance);controls();cancelAnimationFrame(frame);progress();}
  function mapDate(s,shown=s.snapshotIndex){
    const caption=getPoliticalCaption();
    if(caption){$('#tourMapDate').textContent='事件版图 · '+caption;$('#tourEvidenceNote').textContent='按史料记载定位到本阶段，城镇和领地范围均为概略示意。';return;}
    $('#tourMapDate').textContent=`实色版图：${yr(snapshots[shown].year)}${s.compareIndex!==null&&shown===s.snapshotIndex?' · 虚线基准：'+yr(snapshots[s.compareIndex].year):''}`;
  }
  function applyScene(camera,forceCamera=false){
    const s=scene();onScene(s,{camera:camera&&autoCamera,forceCamera});mapDate(s);
    $('#tourBeforeBtn').classList.remove('active');$('#tourAfterBtn').classList.add('active');
    $('#tourCameraStatus').textContent=!autoCamera?'镜头固定 · 可自由查看':s.camera?.kind==='region'?'同一区域保持视野 · 点击节点才细看':'固定全图 · 只观察版图变化';
  }
  function render(){
    const s=scene(),item=byId.get(s.itemId);
    $('.tour-story-card').scrollTop=0;
    $('#tourTitleLabel').textContent=deck.title;$('#tourChapterNumber').textContent=`CHAPTER ${String(s.chapterIndex+1).padStart(2,'0')} / ${deck.chapters.length}`;
    $('#tourChapterTitle').textContent=s.chapterTitle;
    $('#tourPhase').textContent=phaseLabels[s.phase];
    $('#tourEventDate').textContent=item?`${yr(item.year)}${item.endYear?'—'+yr(item.endYear):''}`:yr(s.year);
    $('#tourSceneTitle').textContent=s.title;$('#tourNarration').textContent=s.text||'';
    $('#tourSecondary').textContent=s.secondary&&s.secondary!==s.text?s.secondary:'';$('#tourSecondary').dataset.label=s.secondaryLabel||'';$('#tourNarration').dataset.label=s.phase==='event'?'发生了什么':'';
    $('#tourGeoNodes').innerHTML=s.phase==='focus'?(item?.geoFactors||[]).map((f,i)=>`<button data-tour-factor="${i}" title="${esc(f.role)}"><b>${i+1}</b><span>${esc(f.name)}<small>${esc(f.role)}</small></span></button>`).join(''):'';
    $('#tourGeoNodes').querySelectorAll('button').forEach(b=>b.onclick=()=>{pause();onCamera('factor',s,+b.dataset.tourFactor);$('#tourCameraStatus').textContent='地理细看 · 已暂停，继续播放可回到叙事';});
    const compare=s.compareIndex!==null;$('#tourMapComparison').hidden=!compare;
    if(compare){
      const a=snapshots[s.compareIndex],b=snapshots[s.snapshotIndex],change=snapshotChanges(a,b);
      $('#tourBeforeBtn').textContent=`基准 ${yr(a.year)}`;$('#tourAfterBtn').textContent=`后续 ${yr(b.year)}`;
      $('#tourChanges').textContent=change.added.length?`后图新增标注：${change.added.slice(0,4).join('、')}${change.added.length>4?'等':''}。`:change.removed.length?`后图不再单列：${change.removed.slice(0,4).join('、')}。`:'两图政权名称相近，留意边界与势力范围的变化。';
    }
    $('#tourEvidenceNote').textContent=compare?'实色与虚线来自两个真实年代切片；期间还有其他事件，不能把全部差异归因于本场事件。':s.phase==='event'?'采用事件对应的代表切片，政治影响依据条目史料；不补造即时战后边界。':s.phase==='focus'?'地理节点为概略定位，地形与河道采用固定现代底图。':'政治边界为代表年代的概括示意；早期活动范围不等于精确国界。';
    const sourceUrl=item?.sourceUrl||sources.find(source=>item?.sourceRefs?.includes(source.id))?.url;
    $('#tourReadDetail').hidden=!item;$('#tourSource').hidden=!sourceUrl;
    if(sourceUrl)$('#tourSource').href=sourceUrl;
    const stops=deck.scenes.map((t,at)=>({t,at})).filter(({t})=>s.itemId?t.itemId===s.itemId:t.id===s.id);
    $('#tourPhaseRail').innerHTML=stops.map(({t,at})=>'<button data-tour-phase="'+at+'" class="'+(at===index?'active':'')+'">'+phaseLabels[t.phase]+'</button>').join('<span>›</span>');
    $('#tourPhaseRail').querySelectorAll('button').forEach(b=>b.onclick=()=>go(+b.dataset.tourPhase,false));
    $('#tourOutlineContent').querySelectorAll('[data-tour-chapter]').forEach(b=>b.classList.toggle('active',+b.dataset.tourChapter===s.chapterIndex));
    $('#tourOutlineContent').querySelectorAll('[data-tour-item]').forEach(b=>b.classList.toggle('active',b.dataset.tourItem===s.itemId));
    controls();
  }
  function go(to,autoplay=clock.playing){
    if(!active)return;clock.stop();cancelAnimationFrame(frame);finished=false;index=Math.max(0,Math.min(deck.scenes.length-1,to));
    render();applyScene(true);if(autoplay)arm();else{clock.start(duration(),advance);clock.pause();controls();}
  }
  function start(){
    updateSetup();deck=preview;index=startIndex(deck);rate=+$('#tourSetupRate').value;$('#tourRate').value=String(rate);
    $('#tourDialog').close();if(!active)onEnter();active=true;autoCamera=true;finished=false;
    $('#tourShell').hidden=false;$('#tourControls').hidden=false;$('#tourOutline').hidden=true;
    $('#tourOutlineBtn').setAttribute('aria-expanded','false');
    $('#tourOutlineContent').innerHTML=deck.chapters.map((c,i)=>`<section><button data-tour-chapter="${i}"><small>${String(i+1).padStart(2,'0')}</small>${esc(c.title)}</button><p>${esc(c.question)}</p>${c.items.map(m=>`<button class="tour-outline-event" data-tour-item="${esc(m.id)}" data-tour-at="${deck.scenes.findIndex(s=>s.chapterIndex===i&&s.itemId===m.id&&s.phase==='event')}"><time>${yr(m.year)}</time>${esc(m.name)}</button>`).join('')}</section>`).join('');
    $('#tourOutlineContent').querySelectorAll('[data-tour-chapter]').forEach(b=>b.onclick=()=>{go(deck.chapters[+b.dataset.tourChapter].sceneStart,false);closeOutline();});
    $('#tourOutlineContent').querySelectorAll('[data-tour-at]').forEach(b=>{b.hidden=+b.dataset.tourAt<0;b.onclick=()=>{go(+b.dataset.tourAt,false);closeOutline();};});
    requestAnimationFrame(()=>go(index,true));
  }
  function exit(){if(!active)return;clock.stop();cancelAnimationFrame(frame);active=false;$('#tourShell').hidden=true;$('#tourControls').hidden=true;$('#tourOutline').hidden=true;onExit();}
  function closeOutline(){$('#tourOutline').hidden=true;$('#tourOutlineBtn').setAttribute('aria-expanded','false');}
  $('#tourThemeSelect').innerHTML=themes.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  document.querySelectorAll('input[name="tourMode"]').forEach(input=>input.onchange=updateSetup);
  for(const selector of ['#tourThemeSelect','#tourStartAt','#tourSetupRate'])$(selector).onchange=updateSetup;
  $('#tourSetupClose').onclick=()=>$('#tourDialog').close();$('#tourStartBtn').onclick=start;
  $('#tourPlay').onclick=toggle;$('#tourPrev').onclick=()=>go(index-1);$('#tourNext').onclick=()=>go(index+1);
  $('#tourSeek').oninput=e=>go(+e.target.value,false);
  $('#tourRate').onchange=e=>{const wasPlaying=clock.playing,fraction=clock.fraction;rate=+e.target.value;clock.start(duration(),advance);clock.pause();clock.remaining=duration()*(1-fraction);if(wasPlaying){clock.resume();cancelAnimationFrame(frame);progress();}controls();};
  $('#tourExitBtn').onclick=exit;$('#tourSettingsBtn').onclick=openSetup;
  $('#tourOutlineBtn').onclick=()=>{pause();const hidden=$('#tourOutline').hidden;$('#tourOutline').hidden=!hidden;$('#tourOutlineBtn').setAttribute('aria-expanded',String(hidden));};$('#tourOutlineClose').onclick=closeOutline;
  $('#tourAutoCamera').onclick=()=>{autoCamera=!autoCamera;controls();if(autoCamera)applyScene(true,true);};
  $('#tourLoop').onclick=()=>{loop=!loop;controls();};
  $('#tourGlobal').onclick=()=>{pause();onCamera('global',scene());$('#tourCameraStatus').textContent='全图观察 · 已暂停';};
  $('#tourRefocus').onclick=()=>{pause();onScene(scene(),{camera:true,forceCamera:true});mapDate(scene());$('#tourCameraStatus').textContent='已回到当前叙事镜头';};
  $('#tourBeforeBtn').onclick=()=>{pause();const s=scene();onScene({...s,year:snapshots[s.compareIndex].year,snapshotIndex:s.compareIndex,compareIndex:null,raw:true},{camera:false});mapDate(s,s.compareIndex);$('#tourBeforeBtn').classList.add('active');$('#tourAfterBtn').classList.remove('active');};
  $('#tourAfterBtn').onclick=()=>{pause();applyScene(false);};
  $('#tourReadDetail').onclick=()=>{const item=byId.get(scene().itemId);exit();onReadDetail(item);};
  $('#tourSource').onclick=pause;
  document.addEventListener('pointerdown',e=>{if(active&&e.target.closest('#map,.map-right-tools,.map-legend'))pause();});
  document.addEventListener('wheel',e=>{if(active&&e.target.closest('#map,.tour-story-card'))pause();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  return {openSetup,exit,pause,toggle,step:delta=>go(index+delta),get active(){return active;},get setupOpen(){return $('#tourDialog').open;},get scene(){return scene();}};
}
