// PROTOTYPE ONLY — local comparison state for ticket #94; never import into apps/web.
const articles = [
  {
    slug: 'quietest-island',
    title: 'The Quietest Island in the Middle of Everywhere',
    excerpt:
      'Life, weather, and improbable connection on a volcanic island far from any continental shore.',
    category: 'Remote places',
    categorySlug: 'remote-places',
    publishedAt: '2026-08-18',
    date: '18 August 2026',
    minutes: 9,
    tags: ['islands', 'weather', 'remote places'],
  },
  {
    slug: 'old-maps-monsters',
    title: 'Why Old Maps Leave Room for Monsters',
    excerpt: 'What blank edges reveal about knowledge, fear, and imagination.',
    category: 'Culture',
    categorySlug: 'culture',
    publishedAt: '2026-08-14',
    date: '14 August 2026',
    minutes: 6,
    tags: ['maps', 'history', 'cartography'],
  },
  {
    slug: 'listening-after-rain',
    title: 'A Field Guide to Listening After Rain',
    excerpt: 'Small sounds that return when a summer storm finally moves on.',
    category: 'Nature',
    categorySlug: 'nature',
    publishedAt: '2026-08-08',
    date: '8 August 2026',
    minutes: 7,
    tags: ['rain', 'sound', 'weather'],
  },
  {
    slug: 'library-donkey',
    title: 'The Library That Travelled by Donkey',
    excerpt: 'A moving collection, a mountain path, and the habit of sharing books.',
    category: 'History',
    categorySlug: 'history',
    publishedAt: '2026-08-01',
    date: '1 August 2026',
    minutes: 5,
    tags: ['libraries', 'books', 'mountains'],
  },
  {
    slug: 'hand-painted-signs',
    title: 'The Useful Awkwardness of Hand-painted Signs',
    excerpt: 'Letterforms that make a street feel owned rather than branded.',
    category: 'Design',
    categorySlug: 'design',
    publishedAt: '2026-07-24',
    date: '24 July 2026',
    minutes: 4,
    tags: ['signs', 'lettering', 'craft'],
  },
  {
    slug: 'salt-smoke-time',
    title: 'Salt, Smoke, Time',
    excerpt: 'Three patient ingredients and the coastal kitchens built around them.',
    category: 'Food',
    categorySlug: 'food',
    publishedAt: '2026-07-17',
    date: '17 July 2026',
    minutes: 8,
    tags: ['coast', 'kitchens', 'preservation'],
  },
  {
    slug: 'postcards-imaginary',
    title: 'Postcards Sent to Places That Never Existed',
    excerpt: 'A tiny archive of sincere messages addressed to imaginary towns.',
    category: 'Culture',
    categorySlug: 'culture',
    publishedAt: '2026-07-09',
    date: '9 July 2026',
    minutes: 6,
    tags: ['postcards', 'archives', 'memory'],
  },
  {
    slug: 'rivers-calendar',
    title: 'Borrowing the River’s Calendar',
    excerpt: 'Reading a year through flood marks, reeds, insects, and returning birds.',
    category: 'Nature',
    categorySlug: 'nature',
    publishedAt: '2026-06-30',
    date: '30 June 2026',
    minutes: 10,
    tags: ['rivers', 'seasons', 'wildlife'],
  },
];

const variants = [
  {
    key: 'A',
    label: 'Quiet index',
    thesis: 'A calm ruled directory that lets article titles carry the page.',
  },
  {
    key: 'B',
    label: 'Editorial ledger',
    thesis: 'A more structured desktop scan that collapses to the same narrow reading order.',
  },
  {
    key: 'C',
    label: 'Field notes',
    thesis: 'Selective numbering adds signature without making recovery language playful.',
  },
];
const routes = ['categories', 'category', 'search', 'about', '404', 'error'];

