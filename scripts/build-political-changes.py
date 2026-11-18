"""Compile political transfers into complete, disjoint map frames (Shapely 2)."""
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path

from shapely import make_valid, normalize, union_all
from shapely.geometry import GeometryCollection, mapping, shape


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'dist' / 'data'


def read(path):
    return json.loads(path.read_text())


def polygonal(geometry):
    """Discard zero-area seams created by overlaying traced coastlines."""
    if geometry.geom_type == 'Polygon':
        return geometry
    if geometry.is_empty:
        return GeometryCollection()
    if geometry.geom_type in ('MultiPolygon', 'GeometryCollection'):
        return union_all([polygonal(part) for part in geometry.geoms])
    return GeometryCollection()


def compile_catalog(atlas, book):
    snapshots = {s['year']: s for s in atlas['snapshots']}
    atlas_shapes = atlas['geometries']
    additions = {}
    known_shapes = {}
    source_ids = {source['id'] for source in book['sources']}

    def original(feature):
        raw = atlas_shapes[feature['geometryRef']]
        geo = shape(raw)
        if geo.is_valid:
            known_shapes[normalize(geo).wkb] = feature['geometryRef']
            return geo
        return polygonal(make_valid(geo))

    def reference(geometry):
        assert not geometry.is_empty and geometry.is_valid
        key = normalize(geometry).wkb
        if key not in known_shapes:
            ref = 'ev-' + sha256(key).hexdigest()[:16]
            additions[ref] = mapping(geometry)
            known_shapes[key] = ref
        return known_shapes[key]

    def compile_chapter(chapter):
        base = snapshots[chapter['baseYear']]
        features = base['geojson']['features']
        records = {f['properties']['name']: f for f in features}
        colors = {name: f['properties']['color'] for name, f in records.items()}
        colors.update(chapter.get('colors', {}))
        partitions = {p['owner']: p for p in chapter.get('partitions', [])}
        styles = chapter.get('regionStyles', {})

        # Resolve tiny tracing overlaps in the baseline; smaller polities keep
        # their outlined land where a neighbouring larger shape overlaps it.
        parcels = {}
        owners = {}
        assigned = GeometryCollection()
        for name, geo in sorted(((n, original(f)) for n, f in records.items()),
                                key=lambda item: item[1].area):
            remaining = polygonal(geo.difference(assigned)) if geo.intersects(assigned) else geo
            assigned = union_all([assigned, remaining])
            owner = chapter.get('initialOwners', {}).get(name, name)
            split = partitions.get(name)
            if split:
                for child in split['children']:
                    later = snapshots[child['year']]['geojson']['features']
                    source = next(f for f in later if f['properties']['name'] == child['name'])
                    kept = polygonal(remaining.intersection(original(source)))
                    assert not kept.is_empty
                    parcels[child['parcel']] = kept
                    owners[child['parcel']] = owner
                    remaining = polygonal(remaining.difference(kept))
                name = split['remainder']
            parcels[name] = remaining
            owners[name] = owner

        props = {}
        def map_asset(name, geo):
            ref = reference(geo)
            key = name + '/' + ref
            if key not in props:
                point = max(geo.geoms, key=lambda item: item.area).representative_point() if geo.geom_type == 'MultiPolygon' else geo.representative_point()
                props[key] = {'name':name, 'color':colors[name], 'ref':ref,
                              'label':[round(point.x, 3), round(point.y, 3)], **styles.get(name, {})}
            return key

        steps = []
        previous_year = chapter['startYear']
        for entry in chapter['steps']:
            assert previous_year <= entry['year'] <= chapter['endYear'] and entry['sourceIds']
            assert set(entry['sourceIds']) <= source_ids
            previous_year = entry['year']
            changes = []
            for parcel, new_owner in entry['transfers']:
                old_owner = owners[parcel]
                assert old_owner != new_owner
                changes.append({'from':old_owner, 'to':new_owner, 'parcel':parcel,
                                'feature':map_asset(new_owner, parcels[parcel])})
                owners[parcel] = new_owner
            groups = defaultdict(list)
            for parcel, owner in owners.items():
                groups[owner].append(parcels[parcel])
            areas = {owner: polygonal(union_all(bits)) if len(bits) > 1 else bits[0]
                     for owner, bits in groups.items()}
            # Every transfer conserves the starting land and no location has two owners.
            assert sum(g.area for g in areas.values()) - assigned.area < 1e-6
            assert assigned.symmetric_difference(union_all(list(areas.values()))).area < 1e-6
            frame = [map_asset(name, geo) for name, geo in areas.items()]
            step = {k:v for k,v in entry.items() if k != 'transfers'}
            step.update(frame=frame, changes=changes)
            steps.append(step)

        keys = ['id','title','startYear','endYear','description','sourceIds']
        return {**{k:chapter[k] for k in keys}, 'baseYear':base['year'],
                'sourceSnapshotId':base['id'], 'features':props, 'steps':steps}

    result = [compile_chapter(chapter) for chapter in book['chapters']]
    return {'version':1,'sources':book['sources'],'geometries':additions,'chapters':result}


if __name__ == '__main__':
    catalog = compile_catalog(read(DATA / 'snapshots.json'), read(ROOT / 'content/political-changes.json'))
    out = DATA / 'political-changes.json'
    out.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))+'\n')
    print(f"{len(catalog['chapters'])} chapters, {sum(len(c['steps']) for c in catalog['chapters'])} phases, {out.stat().st_size:,} bytes")
