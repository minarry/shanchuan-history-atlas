import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPoliticalEvolution} from '../dist/political-evolution.js';

function readData(file) {
  return JSON.parse(readFileSync(new URL(`../dist/data/${file}.json`, import.meta.url)));
}

const catalog = readData('political-changes');
const evolution = createPoliticalEvolution(readData('snapshots'), catalog);
const eventData = readData('events');
const eventIds = new Set([...(eventData.events ?? eventData), ...readData('research').milestones].map(item => item.id));

function at(chapterId, stepId) {
  const index = evolution.byId.get(chapterId).steps.findIndex(step => step.id === stepId);
  const frame = evolution.atStep(chapterId, index);
  assert.ok(frame, `${chapterId}/${stepId} has a map`);
  return frame;
}

function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[j];
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}

function ownerAt(frame, point) {
  const owners = frame.features.filter(({geometry}) => {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polygons.some(([shell, ...holes]) => insideRing(point, shell) && !holes.some(hole => insideRing(point, hole)));
  });
  assert.equal(owners.length, 1, `${frame.step.title} at ${point} should have one owner`);
  return owners[0].properties.name;
}

const geography = (frame, name) => frame.features.find(feature => feature.properties.name === name)?.geometry;

test('Qin takes Ji before Liaodong, while Dai survives the surrender of Handan', () => {
  const ji = [116.35, 39.89], liaodong = [123.18, 41.27], dai = [114.57, 39.84];
  assert.equal(ownerAt(evolution.atYear(-227), ji), '燕');
  assert.equal(ownerAt(evolution.atYear(-226), ji), '秦');
  assert.equal(ownerAt(evolution.atYear(-223), liaodong), '燕');
  assert.equal(ownerAt(evolution.atYear(-223), dai), '代');
  const east = at('qin', 'liaodong');
  assert.equal(ownerAt(east, liaodong), '秦');
  assert.equal(ownerAt(east, dai), '代');
  assert.equal(ownerAt(evolution.atYear(-222), dai), '秦');
  assert.equal(ownerAt(evolution.atYear(-223), dai), '代', 'seeking backwards restores earlier ownership');
});

test('local fighting, surrender, and dynastic succession produce distinct map effects', () => {
  const chengdu = [104.07, 30.66], jianye = [118.78, 32.06];
  const point = at('three-kingdoms', 'mianzhu');
  const surrender = at('three-kingdoms', 'chengdu');
  assert.equal(point.changed.length, 0);
  assert.equal(ownerAt(point, chengdu), '蜀汉');
  assert.equal(ownerAt(surrender, chengdu), '魏');
  const succession = at('three-kingdoms', 'jin');
  assert.deepEqual(geography(surrender, '魏'), geography(succession, '晋'));
  assert.deepEqual(geography(surrender, '吴'), geography(succession, '吴'));
  assert.equal(ownerAt(at('three-kingdoms', 'jiangling'), jianye), '吴');
  assert.equal(ownerAt(evolution.atYear(280), jianye), '晋');
  assert.ok(evolution.forEvent('battle-13').some(frame => frame.step.id === 'chengdu'));
});

test('the division of Northern Wei distinguishes relocation, rival courts, and Western Wei’s accession', () => {
  const changan = [108.89, 34.27], ye = [114.41, 36.28], jiankang = [118.78, 32.06];
  const relocation = at('wei-split', 'chang-an');
  assert.equal(relocation.changed.length, 0);
  assert.equal(ownerAt(relocation, ye), '北魏');
  const divided = evolution.atYear(534);
  assert.equal(ownerAt(divided, changan), '关中魏廷');
  assert.equal(ownerAt(divided, ye), '东魏');
  const nextYear = evolution.atYear(535);
  assert.equal(ownerAt(nextYear, changan), '西魏');
  assert.equal(ownerAt(nextYear, jiankang), '梁');
  assert.deepEqual(geography(divided, '梁'), geography(nextYear, '梁'));
});

test('Song gains only the documented parcels; a defeat near Youzhou adds no territory', () => {
  const jiangling = [112.19, 30.35], changsha = [112.98, 28.19], hangzhou = [120.15, 30.25];
  const first963 = at('song', 'jingnan');
  assert.equal(ownerAt(first963, jiangling), '宋');
  assert.equal(ownerAt(first963, changsha), '武平（湖南）');
  assert.equal(ownerAt(evolution.atYear(963), changsha), '宋');
  assert.equal(ownerAt(at('song', 'pinghai'), hangzhou), '吴越');
  assert.equal(ownerAt(evolution.atYear(978), hangzhou), '宋');
  const defeat = at('song', 'gaoliang');
  assert.equal(defeat.changed.length, 0);
  assert.equal(ownerAt(defeat, [116.33, 39.94]), '辽');
  assert.deepEqual(defeat.features, at('song', 'beihan').features);
});