function currentState() {
  const params = new URLSearchParams(window.location.search);
  const requestedVariant = params.get('variant')?.toUpperCase();
  const requestedRoute = params.get('route')?.toLowerCase();
  return {
    variant: variants.some(({ key }) => key === requestedVariant) ? requestedVariant : 'A',
    route: routes.includes(requestedRoute) ? requestedRoute : 'categories',
    category: params.get('category') || 'culture',
    query: params.get('q') || '',
  };
}

function replaceState(next) {
  const url = new URL(window.location.href);
  url.searchParams.set('variant', next.variant);
  url.searchParams.set('route', next.route);
  if (next.route === 'category') {
    url.searchParams.set('category', next.category);
  } else {
    url.searchParams.delete('category');
  }
  if (next.route === 'search' && next.query) {
    url.searchParams.set('q', next.query);
  } else {
    url.searchParams.delete('q');
  }
  window.history.replaceState({}, '', url);
}

function categoryGroups() {
  const groups = new Map();
  for (const article of articles) {
    const group = groups.get(article.categorySlug) ?? {
      name: article.category,
      slug: article.categorySlug,
      articles: [],
    };
    group.articles.push(article);
    groups.set(article.categorySlug, group);
  }
  return [...groups.values()].sort(
    (left, right) =>
      right.articles.length - left.articles.length || left.name.localeCompare(right.name),
  );
}

function articleMarkup(article, headingLevel = 2) {
  return `
    <article class="article-summary">
      <p class="summary-meta">
        <a href="?route=category&category=${article.categorySlug}" data-route-link="category" data-category="${article.categorySlug}">${article.category}</a>
        <time datetime="${article.publishedAt}">${article.date}</time>
        <span>${article.minutes} min read</span>
      </p>
      <h${headingLevel}><a href="https://github.com/DarkoKuzmanovic/jelementi/tree/c548b7e/prototypes/article-reading" target="_blank" rel="noreferrer" aria-label="${article.title} — open the approved article prototype source">${article.title}</a></h${headingLevel}>
      <p>${article.excerpt}</p>
    </article>`;
}

function renderCategories() {
  document.querySelector('#category-index').innerHTML = categoryGroups()
    .map(({ name, slug, articles: groupedArticles }) => {
      const newest = groupedArticles[0];
      const count = groupedArticles.length;
      return `
        <li class="category-entry">
          <div>
            <h2><a href="?route=category&category=${slug}" data-route-link="category" data-category="${slug}">${name}</a></h2>
            <span class="category-count">${count} ${count === 1 ? 'article' : 'articles'}</span>
          </div>
          <div class="category-newest">
            <span class="category-newest__label">Newest article</span>
            <a href="https://github.com/DarkoKuzmanovic/jelementi/tree/c548b7e/prototypes/article-reading" target="_blank" rel="noreferrer" aria-label="${newest.title} — open the approved article prototype source">${newest.title}</a>
            <time datetime="${newest.publishedAt}">${newest.date}</time>
          </div>
        </li>`;
    })
    .join('');
}

function renderCategory(categorySlug) {
  const group = categoryGroups().find(({ slug }) => slug === categorySlug) ?? categoryGroups()[0];
  document.querySelector('#category-title').textContent = group.name;
  document.querySelector('#category-count').textContent = `${group.articles.length} ${
    group.articles.length === 1 ? 'article' : 'articles'
  }`;
  document.querySelector('#category-results').innerHTML = group.articles
    .map((article) => articleMarkup(article))
    .join('');
}

function searchMatches(query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return articles;
  return articles.filter((article) =>
    [article.title, article.excerpt, article.category, ...article.tags]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized),
  );
}

function renderSearch(query) {
  const input = document.querySelector('#search-input');
  const results = searchMatches(query);
  const hasQuery = query.trim().length > 0;
  if (input.value !== query) input.value = query;
  document.querySelector('#search-state-title').textContent = hasQuery
    ? `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${query.trim()}”`
    : 'All published articles';
  document.querySelector('#clear-search').hidden = !hasQuery;
  document.querySelector('#search-results').hidden = results.length === 0;
  document.querySelector('#search-empty').hidden = results.length !== 0;
  document.querySelector('#search-results').innerHTML = results
    .map((article) => articleMarkup(article, 3))
    .join('');
}

