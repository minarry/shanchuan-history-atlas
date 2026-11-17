// Cartographic symbols describe landform types, never an inferred elevation.
export const landformTypes={
 mountain:{label:'山脉',symbol:'▲',priority:3,height:30,font:16,spacing:3},
 plateau:{label:'高原',symbol:'▰',priority:2,height:30,font:15,spacing:3},
 plain:{label:'平原',symbol:'≋',priority:2,height:28,font:13,spacing:2},
 basin:{label:'盆地',symbol:'◡',priority:2,height:28,font:13,spacing:2},
 corridor:{label:'通道',symbol:'↔',priority:4,height:26,font:12,spacing:1},
 river:{label:'河流',symbol:'≈',priority:1,height:26,font:13,spacing:2},
 pass:{label:'关隘',symbol:'',priority:5,height:26,font:11,spacing:0}
};
export const passSymbol='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V6h4V3h3v3h4V3h3v3h4v15h-7v-7h-4v7Z"/><path d="M3 10h18"/></svg>';
export function riverStyle(rank=7,zoom=4){
 const major=rank<5,scale=Math.max(.8,Math.min(1.65,1+(zoom-4)*.16));
 return {color:major?'#317f9b':'#5599ae',weight:(major?2.1:rank<7?1.2:.65)*scale,opacity:major?.96:zoom>=5?.74:.5,lineCap:'round',lineJoin:'round'};
}
export function geographyLabels(features,project,zoom,viewport,selectedId){
 const occupied=[],result=[];
 const candidates=features.filter(f=>zoom>=f.minZoom-.8||f.id===selectedId).sort((a,b)=>(b.id===selectedId)-(a.id===selectedId)||(landformTypes[a.kind]?.priority??9)-(landformTypes[b.kind]?.priority??9));
 for(const feature of candidates){
  const type=landformTypes[feature.kind]||landformTypes.mountain;
  const width=feature.name.length*(type.font+type.spacing)+30,height=type.height;
  const point=project(feature),rect={x:point.x-width/2,y:point.y-height/2,width,height};
  if(rect.x+width<0||rect.x>viewport.x||rect.y+height<0||rect.y>viewport.y)continue;
  const collision=occupied.some(r=>rect.x<r.x+r.width+8&&rect.x+width+8>r.x&&rect.y<r.y+r.height+5&&rect.y+height+5>r.y);
  if(collision&&feature.id!==selectedId)continue;
  occupied.push(rect);result.push({feature,width,height});
 }
 return result;
}
