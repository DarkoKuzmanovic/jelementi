<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';

  let { children } = $props();
  const isStudio = $derived(
    page.url.pathname === '/studio' || page.url.pathname.startsWith('/studio/'),
  );

  function isCurrent(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

{#if isStudio}
  {@render children()}
{:else}
  <!--
    Reader shell — persistent low-chrome chrome (#98). Every public route
    renders inside this shell: working bypass link, one main landmark,
    Jelementi Home, Categories, Search, and About navigation at all widths
    (conventional wrapping, never hidden behind a menu), and quiet footer
    recovery links. Static markup only — no hydration added. Studio routes
    render without this shell; they have their own StudioShell boundary.
  -->
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="site-header">
    <div class="site-header__inner">
      <a href="/" class="jelementi-wordmark">Jelementi</a>
      <nav aria-label="Primary navigation">
        <a href="/" aria-current={isCurrent('/') ? 'page' : undefined}>Home</a>
        <a href="/categories" aria-current={isCurrent('/categories') ? 'page' : undefined}
          >Categories</a
        >
        <a href="/search" aria-current={isCurrent('/search') ? 'page' : undefined}>Search</a>
        <a href="/about" aria-current={isCurrent('/about') ? 'page' : undefined}>About</a>
      </nav>
    </div>
  </header>
  <main id="main-content" tabindex="-1" class="layout">
    {@render children()}
  </main>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <a href="/" class="jelementi-wordmark">Jelementi</a>
      <nav aria-label="Footer navigation">
        <a href="/">Home</a>
        <a href="/categories">Categories</a>
        <a href="/search">Search</a>
        <a href="/about">About</a>
      </nav>
    </div>
  </footer>
{/if}

<style>
  .site-header {
    border-bottom: 1px solid var(--foundation-rule);
  }

  .site-header__inner,
  .site-footer__inner {
    width: min(42rem, calc(100% - 2rem));
    margin: 0 auto;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2) var(--space-6);
    flex-wrap: wrap;
    padding: var(--space-4) 0;
  }

  .site-header nav,
  .site-footer nav {
    display: flex;
    gap: var(--space-2) var(--space-6);
    flex-wrap: wrap;
  }

  .site-header nav a,
  .site-footer nav a {
    color: var(--foundation-ink);
    font-size: var(--text-small);
    font-weight: 650;
    text-decoration: none;
  }

  .site-header nav a:hover,
  .site-footer nav a:hover,
  .site-header nav a[aria-current='page'] {
    color: var(--foundation-link);
    text-decoration: underline;
  }

  .site-header nav a[aria-current='page'] {
    text-decoration-thickness: 0.14em;
  }

  .site-footer {
    margin-top: var(--space-12);
    border-top: 1px solid var(--foundation-rule);
  }

  .site-footer__inner {
    padding: var(--space-6) 0;
  }
</style>
