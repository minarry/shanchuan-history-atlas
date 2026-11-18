/**
 * Resolve a year-end political map, or a particular documented phase within a
 * year. The compiled frames share geometry with the atlas and one another.
 * A point event has no changed polygons. Outside a chapter, the caller uses
 * its ordinary dated snapshot.
 */
export function createPoliticalEvolution(atlas, catalog) {
  const sources = new Map(catalog.sources.map(source => [source.id, source]));
  const snapshots = new Map(atlas.snapshots.map(snapshot => [snapshot.id, snapshot]));
  const chapters = catalog.chapters;
  const byId = new Map(chapters.map(chapter => [chapter.id, chapter]));
  const frames = new Map();

  for (const chapter of chapters) {
    const sourceSnapshot = snapshots.get(chapter.sourceSnapshotId);
    if (!sourceSnapshot) throw new Error('Unknown source snapshot: ' + chapter.sourceSnapshotId);

    const shapes = new Map();
    for (const [key, asset] of Object.entries(chapter.features)) {
      const geometry = catalog.geometries[asset.ref] ?? atlas.geometries[asset.ref];
      if (!geometry) throw new Error('Missing political geometry: ' + asset.ref);
      const properties = {
        id: asset.name,
        name: asset.name,
        label: asset.label,
        color: asset.color,
        kind: asset.kind ?? 'territory',
        note: asset.note ?? chapter.description
      };
      shapes.set(key, {type: 'Feature', properties, geometry});
    }

    const polityColors = new Map([...shapes.values()].map(f => [f.properties.name, f.properties.color]));
    const timeline = chapter.steps.map((step, stepIndex) => {
      const features = step.frame.map(key => shapes.get(key));
      const changed = step.changes.map(change => {
        const f = shapes.get(change.feature);
        return {...f, properties: {
          ...f.properties,
          from: change.from,
          to: change.to,
          parcel: change.parcel,
          regionName: change.parcel,
          fromColor: polityColors.get(change.from),
          toColor: polityColors.get(change.to)
        }};
      });
      return {
        chapter, step, stepIndex, previousStep: chapter.steps[stepIndex - 1] ?? null,
        features, changed, sourceSnapshot, sources: step.sourceIds.map(id => sources.get(id))
      };
    });
    frames.set(chapter.id, timeline);
  }

  function atStep(chapterId, stepIndex) {
    if (!Number.isInteger(stepIndex)) return null;
    return frames.get(chapterId)?.[stepIndex] ?? null;
  }

  function atYear(year) {
    if (!Number.isInteger(year) || year === 0) return null;
    const chapter = chapters.find(c => year >= c.startYear && year <= c.endYear);
    if (!chapter) return null;
    let last = -1;
    for (const step of chapter.steps) {
      if (step.year > year) break;
      last++;
    }
    return atStep(chapter.id, last);
  }

  function forEvent(eventId) {
    for (const chapter of chapters) {
      const steps = frames.get(chapter.id).filter(frame => frame.step.eventIds.includes(eventId));
      if (steps.length) return steps;
    }
    return [];
  }

  return {chapters, byId, sources, atYear, atStep, forEvent};
}
