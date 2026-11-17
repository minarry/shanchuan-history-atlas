"""Build an explicitly fictional chapter from existing historical geometry.
Requires Shapely 2.x. No geographic bounds are invented for the otherworld.
"""
import json
from pathlib import Path
from shapely.geometry import shape, mapping, Polygon, LineString, Point
from shapely.ops import unary_union, nearest_points
from shapely import make_valid
ROOT=Path(__file__).resolve().parent.parent
read=lambda p:json.loads((ROOT/p).read_text())
world=read('content/butian.json');atlas=read('dist/data/snapshots.json')
base=next(s for s in atlas['snapshots'] if s['id']==world['baseSnapshotId'])
def polygonal(g):
 g=make_valid(g)
 if g.geom_type=='GeometryCollection':g=unary_union([p for p in g.geoms if p.geom_type in ('Polygon','MultiPolygon')])
 assert g.geom_type in ('Polygon','MultiPolygon') and not g.is_empty
 return g
territories={f['properties']['name']:polygonal(shape(atlas['geometries'][f['geometryRef']])) for f in base['geojson']['features']}
rivers=read('dist/data/rivers.geojson')['features']
parts=[c for f in rivers if f['properties']['name'] in ('Chang Jiang','Yangtze') for c in f['geometry']['coordinates'] if len(c)>2]
# Join the four continuous main-stem pieces west to east; tiny source gaps are bridged.
parts.sort(key=lambda c:min(p[0] for p in c));line=[]
for c in parts:
 if c[0][0]>c[-1][0]:c=list(reversed(c))
 if line:assert Point(line[-1]).distance(Point(c[0]))<.03,'Unexpected main-stem gap'
 line.extend(c)
river=LineString(line);assert river.is_simple
old=territories['刘表（荆州）']
north_mask=polygonal(Polygon([[80,line[0][1]],*line,[135,line[-1][1]],[135,65],[80,65],[80,line[0][1]]]))
north=polygonal(old.intersection(north_mask));south=polygonal(old.difference(north_mask))
assert north.intersection(south).area<1e-10
assert unary_union([north,south]).symmetric_difference(old).area<1e-9
assert north.area>0 and south.area>0
# Keep stable faction IDs and unchanged non-participants across both phases.
territories['马腾（凉州）']=polygonal(territories['马腾（凉州）'].union(Polygon(world['frontierExtension']['coordinates'])))
before={f['id']:polygonal(unary_union([territories[t] for t in f['territories']])) for f in world['factions']}
after={**before,'earth':territories['董卓（长安）'],'human-fire':polygonal(before['human-fire'].union(north)),'human-water':polygonal(before['human-water'].union(south))}
# The inherited schematic polities can overlap. Resolve overlaps consistently,
# giving exact Jingzhou and the Chang'an refuge priority over nearby source faces.
def partition(groups):
 remaining=unary_union(list(groups.values()));result={}
 for key in ['earth','li','yao','ling','human-fire','human-water']:
  result[key]=polygonal(groups[key].intersection(remaining));remaining=remaining.difference(result[key])
 return result
# Claim the two halves first in the after map so the river is the shared boundary.
others={k:g.difference(old) for k,g in after.items() if k not in ('human-fire','human-water')}
after={**after,**others};before=partition(before)
after=partition(after)
# Re-assert exact ownership of the old domain after normalizing inherited overlaps.
for key in after:after[key]=after[key].difference(old)
after['human-fire']=polygonal(after['human-fire'].union(north));after['human-water']=polygonal(after['human-water'].union(south))
def feature(fid,g,**props):return {'type':'Feature','properties':{'id':fid,**props},'geometry':mapping(g)}
for phase,groups in zip(world['phases'],[before,after]):
 phase['geojson']={'type':'FeatureCollection','features':[feature(f['id'],groups[f['id']],name=f['name'],element=f['element'],color=f['color'],refuge=phase['id']=='after' and f['id']=='earth') for f in world['factions']]}
world['oldJingzhou']=feature('old-jingzhou',old,name='荆州旧域')
world['division']={'north':feature('jingzhou-north',north,owner='human-fire'),'south':feature('jingzhou-south',south,owner='human-water'),'river':feature('yangtze-division',river.intersection(old),name='长江 · 水火分界')}
gate=nearest_points(before['li'].boundary,Point(world['portal']['near']))[0]
world['portal']['lng']=round(gate.x,5);world['portal']['lat']=round(gate.y,5)
world['portal']['realmAnchor']=[round(gate.x-2.3,5),round(gate.y-.5,5)]
world['base']={'snapshotId':base['id'],'year':base['year'],'subtitle':base['subtitle'],'license':'历史原型几何沿用 Jiangshan Atlas GPL-3.0；架空改编由本项目编写。'}
world['geometryChecks']={'jingzhouPartitionComplete':True,'divisionOverlaps':False,'riverPieces':len(parts)}
assert unary_union(list(before.values())).symmetric_difference(unary_union(list(after.values()))).area<1e-8
for key in ['li','yao','ling']:assert before[key].symmetric_difference(after[key]).area<1e-8
for groups in [before,after]:
 for k,g in groups.items():assert g.is_valid and not g.is_empty,k
 for i,k in enumerate(groups):
  for j in list(groups)[i+1:]:assert groups[k].intersection(groups[j]).area<1e-8,(k,j)
(ROOT/'dist/data/butian.json').write_text(json.dumps(world,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'phases':2,'factions':len(before),'gate':[gate.x,gate.y],'jingzhouAreas':[north.area,south.area],'outputBytes':(ROOT/'dist/data/butian.json').stat().st_size}))
