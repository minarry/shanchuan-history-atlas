/** A compact, fixed-camera reader for documented changes of political control. */
export function createEvolutionPlayer({model, onFrame, onClose, getYear, getFrame}) {
  const panel = document.getElementById('evolutionPanel');
  const trigger = document.getElementById('evolutionBtn');
  const byId = id => panel.querySelector('#' + id);
  let current = null;
  let timer = null;
  let playing = false;
  let compare = false;

  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('aria-expanded', 'false');
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', '版图演进');
  panel.innerHTML = `
    <div class="evo-head">
      <select id="evolutionChapter" aria-label="选择版图演进章节"></select>
      <div class="evo-head-actions">
        <button type="button" id="evolutionFold" aria-expanded="true" aria-controls="evolutionStory" aria-label="折叠阶段说明" title="折叠阶段说明">−</button>
        <button type="button" id="evolutionClose" aria-label="关闭演进，返回时间轴" title="关闭演进，返回时间轴">×</button>
      </div>
    </div>
    <div class="evo-stage" aria-live="polite" aria-atomic="true">
      <div class="evo-dateline"><time id="evolutionDate"></time><span id="evolutionKind"></span></div>
      <strong id="evolutionTitle"></strong>
    </div>
    <div id="evolutionStory">
      <p id="evolutionSummary"></p>
      <ul id="evolutionTransfers" aria-label="领土归属变化"></ul>
    </div>
    <div id="evolutionRail" role="group" aria-label="选择事件阶段"></div>
    <div class="evo-controls">
      <button type="button" id="evolutionPrev" aria-label="上一阶段" title="上一阶段">‹</button>
      <button type="button" id="evolutionPlay"></button>
      <button type="button" id="evolutionNext" aria-label="下一阶段" title="下一阶段">›</button>
      <button type="button" id="evolutionCompare" aria-pressed="false" title="叠加上一阶段的政治边界">上一步疆界</button>
    </div>
    <details id="evolutionEvidence">
      <summary>史料与图示范围</summary>
      <p id="evolutionScope"></p>
      <div id="evolutionSources"></div>
    </details>`;

  const chapterSelect = byId('evolutionChapter');
  const rail = byId('evolutionRail');
  const evidence = byId('evolutionEvidence');
  const playButton = byId('evolutionPlay');
  const compareButton = byId('evolutionCompare');
  for (const chapter of model.chapters) {
    const option = document.createElement('option');
    option.value = chapter.id;
    option.textContent = chapter.title;
    chapterSelect.append(option);
  }

  function renderPlayButton() {
    if (!current) return;
    const last = current.stepIndex === current.chapter.steps.length - 1;
    playButton.textContent = playing ? 'Ⅱ 暂停' : last ? '↺ 重播' : '▶ 播放';
    playButton.setAttribute('aria-label', playing ? '暂停版图演进' : last ? '从本章开头重播' : '播放本章演进');
  }

  function pause() {
    clearTimeout(timer);
    timer = null;
    playing = false;
    renderPlayButton();
  }

  function buildRail(chapter) {
    const nodes = chapter.steps.map((step, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.evolutionStep = index;
      btn.dataset.shape = index > 0 && !step.changes.length ? 'point' : 'area';
      btn.title = step.date + ' · ' + step.title;
      btn.setAttribute('aria-label', '第' + (index + 1) + '步，' + btn.title);
      btn.onclick = () => {
        pause();
        showFrame(model.atStep(chapter.id, index), 'seek');
      };
      return btn;
    });
    rail.replaceChildren(...nodes);
  }

  function renderStory() {
    const {chapter, step, stepIndex, changed, sources} = current;
    byId('evolutionDate').textContent = step.date;
    const sameTerritory = stepIndex > 0 && !changed.length;
    panel.dataset.shape = sameTerritory ? 'point' : 'area';
    const kind = sameTerritory ? step.kind + ' · 疆域同前' : step.kind;
    byId('evolutionKind').textContent = kind + ' · ' + (stepIndex + 1) + '/' + chapter.steps.length;
    byId('evolutionTitle').textContent = step.title;
    byId('evolutionSummary').textContent = step.summary;
    const transfers = byId('evolutionTransfers');
    transfers.replaceChildren(...changed.map(feature => {
      const {parcel, from, to} = feature.properties;
      const row = document.createElement('li');
      row.textContent = (parcel === from ? '' : parcel + ' · ') + from + ' → ' + to;
      return row;
    }));
    transfers.hidden = !changed.length;
    byId('evolutionScope').textContent = chapter.description + ' 制图参考' + (chapter.baseYear<0?'公元前'+Math.abs(chapter.baseYear):chapter.baseYear) + '年切片及相关地区几何。';
    byId('evolutionSources').replaceChildren(...sources.filter(Boolean).map(source => {
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title + ' ↗';
      return link;
    }));
  }

  function showFrame(frame, reason) {
    if (!frame) return;
    const chapterChanged = current?.chapter.id !== frame.chapter.id;
    current = frame;
    if (!frame.previousStep) compare = false;
    if (chapterChanged) {
      chapterSelect.value = frame.chapter.id;
      buildRail(frame.chapter);
      evidence.open = false;
    }
    Array.from(rail.children).forEach((node, index) => {
      node.setAttribute('aria-current', index === frame.stepIndex ? 'step' : 'false');
      node.classList.toggle('complete', index < frame.stepIndex);
    });
    renderStory();
    byId('evolutionPrev').disabled = frame.stepIndex === 0;
    byId('evolutionNext').disabled = frame.stepIndex === frame.chapter.steps.length - 1;
    compareButton.disabled = !frame.previousStep;
    compareButton.setAttribute('aria-pressed', String(compare));
    renderPlayButton();
    onFrame(frame, {compare, chapterChanged, reason});
  }

  function open(chapterId, stepIndex = 0, {compare: requestedCompare = false, focus = false} = {}) {
    const frame = chapterId ? model.atStep(chapterId, stepIndex)
      : getFrame?.() || model.atYear(getYear()) || model.atStep(model.chapters[0]?.id, 0);
    if (!frame) return false;
    pause();
    compare = requestedCompare;
    panel.hidden = false;
    document.body.classList.add('evolution-open');
    trigger.setAttribute('aria-expanded', 'true');
    showFrame(frame, 'open');
    if (focus) chapterSelect.focus({preventScroll: true});
    return true;
  }

  function close({notify = true, restoreFocus = false} = {}) {
    if (!current) return;
    pause();
    current = null;
    compare = false;
    panel.hidden = true;
    document.body.classList.remove('evolution-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (notify) onClose();
    if (restoreFocus) trigger.focus({preventScroll: true});
  }

  function step(delta) {
    if (!current) return;
    pause();
    const frame = model.atStep(current.chapter.id, current.stepIndex + delta);
    if (frame) showFrame(frame, 'step');
  }

  function schedule() {
    if (!playing || !current) return;
    const next = model.atStep(current.chapter.id, current.stepIndex + 1);
    if (!next) {
      pause();
      return;
    }
    const readingTime = (current.step.summary.length + current.step.title.length) * 110;
    timer = setTimeout(() => {
      if (!playing) return;
      showFrame(next, 'play');
      schedule();
    }, Math.min(11000, Math.max(4500, readingTime)));
  }

  function play() {
    if (!current || playing) return;
    if (current.stepIndex === current.chapter.steps.length - 1) {
      showFrame(model.atStep(current.chapter.id, 0), 'replay');
    }
    evidence.open = false;
    playing = true;
    renderPlayButton();
    schedule();
  }

  function toggleCompare() {
    if (!current?.previousStep) return;
    pause();
    compare = !compare;
    compareButton.setAttribute('aria-pressed', String(compare));
    onFrame(current, {compare, chapterChanged: false, reason: 'compare'});
  }

  trigger.onclick = () => current ? close({restoreFocus: true}) : open(undefined, 0, {focus: true});
  byId('evolutionClose').onclick = () => close({restoreFocus: true});
  chapterSelect.onchange = () => open(chapterSelect.value);
  byId('evolutionNext').onclick = () => step(1);
  byId('evolutionPrev').onclick = () => step(-1);
  playButton.onclick = () => playing ? pause() : play();
  compareButton.onclick = toggleCompare;
  byId('evolutionFold').onclick = event => {
    const story = byId('evolutionStory');
    story.hidden = !story.hidden;
    const button = event.currentTarget;
    button.setAttribute('aria-expanded', String(!story.hidden));
    button.title = story.hidden ? '展开阶段说明' : '折叠阶段说明';
    button.setAttribute('aria-label', button.title);
    button.textContent = story.hidden ? '+' : '−';
    if (story.hidden) evidence.open = false;
  };
  evidence.addEventListener('toggle', () => { if (evidence.open) pause(); });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close({restoreFocus: true});
    } else if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.stopPropagation();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  for (const eventName of ['pointerdown', 'wheel']) {
    document.getElementById('map')?.addEventListener(eventName, pause, {passive: true});
  }
  return {
    open, close, pause, play, step, toggleCompare,
    get active() { return current !== null; },
    get playing() { return playing; },
    get frame() { return current; },
    get compare() { return compare; }
  };
}
