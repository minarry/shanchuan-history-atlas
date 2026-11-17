import {MIN_YEAR,MAX_YEAR} from '../dist/history-domain.js';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=n=>JSON.parse(readFileSync(new URL('../dist/data/'+n,import.meta.url)));
const data=read('snapshots.json'),ev=read('events.json'),ct=read('cities.json'),geo=read('geography.json');
const events=ev.events||ev,cities=ct.cities||ct;for(const s of data.snapshots)for(const fc of [s.geojson,s.regions])for(const f of fc?.features||[])if(f.geometryRef)f.geometry=data.geometries[f.geometryRef];
assert(data.snapshots.length>=25,'Historical coverage requires at least 25 snapshots');
let year=-10000;
for(const s of data.snapshots){assert(s.year>year,'Dates must be strictly increasing');assert(s.year!==0);year=s.year;assert(s.name&&s.description&&s.geojson.type==='FeatureCollection');assert(s.geojson.features.length>0);for(const f of s.geojson.features){assert(f.properties.name);assert(['Polygon','MultiPolygon'].includes(f.geometry.type));const walk=a=>{if(typeof a[0]==='number'){assert(Number.isFinite(a[0])&&Number.isFinite(a[1]));assert(a[0]>=-180&&a[0]<=180&&a[1]>=-90&&a[1]<=90)}else a.forEach(walk)};walk(f.geometry.coordinates)}}
assert.equal(data.snapshots[0].year,MIN_YEAR);assert.equal(data.snapshots.at(-1).year,MAX_YEAR);
for(const s of data.snapshots)assert((s.endYear??s.year)<=MAX_YEAR);
for(const c of cities)assert(c.start<=MAX_YEAR&&c.end<=MAX_YEAR);
assert(!JSON.stringify(data.snapshots).includes("中华人民共和国"));
for(const e of events){assert(e.year<=MAX_YEAR&&(e.endYear??e.year)<=MAX_YEAR);assert(e.name&&e.year&&e.terrain&&e.outcome,'Every battle needs explanatory content');assert(Number.isFinite(e.lng)&&Number.isFinite(e.lat))}
for(const c of cities){assert(c.start<=c.end&&Number.isFinite(c.lng)&&Number.isFinite(c.lat));assert(['capital','city','seat'].includes(c.kind))}
for(const f of ['index.html','app.js','style.css','assets/leaflet.js','assets/leaflet.css','assets/terrain.webp','terrain-style.js','terrain.css','history-domain.js'])assert(existsSync(new URL('../dist/'+f,import.meta.url)),f);
console.log(JSON.stringify({snapshots:data.snapshots.length,range:[data.snapshots[0].year,year],events:events.length,cities:cities.length,seats:cities.filter(c=>c.kind==='seat').length,geography:geo.features.length,validated:true}));
