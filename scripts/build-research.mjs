import {MAX_YEAR} from '../dist/history-domain.js';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../content/'+name,import.meta.url)));
const parts=['ancient.json','medieval.json','modern.json','expansion-antiquity.json','expansion-middle.json','expansion-modern.json'].map(read);
const events=parts.flatMap(p=>p.events).filter(e=>e.year<=MAX_YEAR).sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));
const milestones=parts.flatMap(p=>p.milestones||[]).filter(e=>e.year<=MAX_YEAR).sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));
// Known order within a year; unspecified same-year entries remain reading order.
const withinYear={'battle-11':10,'ancient-xiangfan':20,'battle-ming-north':20,'moment-ming-founded':10};
for(const e of [...events,...milestones]){if(withinYear[e.id])e.sequence=withinYear[e.id];if(e.name.includes('明朝建立')||e.name.includes('明朝建国'))e.sequence=10;}
const sources=parts.flatMap(p=>p.sources);
// Studies extend existing records without duplicating chronology nodes.
for(const patch of read('battle-studies.json').patches){
 const event=events.find(e=>e.id===patch.id);
 if(!event)throw Error('Study refers to missing battle: '+patch.id);
 Object.assign(event,patch);
}
const bibliography=[
 {id:'survey-lu-qin',title:'吕思勉《吕著中国通史》第二十三章：春秋战国的竞争和秦国的统一',url:'https://szzy.7lue.cn/read/40cc93f2ae454ff0e51070b346bfb9ea/62709f47d962040d431b71b052d57f8e.md',note:'选读：统一并非秦从始至终最强的必然结果，改革、各国组织和联盟变化需一并观察。旧著的民族观与价值判断不能直接沿用。'},
 {id:'survey-lu-tang',title:'吕思勉《吕著中国通史》第三十九章：唐朝的中衰',url:'https://szzy.7lue.cn/read/40cc93f2ae454ff0e51070b346bfb9ea/837484fc73c80322062e9c70b413d2f3.md',note:'选读：从边疆军事组织与中央权力关系理解安史之乱，避免仅用个人品行解释政治转折。'},
 {id:'survey-bai-feishui',title:'白寿彝主编《中国通史》第五卷：前秦的南征、淝水之战',url:'https://szzy.7lue.cn/read/dbcfcd4e6bd9523b6fb82ccb7aeca509/f5918efce83b353b7b8c729ae07431e7.md',note:'选读：前秦内部整合、东晋政治协作与北府兵组织。史书所记兵力不作为精确统计展示。'},
 {id:'survey-atlas',title:'谭其骧与《中国历史地图集》· 复旦大学介绍',url:'https://news.fudan.edu.cn/2021/0524/c1247a108976/page.htm',note:'后续校勘书目。未扫描或再分发该地图集，也未据此新增精确边界。'}
];
bibliography.push(...sources.filter(s=>['expmod-survey-zhifeng','expmod-longtan-history'].includes(s.id)));
sources.push(...bibliography.filter(b=>!sources.some(s=>s.id===b.id)));
const surveyNotes={
 '长平之战':{source:'survey-lu-qin',text:'结合《吕著中国通史》第二十三章阅读：秦的优势经过改革与多轮竞争形成。长平需要放在上党争夺和各国关系中理解，不能倒推为秦从战国开始便注定统一。'},
 '淝水之战':{source:'survey-bai-feishui',text:'《中国通史》第五卷把前秦的内部整合、东晋桓谢之间的协作和北府兵组织放进同一解释框架。河流与渡河秩序是战场条件；政治凝聚和军事组织决定这些条件能否转化为优势。'},
 '潼关失守':{source:'survey-lu-tang',text:'结合《吕著中国通史》第三十九章阅读：唐朝长期加强边军，与中央和地方军事力量的变化相联系。关险之外，还要追问朝廷指挥、军队来源和边疆调兵的成本。'}
};
for(const e of events){const note=surveyNotes[e.name];if(note){e.historiography=note.text;e.sourceRefs.push(note.source);}}
const themeSpecs=[
 ['qin','秦为何能统一？','变法、上党与多国联盟怎样改变力量对比？','从晋阳与魏国的优势开始，再看秦在伊阙、长平之后的进展与邯郸受挫。统一需要观察国家动员、各国合作与长期消耗。',['晋阳','商鞅','伊阙','长平','邯郸','秦统一']],
 ['chu-han','楚汉之间的粮道与联盟','为什么占领都城，并不等于赢得天下？','巨鹿之后的军事威望、荥阳成皋的运输争夺、河北与齐地的侧翼战事，共同塑造最后的垓下决战。',['巨鹿','彭城','荥阳','井陉','潍水','垓下']],
 ['three-kingdoms','三国：荆州与汉中','一条长江，如何同时连接联盟与冲突？','串读官渡到夷陵，再看街亭和魏灭蜀。注意孙刘之间的合作与竞争，以及秦岭通道对北伐补给的约束。',['官渡','赤壁','汉中','襄樊之战','夷陵','街亭','魏灭蜀']],
 ['north-south','长江之前，还有淮河','南北统一为何需要多条战线配合？','从晋灭吴、淝水到隋灭陈，比较上游根据地、淮河屏障与江面运输。江南的政治组织和财政同样重要。',['晋灭吴','淝水','隋灭陈']],
 ['tang','唐帝国的边疆与中枢','边军为何从守边力量变成朝廷危机？','把中亚、青海与河北战场放在同一张图上；怛罗斯不能单独解释唐退出中亚，安史之乱和吐蕃扩张须共同观察。',['东突厥','大非川','怛罗斯','安史','潼关','睢阳','香积寺','两税']],
 ['song-yuan','宋辽金元：关隘、河流与和议','战场胜利如何转化为和局，或新的进攻通道？','对照澶州、靖康、郾城、采石、钓鱼城、襄樊与崖山，观察政治目标、海陆运输与城防体系如何相互作用。',['澶州','澶渊','靖康','郾城','绍兴','采石','钓鱼城','襄阳、樊城','崖山']],
 ['liaoxi','辽西走廊与明清易代','坚城为什么无法独自挽救一个政权？','从萨尔浒的分进合击到宁远、松锦和山海关，结合财政压力、关内局势与吴三桂的政治选择。',['萨尔浒','宁远','松锦','山海关']],
 ['modern','晚清至北伐的交通网络','港口、运河与铁路，怎样重塑战争空间？','从镇江漕运、黄海海战到武昌起义与北伐，比较港口、内河和铁路节点如何连接战场与政治变化。',['镇江','黄海','武昌','汀泗桥','龙潭']],
 ['northern-reordering','北方重组：从淝水到隋唐之前','统一战争如何与迁都、边镇和政权分裂相连？','把前秦失败、北魏改革与东西对峙中的山河攻防连起来看。军事胜利、制度整合和长期统治需要分别检验。',['淝水','参合陂','后秦','孝文','六镇','东西魏','邙山','玉壁','北周灭齐','北周灭北齐']],
 ['capital-and-waterways','五代至明：都城与运输网络','为何取得一座都城，还要争夺周围的水路与腹地？','从五代河上攻防、后周淮南经营到宋灭北汉、南宋都城和明迁北京，比较政治中心需要什么样的交通支撑。',['胡柳陂','后周','北汉','临安','永乐']],
 ['warlord-railways','京畿与长江：军阀的交通与联盟','铁路加快了调兵，为什么仍解决不了统治整合？','按直皖、两次直奉与龙潭串读，区分战线突破、联盟转向、首都易手和战后政治安排。',['直皖战争','第一次直奉','第二次直奉','龙潭']]
];
const all=[...events,...milestones];
const themeExtraIds={'northern-reordering':['expand-luoyang-494','expand-wei-split']};
const themes=themeSpecs.map(([id,name,question,description,patterns])=>({id,name,question,description,ids:all.filter(e=>patterns.some(p=>e.name.includes(p))||themeExtraIds[id]?.includes(e.id)).sort((a,b)=>a.year-b.year||(a.sequence??50)-(b.sequence??50)||a.id.localeCompare(b.id)).map(e=>e.id)}));
const research={version:'3.5',updated:'2026-11-17',methodology:'通史选读组织问题；条目以所列原典、机构专题核对。政治与地理段落为综合解释；近似坐标用于教学，不是测绘成果。',milestones,sources,bibliography,themes};
writeFileSync(new URL('../dist/data/events.json',import.meta.url),JSON.stringify(events,null,2));
writeFileSync(new URL('../dist/data/research.json',import.meta.url),JSON.stringify(research,null,2));
// Correct three inherited period labels; retain original geometry and provenance.
const snapshotsPath=new URL('../dist/data/snapshots.json',import.meta.url);
const atlas=JSON.parse(readFileSync(snapshotsPath));
atlas.snapshots=atlas.snapshots.filter(s=>s.year<=MAX_YEAR);
const republicanTitles={"1912": "民国初年", "1916": "北洋军阀割据", "1920": "直皖与直奉争衡", "1924": "军阀多方对峙", "1926": "北伐初期", "1927": "北伐与宁汉分立", "1928": "北伐后各方格局"};
for(const s of atlas.snapshots){
 if(s.endYear)s.endYear=Math.min(s.endYear,MAX_YEAR);
 if(republicanTitles[s.year])s.name=republicanTitles[s.year];
 if(s.year===MAX_YEAR){s.subtitle='1928 · '+s.subtitle.split(' · ').at(-1);s.description='本图保留原数据1928—1930年的概括范围，以1928年作为本项目浏览终点。北伐后的中央政府与各地军事势力仍须分层观察；这不是1928年某一天的精确控制线。';}
 if(s.id==='s_xihan_d'){s.year=9;s.name='新 · 王莽改制';s.group='新与更始';s.description='公元9年王莽建立新朝，改革与战争、灾荒共同加剧统治危机。政治面沿用原数据8—22年的时期概括，校正展示起年不表示重新考订全部边界。';s.subtitle='9—22 · 新朝时期示意；原图层分期起于8年';}
 if(s.id==='s_xihan_e'){s.name='更始与群雄';s.group='新与更始';s.description='新朝覆亡前后，更始政权、赤眉军和地方势力争夺控制权。此图概括23—24年的过渡格局，部分势力名称是后续发展的回顾性标记，不表示同年均已正式建国。';}
 if(s.id==='s_sanguo_c'){s.name='西晋与孙吴';s.group='晋吴对峙';s.description='司马炎于265年代魏建晋，蜀汉已经灭亡，晋与孙吴继续对峙。晋控制四川后具备沿长江上游进攻的条件，但统一仍需军政准备。';}
}
atlas.snapshots.sort((a,b)=>a.year-b.year);writeFileSync(snapshotsPath,JSON.stringify(atlas));
console.log(JSON.stringify({battles:events.length,milestones:milestones.length,sources:sources.length,geographicNodes:events.reduce((n,e)=>n+e.geoFactors.length,0),themes:themes.length}));