function bindRouteLinks() {
  document.querySelectorAll('[data-route-link]').forEach((link) => {
    if (link.dataset.bound === 'true') return;
    link.dataset.bound = 'true';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const state = currentState();
      state.route = link.dataset.routeLink;
      if (link.dataset.category) state.category = link.dataset.category;
      replaceState(state);
      render(true);
    });
  });
}

function render(focusRoute = false) {
  const state = currentState();
  const variant = variants.find(({ key }) => key === state.variant) ?? variants[0];
  document.documentElement.dataset.variant = variant.key;
  document.querySelectorAll('[data-route]').forEach((section) => {
    section.hidden = section.dataset.route !== state.route;
  });
  document.querySelectorAll('nav [data-route-link]').forEach((link) => {
    if (link.dataset.routeLink === state.route) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  document.querySelector('#route-select').value = state.route;
  document.querySelector('#state-variant').textContent = `${variant.key} — ${variant.label}`;
  document.querySelector('#variant-label').textContent = `${variant.key} — ${variant.label}`;
  document.querySelector('#state-route').textContent = `/${state.route}`;
  const converges = ['about', '404', 'error'].includes(state.route);
  document.querySelector('#state-thesis').textContent = converges
    ? 'All variants intentionally converge here: compact About and plain, exact recovery.'
    : variant.thesis;
  document.title = `PROTOTYPE ${variant.key} · /${state.route} — Jelementi`;

  if (state.route === 'category') renderCategory(state.category);
  if (state.route === 'search') renderSearch(state.query);
  bindRouteLinks();
  if (focusRoute) {
    const heading = document.querySelector(`.route[data-route="${state.route}"] h1`);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
  }
}

function cycleVariant(direction) {
  const state = currentState();
  const index = variants.findIndex(({ key }) => key === state.variant);
  state.variant = variants[(index + direction + variants.length) % variants.length].key;
  replaceState(state);
  render();
}

function clearSearch() {
  const state = currentState();
  state.query = '';
  replaceState(state);
  render();
  document.querySelector('#search-input').focus();
}

renderCategories();
bindRouteLinks();
document.querySelector('#previous-variant').addEventListener('click', () => cycleVariant(-1));
document.querySelector('#next-variant').addEventListener('click', () => cycleVariant(1));
document.querySelector('#route-select').addEventListener('change', (event) => {
  const state = currentState();
  state.route = event.target.value;
  replaceState(state);
  render(true);
});
document.querySelector('#search-input').addEventListener('input', (event) => {
  if (event.target.value !== '') return;
  const state = currentState();
  state.query = '';
  replaceState(state);
  renderSearch('');
});
document.querySelector('#search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const state = currentState();
  state.query = new FormData(event.currentTarget).get('query')?.toString() ?? '';
  replaceState(state);
  render();
});
document.querySelector('#clear-search').addEventListener('click', clearSearch);
document.querySelector('#empty-clear').addEventListener('click', clearSearch);
document.querySelector('#try-again').addEventListener('click', () => window.location.reload());
window.addEventListener('popstate', render);
window.addEventListener('resize', updateWidthState);
window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target !== document.body && target !== document.documentElement) return;
  if (event.key === 'ArrowLeft') cycleVariant(-1);
  if (event.key === 'ArrowRight') cycleVariant(1);
});

function updateWidthState() {
  const width = window.innerWidth;
  document.querySelector('#state-width').textContent =
    width <= 360
      ? `narrow · ${width}px`
      : width <= 720
        ? `compact · ${width}px`
        : `wide · ${width}px`;
}

replaceState(currentState());
render();
updateWidthState();
