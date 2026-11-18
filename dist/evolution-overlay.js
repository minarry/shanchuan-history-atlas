const TRANSFER_PANE = 'politicalTransfers';
const SITE_PANE = 'politicalTransferSites';
const TRANSITION_MS = 1150;
const NEUTRAL = '#71664e';

function setupPane(map, name, zIndex) {
  const pane = map.getPane(name) || map.createPane(name);
  pane.style.zIndex = String(zIndex);
  pane.style.pointerEvents = 'none';
}

function channels(hex) {
  const value = /^#[\da-f]{6}$/i.test(hex) ? hex : NEUTRAL;
  return [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16));
}

function blend(start, end, fraction) {
  const rgb = start.map((from, i) => Math.round(from + (end[i] - from) * fraction));
  return 'rgb(' + rgb.join(',') + ')';
}

function textElement(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function addSite(group, result) {
  const {step, changed} = result;
  if (!step.point) return;
  const [lng, lat] = step.point;
  const icon = document.createElement('span');
  icon.className = 'tour-beacon';
  icon.append(document.createElement('i'));
  const site = L.marker([lat, lng], {
    pane: SITE_PANE,
    title: step.title,
    alt: step.title,
    icon: L.divIcon({className: 'evolution-site', html: icon, iconSize: [20, 20], iconAnchor: [10, 10]})
  }).addTo(group);

  const label = textElement('span', step.pointName || step.title);
  site.bindTooltip(label, {
    permanent: true, direction: 'auto', offset: [7, 0], className: 'factor-tooltip'
  });
  const details = document.createElement('div');
  details.append(textElement('small', step.date), textElement('h3', step.title), textElement('p', step.summary));
  for (const {properties: p} of changed) {
    details.append(textElement('div', p.parcel + ' · ' + p.from + ' → ' + p.to));
  }
  site.bindPopup(details, {maxWidth: 285, autoPan: false});
}

function addFormerBorders(group, result, previous) {
  const formerOwners = new Set(result.changed.map(f => f.properties.from));
  const outlines = previous?.features.filter(f => formerOwners.has(f.properties.name)) ?? [];
  for (const feature of outlines) {
    L.geoJSON(feature, {
      pane: TRANSFER_PANE, interactive: false,
      style: {fill: false, color: '#554b3e', weight: 2, opacity: .85, dashArray: '5 5'}
    }).addTo(group);
  }
}

/** Draw cartographic changes over the current political map. The caller owns
 * layer visibility, political fills, the chapter clock and the camera. */
export function createEvolutionOverlay(map) {
  setupPane(map, TRANSFER_PANE, 318);
  setupPane(map, SITE_PANE, 455);
  const layerGroup = L.layerGroup();
  let animation = null;
  let settle = null;

  function finishTransition() {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
    if (settle) settle();
    settle = null;
  }

  function clear() {
    finishTransition();
    layerGroup.clearLayers();
  }

  function render(result, {previous = null, animate = false, opacity = .22, compare = false} = {}) {
    clear();
    if (!result) return;

    const strength = Math.min(1, Math.max(0, opacity));
    const layers = result.changed.map(feature => {
      const p = feature.properties;
      const oldOwner = previous?.features.find(f => f.properties.name === p.from);
      const from = channels(p.fromColor ?? oldOwner?.properties.color ?? p.color);
      const to = channels(p.toColor ?? p.color);
      const layer = L.geoJSON(feature, {
        pane: TRANSFER_PANE, interactive: false,
        style: {color: p.toColor ?? p.color, opacity: .85, weight: 2,
          lineJoin: 'round', fillColor: p.toColor ?? p.color, fillOpacity: strength * .38}
      }).addTo(layerGroup);
      return {layer, from, to};
    });

    if (compare) addFormerBorders(layerGroup, result, previous);
    addSite(layerGroup, result);

    if (!animate || !layers.length || !map.hasLayer(layerGroup) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Only the transferred parcels change colour. The shape is held fixed
    // throughout; intermediate animation frames convey no dated front line.
    function paint(fraction) {
      for (const {layer, from, to} of layers) {
        const color = blend(from, to, fraction);
        layer.setStyle({
          color, fillColor: color, fillOpacity: Math.min(1, strength * (1.7 - 1.32 * fraction))
        });
      }
    }
    settle = () => paint(1);
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, Math.max(0, (now - start) / TRANSITION_MS));
      paint(t * t * (3 - 2 * t));
      if (t < 1) animation = requestAnimationFrame(tick);
      else {
        animation = null;
        settle = null;
      }
    }
    paint(0);
    animation = requestAnimationFrame(tick);
  }

  layerGroup.on('remove', finishTransition);
  function destroy() {
    clear();
    layerGroup.off('remove', finishTransition);
    layerGroup.remove();
  }
  return {layerGroup, render, clear, destroy};
}
