<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';

  let { children, topics = [] }: { children: Snippet; topics?: { name: string; slug: string }[] } =
    $props();

  function isCurrent(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<div
  class="reader-surface"
  class:reader-home={page.url.pathname === '/'}
  class:reader-topics={page.url.pathname === '/' && topics.length > 0}
>
  <a class="skip-link" href="#reader:main">Skip to main content</a>
  <header class="site-header">
    <div class="site-header__inner">
      <a href="/" class="jelementi-wordmark">Jelementi</a>
      <p class="site-tagline">Curious, careful stories<br />from nearby and far away.</p>
      <nav aria-label="Primary navigation">
        <a href="/" aria-current={isCurrent('/') ? 'page' : undefined}>Home</a>
        {#if page.url.pathname === '/'}
          {#each topics as topic (topic.slug)}
            <a class="topic-shortcut" href={`/categories/${topic.slug}`}>{topic.name}</a>
          {/each}
        {/if}
        <a
          class="topic-directory"
          href="/categories"
          aria-current={isCurrent('/categories') ? 'page' : undefined}>Categories</a
        >
        <a class="nav-utility" href="/podcast.xml">Podcast</a>
        <a href="/about" aria-current={isCurrent('/about') ? 'page' : undefined}>About</a>
        <a href="/search" aria-current={isCurrent('/search') ? 'page' : undefined}>Search</a>
      </nav>
    </div>
  </header>
  <main id="reader:main" tabindex="-1" class="layout">
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
