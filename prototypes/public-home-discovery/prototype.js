// PROTOTYPE ONLY — standalone switcher state; never import into apps/web.
const variants = [
  {
    key: 'A',
    label: 'Editorial front',
    hypothesis: 'Tests a composed publication front page with strong editorial hierarchy.',
  },
  {
    key: 'B',
    label: 'Slow journal',
    hypothesis: 'Tests whether one sequential reading path feels calmer and more literary.',
  },
  {
    key: 'C',
    label: 'Curious index',
    hypothesis: 'Tests whether persistent category wayfinding makes the catalog easier to explore.',
  },
  {
    key: 'D',
    label: 'Field notebook',
    hypothesis: 'Tests whether restrained asymmetry can become Jelementi’s recognizable signature.',
  },
];

const sections = [...document.querySelectorAll('[data-variant]')];
const stateVariant = document.querySelector('#state-variant');
const stateWidth = document.querySelector('#state-width');
const stateHypothesis = document.querySelector('#state-hypothesis');
const switcherLabel = document.querySelector('#switcher-label');
const previousButton = document.querySelector('#previous-variant');
const nextButton = document.querySelector('#next-variant');

function currentKey() {
  const requested = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  return variants.some((variant) => variant.key === requested) ? requested : 'A';
}

function renderVariant(key, updateUrl = true) {
  const variant = variants.find((candidate) => candidate.key === key) ?? variants[0];

  for (const section of sections) {
    section.hidden = section.dataset.variant !== variant.key;
  }

  const label = `${variant.key} — ${variant.label}`;
  stateVariant.textContent = label;
  stateHypothesis.textContent = variant.hypothesis;
  switcherLabel.textContent = label;
  document.title = `PROTOTYPE ${variant.key} — Jelementi public home`;

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', variant.key);
    window.history.replaceState({}, '', url);
  }
}

function cycle(direction) {
  const index = variants.findIndex((variant) => variant.key === currentKey());
  const nextIndex = (index + direction + variants.length) % variants.length;
  renderVariant(variants[nextIndex].key);
}

function updateWidthState() {
  const width = window.innerWidth;
  stateWidth.textContent =
    width <= 360
      ? `narrow · ${width}px`
      : width <= 760
        ? `compact · ${width}px`
        : `wide · ${width}px`;
}

previousButton.addEventListener('click', () => cycle(-1));
nextButton.addEventListener('click', () => cycle(1));
window.addEventListener('resize', updateWidthState);
window.addEventListener('popstate', () => renderVariant(currentKey(), false));
window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable)
  )
    return;
  if (event.key === 'ArrowLeft') cycle(-1);
  if (event.key === 'ArrowRight') cycle(1);
});

renderVariant(currentKey());
updateWidthState();