test('every rendered step resolves its source, shape, prior step and linked history entries', () => {
  for (const chapter of evolution.chapters) {
    let prior = null;
    for (const [index, step] of chapter.steps.entries()) {
      const frame = evolution.atStep(chapter.id, index);
      assert.equal(frame.previousStep, prior);
      assert.ok(frame.sourceSnapshot && frame.sources.length && frame.sources.every(source => source?.url));
      assert.ok(frame.features.length && frame.features.every(f => f?.geometry && f.properties.name));
      assert.ok(frame.changed.every(f => f?.geometry && f.properties.from !== f.properties.to));
      assert.ok(step.eventIds.every(id => eventIds.has(id)), `unresolved event for ${step.id}`);
      prior = step;
    }
  }
  for (const year of [0, 208, 1916]) assert.equal(evolution.atYear(year), null);
  assert.deepEqual(evolution.forEvent('unknown'), []);
  assert.equal(evolution.atStep('qin', -1), null);
});

test('timeline events and shared links select the precise stage instead of the last event that year', async () => {
  const {evolutionMoments, framesForMoment, politicalFrameForMoment, evolutionLink, readEvolutionLink} = await import('../dist/evolution-history.js');
  const newEntries = evolutionMoments(evolution);
  assert.equal(new Set(newEntries.map(entry => entry.id)).size, newEntries.length);
  const annexation = newEntries.find(entry => entry.year === -222 && entry.name.includes('燕'));
  assert.ok(annexation);
  assert.equal(politicalFrameForMoment(evolution, annexation).step.id, 'liaodong');
  assert.equal(evolution.atYear(-222).step.id, 'dai');
  assert.equal(framesForMoment(evolution, {id: 'battle-13'}).length, 3);
  const frame = at('three-kingdoms', 'mianzhu');
  const link = evolutionLink(frame, true);
  assert.deepEqual(readEvolutionLink(evolution, link), {chapterId: frame.chapter.id, stepIndex: frame.stepIndex, compare:true});
  assert.equal(readEvolutionLink(evolution, '#chapter=butian&phase=after'), null);
  assert.equal(readEvolutionLink(evolution, '#evolution=three-kingdoms&step=absent'), null);
});

test('ordinary event playback orders same-year campaigns by phase and keeps their result article', async () => {
  const {buildEvolutionTimeline, politicalFrameForMoment} = await import('../dist/evolution-history.js');
  const articles = [...(eventData.events ?? eventData), ...readData('research').milestones];
  const chronology = buildEvolutionTimeline(evolution, articles);
  const stages = year => chronology.filter(item => item.year === year)
    .map(item => ({id:item.id, step:politicalFrameForMoment(evolution, item)?.step.id}));
  const conquest = stages(263);
  assert.deepEqual(conquest.map(entry => entry.step), ['jiange', 'mianzhu', 'chengdu']);
  assert.equal(conquest.at(-1).id, 'battle-13');
  assert.deepEqual(stages(979), [
    {id:'expand-northern-han', step:'beihan'},
    {id:'battle-gaolianghe', step:'gaoliang'}
  ]);
  assert.equal(new Set(chronology.map(item => item.id)).size, chronology.length);
  assert.ok([...eventIds].every(id => chronology.some(item => item.id === id)), 'each original article remains accessible');
});

test('the fall of Lin’an preserves contested Fujian and separates the Fuzhou court from the sea court', () => {
  const afterLinan = at('southern-song-end', 'song-end-linan');
  assert.equal(ownerAt(afterLinan,[120.16,30.24]), '诏降待接收区');
  assert.equal(ownerAt(afterLinan,[119.30,26.08]), '闽广争夺区');
  assert.equal(afterLinan.features.find(f=>f.properties.name==='闽广争夺区').properties.kind,'contested');
  assert.ok(afterLinan.features.some(f=>f.properties.kind==='context'));
  assert.equal(at('southern-song-end','song-end-embark').changed.length,0);
  assert.equal(at('southern-song-end','song-end-fancheng').changed.length,0);
  assert.equal(ownerAt(evolution.atYear(1279),[119.30,26.08]), '元');
});
