<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  function isCurrent(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<div class="reader-surface" class:reader-home={page.url.pathname === '/'}>
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="site-header">
    <div class="site-header__inner">
      <a href="/" class="jelementi-wordmark">Jelementi</a>
      <p class="site-tagline">Curious, careful stories<br />from nearby and far away.</p>
      <nav aria-label="Primary navigation">
        <a href="/" aria-current={isCurrent('/') ? 'page' : undefined}>Home</a>
        <a href="/categories" aria-current={isCurrent('/categories') ? 'page' : undefined}
          >Categories</a
        >
        <a href="/podcast.xml">Podcast</a>
        <a href="/about" aria-current={isCurrent('/about') ? 'page' : undefined}>About</a>
        <a href="/search" aria-current={isCurrent('/search') ? 'page' : undefined}>Search</a>
      </nav>
    </div>
  </header>
  <main id="main-content" tabindex="-1" class="layout">
    {@render children()}
  </main>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <div>
        <a href="/" class="jelementi-wordmark">Jelementi</a>
        <p>Curious, careful stories from nearby and far away.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="/">Home</a>
        <a href="/categories">Categories</a>
        <a href="/search">Search</a>
        <a href="/about">About</a>
        <a href="/podcast.xml">Podcast</a>
      </nav>
    </div>
  </footer>
</div>

<style>
  .site-header {
    border-bottom: 1px solid var(--foundation-rule);
  }
  .site-header__inner,
  .site-footer__inner {
    width: min(81rem, calc(100% - 2.75rem));
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem 2rem;
    flex-wrap: wrap;
    padding: 1rem 0;
  }
  .jelementi-wordmark {
    font-family: var(--font-sans);
    font-size: 2.125rem;
    font-weight: 650;
    letter-spacing: -0.065em;
    line-height: 1.1;
  }
  .site-tagline {
    display: none;
    margin: 0;
    color: var(--foundation-muted);
    font-size: 1.125rem;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 0.5rem 1.75rem;
    flex-wrap: wrap;
  }
  nav a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--foundation-ink);
    font-size: 0.875rem;
    text-decoration: none;
  }
  nav a:hover,
  nav a[aria-current='page'] {
    color: var(--foundation-link);
    text-decoration: underline;
  }
  .reader-home .site-header__inner {
    padding-top: 2rem;
  }
  .reader-home .site-header .jelementi-wordmark {
    font-size: clamp(3rem, 7.5vw, 6.25rem);
  }
  .reader-home .site-tagline {
    display: block;
  }
  .reader-home .site-header nav {
    width: 100%;
    border-top: 1px solid var(--foundation-rule);
    padding-block: 0.25rem;
  }
  .reader-home .site-header nav a:last-child {
    margin-left: auto;
  }
  .site-footer {
    margin-top: 2rem;
  }
  .site-footer__inner {
    border-top: 1px solid var(--foundation-rule);
    padding-block: 2.5rem;
  }
  .site-footer p {
    font-size: 0.875rem;
    color: var(--foundation-muted);
  }
  @media (max-width: 600px) {
    .site-header__inner {
      gap: 0.75rem;
      padding: 1.375rem 0 0;
    }
    .site-header .jelementi-wordmark {
      font-size: 1.8125rem;
    }
    .reader-home .site-header .jelementi-wordmark {
      font-size: 2.75rem;
    }
    .reader-home .site-tagline {
      display: none;
    }
    .site-header nav,
    .reader-home .site-header nav {
      width: 100%;
      gap: 0.25rem 1rem;
      border: 0;
      justify-content: space-between;
    }
    .reader-home .site-header nav a:last-child {
      margin-left: 0;
    }
    .site-footer__inner {
      align-items: flex-start;
    }
  }
</style>
