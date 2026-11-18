/** Additional timeline entries for attested steps without their own atlas article. */
function closingStages(model, articles) {
  const closing = new Map();
  for (const item of articles) {
    // A campaign article stands for its final recorded step in its displayed year.
    const stages = model.forEvent(item.id).filter(frame => frame.step.year === item.year);
    if (stages.length) closing.set(item.id, stages.at(-1));
  }
  return closing;
}

export function evolutionMoments(model, articles) {
  const represented = articles ? new Set([...closingStages(model,articles).values()].map(frame => frame.step)) : null;
  return model.chapters.flatMap(chapter => chapter.steps.flatMap((step, stepIndex) => {
    if (!stepIndex || (represented ? represented.has(step) : step.eventIds.length)) return [];
    const [lng, lat] = step.point ?? [];
    return [{
      id: 'change-' + chapter.id + '-' + step.id,
      name: step.title, year: step.year, sequence: 10 + stepIndex,
      _kind: 'moment', category: step.kind, tags: ['版图演进', step.kind],
      summary: step.summary, lng, lat, chapterId: chapter.id, stepIndex,
      impact: step.changes.map(change => change.parcel + '由' + change.from + '转归' + change.to).join('。'),
      uncertainty: chapter.description
    }];
  }));
}

export function framesForMoment(model, item) {
  if (!item) return [];
  if (item.chapterId) return [model.atStep(item.chapterId, item.stepIndex)].filter(Boolean);
  return model.forEvent(item.id);
}

/** At an article date use its own last attested phase, even if another event followed that year. */
export function politicalFrameForMoment(model, item) {
  return framesForMoment(model, item).filter(frame => frame.step.year <= item.year).at(-1)
    ?? model.atYear(item.year);
}

export function readEvolutionLink(model, hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const chapter = model.byId.get(params.get('evolution'));
  if (!chapter) return null;
  const id = params.get('step');
  const index = id ? chapter.steps.findIndex(step => step.id === id) : 0;
  if (index < 0) return null;
  return {chapterId: chapter.id, stepIndex: index, compare: params.get('compare') === '1'};
}

export function evolutionLink(frame, compare) {
  const params = new URLSearchParams({year: frame.step.year, evolution: frame.chapter.id, step: frame.step.id});
  if (compare) params.set('compare', '1');
  return '#' + params;
}

export function buildEvolutionTimeline(model, articles) {
  const closing = closingStages(model, articles);
  const original = articles.map(item => {
    const frame = closing.get(item.id);
    return frame ? {...item, sequence: 10 + frame.stepIndex} : item;
  });
  return [...original, ...evolutionMoments(model, articles)].sort((a,b) =>
    a.year-b.year || (a.sequence??50)-(b.sequence??50) || a.id.localeCompare(b.id));
}
