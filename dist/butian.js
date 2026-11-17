const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const butianHash=phase=>'#chapter=butian&phase='+(phase==='before'?'before':'after');
export function readButianHash(hash){const p=new URLSearchParams(hash.replace(/^#/,''));return p.get('chapter')==='butian'?(p.get('phase')==='before'?'before':'after'):null;}

export function createButianChapter({map,world,onEnter,onExit,onRead,getLayers,getOpacity}){
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 const factions=new Map(world.factions.map(f=>[f.id,f]));
 let active=false,phaseId='after',selection='overview',selectedGeography=null,compare=false,timer=null,playing=false,savedView,savedWorkspace,savedCompact=false;
 const groups={politics:L.layerGroup(),cities:L.layerGroup(),events:L.layerGroup(),geography:L.layerGroup()};
 let shapes;
 const phase=()=>world.phases.find(p=>p.id===phaseId);
 const marker=(lng,lat,text,cls,click,pane='butianLabels')=>L.marker([lat,lng],{pane,title:text,keyboard:!!click,interactive:!!click,icon:L.divIcon({className:'bt-marker '+cls,html:`<span>${esc(text)}</span>`,iconSize:[0,0],iconAnchor:[0,0]})}).on('click',()=>click?.());
 const block=(title,copy)=>`<section class="bt-copy"><h3>${esc(title)}</h3><p>${esc(copy)}</p></section>`;
 function syncUI(){
  if(!active)return;
  $('#mapContextYear').textContent='架空篇章 · 补天';$('#mapContextTitle').textContent=phase().name;
  $('#mapContextNote').textContent='以汉末群雄改编 · '+(phaseId==='after'?'江北归火，江南归水':'土族仍据长安与荆州');$('#mapEventsBtn').textContent='阅读水火分荆 →';
  $('#detailPanelKicker').textContent='架空设定 · 不对应公元纪年';$('#detailPanelTitle').textContent=selection==='event'?'水火分荆':selection==='portal'?'昆仑与幽冥':factions.get(selection)?.name||world.name;
  $('#sidebar').classList.add('has-selection');$('#detailQuickNav').hidden=true;
  $('#legendNote').textContent='五行 · 六方势力';$('.legend-head b').textContent='补天 · 五行图例';
  $('#compareBtn').innerHTML='<span>◫</span> 瓜分前旧疆';$('#compareBtn').setAttribute('aria-pressed',String(compare));
  $('#comparisonKey').hidden=phaseId==='before';$('#comparisonKey').textContent='┄ 荆州旧域　▧ 长安土族退守区';
  $('#eraTrack')?.querySelectorAll('[data-era]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
  if($('#butianEntry')){$('#butianEntry').classList.add('active');$('#butianEntry').setAttribute('aria-pressed','true');}
  $('#butianQuickEntry').setAttribute('aria-pressed','true');$('#eraSelect').value='butian';
  $$('#butianTimeline [data-bt-phase]').forEach(b=>{b.classList.toggle('active',b.dataset.btPhase===phaseId);b.setAttribute('aria-pressed',String(b.dataset.btPhase===phaseId));});
  $('#butianPhaseNote').textContent=phase().description;
  $('#butianPlay').textContent=playing?'Ⅱ 暂停变化':'▶ 播放变化';$('#butianPlay').setAttribute('aria-pressed',String(playing));
 }
 function renderPanel(){
  if(!active)return;
  let html='<div class="bt-panel-tag">补天 · 架空篇章</div>';
  const f=factions.get(selection);
  if(f){
   html+=`<button class="back-btn" data-bt-action="overview">← 六方总览</button><div class="bt-faction-title" style="--faction:${f.color}"><i>${esc(f.element)}</i><h2>${esc(f.name)}</h2></div><p class="bt-region">${esc(f.region)}</p>`;
   if(f.id==='earth'&&phaseId==='after')html+='<div class="bt-refuge-callout"><b>土族退守 · 特别标记</b><p>荆州已失，长安区域为土族存续地盘。地图以深色双边和斜线纹理标出。</p></div>';
   html+=block('族群与归属',f.summary)+block('山川与疆域',f.geography)+block('在当前局势中',f.role);
   html+=`<div class="bt-origin"><b>汉末领地原型</b><p>${f.territories.map(esc).join('、')}</p><small>仅作改编对应，不表示架空人物沿用历史人物身份。</small></div>`;
   html+=`<button class="terrain-link" data-bt-fit="${f.id}">在地图上查看 ${esc(f.name)} ↗</button>`;
  }else if(selection==='event'){
   html+='<button class="back-btn" data-bt-action="overview">← 返回补天</button><h2 class="bt-detail-title">水火分荆</h2><p class="bt-region">事件暂名 · 前后格局对照</p>';
   html+=`<p class="detail-copy">${esc(world.event.summary)}</p><div class="bt-stage-switch"><button data-bt-stage="before">查看瓜分前</button><button data-bt-stage="after">查看瓜分后</button></div>`;
   html+=world.event.sequence.map((s,i)=>`<section class="bt-event-step"><span>0${i+1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div></section>`).join('');
   html+='<div class="bt-division-key"><span>江北 → 人族火部</span><span>江南 → 人族水部</span></div>';
   html+=`<button class="terrain-link" data-bt-action="jingzhou">聚焦荆州与长江分界 ↗</button>`+block('待定剧情',world.event.openQuestions);
  }else if(selection==='portal'){
   html+='<button class="back-btn" data-bt-action="overview">← 返回补天</button><h2 class="bt-detail-title">昆仑与幽冥</h2><p class="bt-region">黎族西境 · 金行门户</p>';
   html+=block('幽冥入口',world.portal.note)+block('通道关系','黎族边境 → 昆仑山麓门户 → 幽冥鬼域。图上的紫色虚线表示通达异界，不表示一条已知的现实道路。');
   html+='<button class="terrain-link" data-bt-action="portal-map">查看昆仑入口 ↗</button>'+block('暂定位置','入口、边境通道与主角出生地为创作示意位置，可以随世界设定继续调整。');
  }else if(selection==='geography'&&selectedGeography){
   html+='<button class="back-btn" data-bt-action="overview">← 返回补天</button>'+block(selectedGeography.name,selectedGeography.description);
  }else if(selection.startsWith('place:')){
   const p=world.places.find(p=>p.id===selection.slice(6));
   html+='<button class="back-btn" data-bt-action="overview">← 返回补天</button>'+block(p.name,p.note);
  }else{
   html+=`<h2 class="bt-detail-title">补天</h2><p class="bt-region">${esc(world.subtitle)}</p><p class="detail-copy">${esc(world.premise)}</p><div class="bt-faction-list">`;
   html+=world.factions.map(f=>`<button data-bt-faction="${f.id}" style="--faction:${f.color}"><i>${esc(f.element)}</i><div><strong>${esc(f.name)}</strong><small>${esc(f.region)}</small></div><span>↗</span></button>`).join('')+'</div>';
   html+='<button class="terrain-link" data-bt-action="event"><b>关键转折 · 水火分荆 →</b>查看前因、疆域变化与土族退守</button><button class="terrain-link" data-bt-action="portal"><b>昆仑 · 幽冥入口 →</b>黎族西境通向另一重世界</button>';
   html+=`<section class="bt-origin"><b>架空与历史分开阅读</b><p>${esc(world.scopeNote)}</p>${world.notes.map(n=>`<p>${esc(n)}</p>`).join('')}</section>`;
  }
  $('#panelContent').innerHTML=html;$('#panelContent').scrollTop=0;
  bindPanel();syncUI();
 }
 function bindPanel(){
  $$('#panelContent [data-bt-faction]').forEach(b=>b.onclick=()=>read(b.dataset.btFaction));
  $$('#panelContent [data-bt-stage]').forEach(b=>b.onclick=()=>setPhase(b.dataset.btStage));
  $$('#panelContent [data-bt-fit]').forEach(b=>b.onclick=()=>fitFaction(b.dataset.btFit));
  $$('#panelContent [data-bt-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.btAction;if(a==='jingzhou')fitJingzhou();else if(a==='portal-map')fitPortal();else read(a);});
 }
 function read(id='overview'){stop();selection=id;renderPanel();onRead();}
 function draw(){
  for(const group of Object.values(groups))group.clearLayers();
  shapes=L.geoJSON(phase().geojson,{pane:'butianPolities',style:f=>({color:f.properties.color,weight:f.properties.refuge?3:1.6,opacity:.95,fillColor:f.properties.color,fillOpacity:getOpacity(),className:f.properties.refuge?'bt-refuge-shape':''}),onEachFeature:(f,l)=>{l.bindTooltip(`${esc(f.properties.name)} · ${esc(f.properties.element)}${f.properties.refuge?' · 长安退守':''}`,{sticky:true});l.on('click',()=>read(f.properties.id));}}).addTo(groups.politics);
  for(const f of world.factions)for(const a of f.anchors){
   if(phaseId==='after'&&f.id==='earth'&&a.text.includes('荆州'))continue;
   const text=phaseId==='after'&&f.id==='earth'?'土族 · 长安退守':a.text;
   marker(a.lng,a.lat,text,'bt-faction-label bt-'+f.id,()=>read(f.id)).addTo(groups.politics);
  }
  if(phaseId==='after'){
   const refuge=phase().geojson.features.find(f=>f.properties.id==='earth');
   L.geoJSON(refuge,{pane:'butianBorders',interactive:false,style:{color:'#624425',weight:5,opacity:.7,fill:false}}).addTo(groups.politics);
   L.geoJSON(refuge,{pane:'butianBorders',interactive:false,style:{color:'#fff2cb',weight:1.3,dashArray:'3 5',fill:false}}).addTo(groups.politics);
   L.geoJSON(world.oldJingzhou,{pane:'butianBorders',interactive:false,style:{color:'#785a3a',weight:2.1,dashArray:'7 5',fill:false,opacity:.95}}).addTo(groups.events);
   marker(111.55,27.2,'荆州旧域','bt-old-label',()=>read('event')).addTo(groups.events);
   marker(113.1,31.1,'江北归火','bt-side-label bt-human-fire',()=>read('event')).addTo(groups.events);
   marker(112.2,28.8,'江南归水','bt-side-label bt-human-water',()=>read('event')).addTo(groups.events);
   L.geoJSON(world.division.river,{pane:'butianBorders',interactive:false,style:{color:'#fff7db',weight:6.5,opacity:.95}}).addTo(groups.events);
   L.geoJSON(world.division.river,{pane:'butianBorders',style:{color:'#3586ac',weight:3,opacity:1},onEachFeature:(f,l)=>{l.bindTooltip('长江 · 江北归火，江南归水');l.on('click',()=>read('event'));}}).addTo(groups.events);
   L.polyline([[30.7,111.6],[32.1,110.4],[33.4,109.5],[34.27,108.94]],{pane:'butianBorders',color:'#8a6036',weight:2,dashArray:'4 7',opacity:.8}).bindTooltip('土族退守长安 · 方向示意，非行军路线').addTo(groups.events);
  }
  if(compare)L.geoJSON(world.phases[0].geojson,{pane:'butianBorders',interactive:false,style:{color:'#67485c',weight:1.6,dashArray:'3 4',fill:false,opacity:.8}}).addTo(groups.events);
  for(const p of world.places){
   const story=p.kind==='story';
   L.circleMarker([p.lat,p.lng],{pane:'butianPlaces',radius:p.kind==='capital'?5:story?5:3,color:story?'#9d3f2d':'#5c4b35',weight:1.3,fillColor:story?'#f7dc83':'#fff9e6',fillOpacity:1}).on('click',()=>read('place:'+p.id)).bindTooltip(esc(p.name)).addTo(story?groups.events:groups.cities);
   if(p.kind==='capital'||story||map.getZoom()>=4.3)marker(p.lng,p.lat,(story?'★ ':'')+p.name,'bt-place-label'+(story?' bt-birthplace':''),()=>read('place:'+p.id),'butianPlaces').addTo(story?groups.events:groups.cities);
  }
  const portal=world.portal,[lng,lat]=portal.realmAnchor;
  L.circleMarker([lat,lng],{pane:'butianBorders',radius:24,color:'#766183',dashArray:'5 5',weight:1.5,fillColor:'#65516f',fillOpacity:.12}).on('click',()=>read('portal')).addTo(groups.geography);
  L.polyline([[portal.lat,portal.lng],[lat,lng]],{pane:'butianBorders',color:'#796389',weight:2.1,dashArray:'5 6'}).on('click',()=>read('portal')).addTo(groups.geography);
  marker(lng,lat,'幽冥鬼域 · 异界','bt-realm-label',()=>read('portal')).addTo(groups.geography);
  marker(portal.lng,portal.lat,'◈ 昆仑 · 幽冥入口','bt-portal-label',()=>read('portal')).addTo(groups.geography);
  $('#polityLegend').innerHTML=world.factions.map(f=>`<button data-bt-legend="${f.id}"><i class="swatch" style="background:${f.color}"></i>${esc(f.element)} · ${esc(f.name)}</button>`).join('');
  $$('[data-bt-legend]').forEach(b=>b.onclick=()=>read(b.dataset.btLegend));
  syncLayers();syncUI();
 }
 function syncLayers(){
  const layers=getLayers();for(const [name,group] of Object.entries(groups)){const show=active&&layers[name];if(show&&!map.hasLayer(group))map.addLayer(group);if(!show&&map.hasLayer(group))map.removeLayer(group);}
  if(shapes)shapes.setStyle({fillOpacity:getOpacity()});
  if(active)$('#mapModeLabel').textContent='补天 · 架空五行版图';
 }
 function fit(bounds,maxZoom=5.8){map.fitBounds(bounds,{paddingTopLeft:[35,125],paddingBottomRight:[50,50],maxZoom,animate:false});}
 function fitAll(){fit([[18,world.portal.realmAnchor[0]-1],[44.7,127]],4.7);}
 function fitFaction(id){const feature=phase().geojson.features.find(f=>f.properties.id===id);fit(L.geoJSON(feature).getBounds());}
 function fitJingzhou(){stop();fit(L.geoJSON(world.oldJingzhou).getBounds(),6);}
 function fitPortal(){stop();const p=world.portal;fit([[p.lat-3,p.realmAnchor[0]-1],[p.lat+3,p.lng+3]],5.4);}
 function setPhase(id,{autoplay=false}={}){if(!autoplay)stop();phaseId=id==='before'?'before':'after';history.replaceState(null,'',butianHash(phaseId));draw();renderPanel();}
 function enter(id='after'){
  if(!active){savedView={center:map.getCenter(),zoom:map.getZoom()};savedWorkspace=$('.workspace').className;savedCompact=document.body.classList.contains('timeline-minimized');active=true;document.body.classList.add('butian-mode');document.body.classList.remove('timeline-minimized');$('#butianTimeline').hidden=false;document.title='补天 · 山河纪';$('.map-area').setAttribute('aria-label','补天架空交互地图');for(const layer of ['regions','seats'])$('[data-layer="'+layer+'"]').disabled=true;const eventLabel=$('[data-layer="events"]').closest('label');eventLabel.querySelector('b').textContent='架空事件与旧域';eventLabel.querySelector('small').textContent='荆州分界、退守方向与故事节点';onEnter();}
  selection='overview';setPhase(id);requestAnimationFrame(()=>{map.invalidateSize({pan:false});fitAll();$('#eraTrack').scrollLeft=$('#eraTrack').scrollWidth;});
 }
 function exit({redraw=true}={}){
  if(!active)return;stop();active=false;for(const group of Object.values(groups))map.removeLayer(group);document.body.classList.remove('butian-mode');document.body.classList.toggle('timeline-minimized',savedCompact);$('#butianTimeline').hidden=true;document.title='山河纪 · 中国历史地图';$('.map-area').setAttribute('aria-label','交互历史地图');for(const layer of ['regions','seats'])$('[data-layer="'+layer+'"]').disabled=false;const eventLabel=$('[data-layer="events"]').closest('label');eventLabel.querySelector('b').textContent='历史战役';eventLabel.querySelector('small').textContent='与当前切片对应的事件';$('.workspace').className=savedWorkspace;
  $('#butianEntry')?.classList.remove('active');$('#butianEntry')?.setAttribute('aria-pressed','false');$('#butianQuickEntry').setAttribute('aria-pressed','false');$('.legend-head b').textContent='版图图例';$('#compareBtn').innerHTML='<span>◫</span> 对照上一期';
  onExit({redraw});if(savedView){map.invalidateSize({pan:false});map.setView(savedView.center,savedView.zoom,{animate:false});}
 }
 function stop(){clearTimeout(timer);timer=null;playing=false;if(active)syncUI();}
 function play(){if(playing){stop();return;}setPhase('before');selection='event';renderPanel();fitAll();playing=true;syncUI();timer=setTimeout(()=>{if(!active)return;setPhase('after',{autoplay:true});playing=false;timer=null;syncUI();},9000);}
 function search(query){const q=query.trim().toLowerCase(),hits=[...world.factions.map(f=>({id:f.id,name:f.name,note:f.element+' · '+f.region})),...world.places.map(p=>({id:'place:'+p.id,name:p.name,note:p.note})),{id:'event',name:'水火分荆',note:'荆州旧域与长安退守'},{id:'portal',name:'昆仑 · 幽冥入口',note:'黎族 · 幽冥鬼域'}].filter(x=>(x.name+x.note).toLowerCase().includes(q));
  $('#searchResults').innerHTML=hits.map((h,i)=>`<li><button data-bt-hit="${i}"><span>${esc(h.name)}</span><small>${esc(h.note.slice(0,18))}</small></button></li>`).join('')||'<li class="empty">本篇章未收录此名称。</li>';
  $$('[data-bt-hit]').forEach(b=>b.onclick=()=>{$('#searchBox').hidden=true;read(hits[+b.dataset.btHit].id);});
 }
 for(const [pane,z] of Object.entries({butianPolities:312,butianBorders:345,butianLabels:395,butianPlaces:425})){map.createPane(pane).style.zIndex=z;}
 $$('#butianTimeline [data-bt-phase]').forEach(b=>b.onclick=()=>setPhase(b.dataset.btPhase));
 $('#butianEventBtn').onclick=()=>read('event');$('#butianExit').onclick=()=>exit();$('#butianPlay').onclick=play;$('#butianFullMap').onclick=fitAll;
 map.on('zoomend',()=>{if(active)draw();});map.on('dragstart',stop);map.on('zoomstart',()=>{if(active)stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 return {get active(){return active},get phase(){return phaseId},enter,exit,read,readGeography(f){selectedGeography=f;read('geography');},renderPanel,syncUI,syncLayers,setPhase,play,pause:stop,search,fitAll,toggleCompare(){compare=!compare;draw();},step(delta){setPhase(delta<0?'before':'after');}};
}
