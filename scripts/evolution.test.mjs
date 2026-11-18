import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createPoliticalEvolution} from '../dist/political-evolution.js';

const data = name => JSON.parse(readFileSync(new URL('../dist/data/' + name + '.json', import.meta.url)));
const evolution = createPoliticalEvolution(data('snapshots'), data('political-changes'));
const names = frame => new Set(frame.features.map(f => f.properties.name));
const byStep = (chapterId, stepId) => {
  const chapter = evolution.byId.get(chapterId);
  return evolution.atStep(chapterId, chapter.steps.findIndex(step => step.id === stepId));
};

test('秦取邯郸与灭代分开，燕、代先后于同年结束', () => {
  const afterChu = names(evolution.atYear(-223));
  assert.ok(afterChu.has('燕') && afterChu.has('代') && !afterChu.has('楚'));
  const afterYan = names(byStep('qin', 'liaodong'));
  assert.ok(!afterYan.has('燕') && afterYan.has('代'));
  assert.deepEqual(names(evolution.atYear(-222)), new Set(['秦', '齐']));
});

test('战场进展不提前吞并蜀汉，受禅保持魏境几何', () => {
  const fighting = byStep('three-kingdoms', 'mianzhu');
  assert.equal(fighting.changed.length, 0);
  assert.ok(names(fighting).has('蜀汉'));
  const surrender = byStep('three-kingdoms', 'chengdu');
  assert.deepEqual(surrender.changed.map(f => [f.properties.from, f.properties.to]), [['蜀汉', '魏']]);
  const before = evolution.atYear(265);
  const after = evolution.atYear(266);
  assert.deepEqual(names(before), new Set(['魏', '吴']));
  assert.deepEqual(names(after), new Set(['晋', '吴']));
  const territory = (f, name) => f.features.find(p => p.properties.name === name).geometry;
  assert.equal(territory(before, '魏'), territory(after, '晋'));
  assert.equal(territory(before, '吴'), territory(after, '吴'));
});

test('辽东政权与两魏分立按相应事件时序改名', () => {
  assert.ok(names(evolution.atYear(222)).has('辽东公孙氏'));
  assert.ok(names(evolution.atYear(237)).has('燕（公孙氏）'));
  assert.ok(!names(evolution.atYear(238)).has('燕（公孙氏）'));
  assert.ok(names(evolution.atYear(533)).has('北魏'));
  const east = names(evolution.atYear(534));
  assert.ok(east.has('东魏') && east.has('关中魏廷') && !east.has('西魏'));
  assert.ok(names(evolution.atYear(535)).has('西魏'));
});

test('归附与攻占各记一段，高梁河败战不更改已接收的河东', () => {
  const afterJingnan = names(byStep('song', 'jingnan'));
  assert.ok(afterJingnan.has('武平（湖南）') && !afterJingnan.has('荆南（南平）'));
  assert.ok(names(byStep('song', 'pinghai')).has('吴越'));
  const defeat = byStep('song', 'gaoliang');
  assert.equal(defeat.changed.length, 0);
  assert.deepEqual(defeat.features, byStep('song', 'beihan').features);
  assert.ok(names(defeat).has('辽'));
});

test('每个变动均可回查来源和事件，未编年的日期回退', () => {
  const ids = new Set([...data('events'), ...data('research').milestones].map(e => e.id));
  for (const chapter of evolution.chapters) {
    chapter.steps.forEach((step, i) => {
      const frame = evolution.atStep(chapter.id, i);
      assert.ok(frame.sources.length > 0 && frame.sources.every(s => s?.url.startsWith('https://')));
      assert.ok(frame.features.every(f => f.geometry && f.properties.color));
      assert.ok(step.eventIds.every(id => ids.has(id) && evolution.forEvent(id).includes(frame)));
      if (step.point) assert.ok(step.pointName && step.point.every(Number.isFinite));
      for (const f of frame.changed) {
        assert.ok(f.properties.fromColor && f.properties.toColor && f.properties.from !== f.properties.to);
      }
    });
    assert.equal(evolution.atStep(chapter.id, chapter.steps.length), null);
  }
  for (const y of [0, -232, 221, 281, 536, 980, 1929]) assert.equal(evolution.atYear(y), null);
});

test('同年受降与受禅会立即更新都城，同址不重复标治所', async () => {
  const {evolutionPlaces} = await import('../dist/evolution-places.js');
  const catalog = data('cities');
  const cities = catalog.cities ?? catalog;
  const city = (frame, name, year = frame.step.year) => {
    const matches = evolutionPlaces(cities, year, frame).filter(c => c.name === name);
    assert.equal(matches.length, 1);
    return matches[0];
  };
  assert.equal(city(byStep('three-kingdoms', 'mianzhu'), '成都').kind, 'capital');
  assert.equal(city(byStep('three-kingdoms', 'chengdu'), '成都').kind, 'city');
  assert.equal(city(byStep('three-kingdoms', 'jiangling'), '建业').kind, 'capital');
  assert.equal(city(byStep('three-kingdoms', 'jianye'), '建业').kind, 'city');
  assert.equal(city(evolution.atYear(265), '洛阳', 265).region, '魏');
  assert.equal(city(evolution.atYear(266), '洛阳').region, '晋');
  assert.equal(city(byStep('wei-split', 'chang-an'), '邺').kind, 'city');
  assert.equal(city(byStep('wei-split', 'ye'), '邺').kind, 'capital');
  assert.equal(city(byStep('song', 'beihan'), '晋阳').kind, 'city');
  assert.deepEqual(evolutionPlaces(cities, 1900, null), cities.filter(c => c.start <= 1900 && c.end >= 1900));
});
