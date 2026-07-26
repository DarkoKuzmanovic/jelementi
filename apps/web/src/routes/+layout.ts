// Phase 0 ships a static (currently single-article) site. Marking the whole
// app prerenderable makes `vite build` actually render every reachable route at
// build time — which doubles as a runtime proof that the article renderer SSRs
// correctly, not just that it type-checks.
export const prerender = true;
