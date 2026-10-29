<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';
  import { categoryHue } from '../../lib/reader/category-hues';
  import { formatPublishedDate } from '../../lib/article/format-date';

  let {
    children,
    topics = [],
    storyCount = 0,
    categoryCount = 0,
    newestPublishedAt,
  }: {
    children: Snippet;
    topics?: { name: string; slug: string }[];
    storyCount?: number;
    categoryCount?: number;
    newestPublishedAt?: string;
  } = $props();
  const home = $derived(page.url.pathname === '/');
  function isCurrent(href: string): boolean {
    return page.url.pathname === href;
  }
</script>

{#snippet searchIcon()}
  <svg
    aria-hidden="true"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"><circle cx="7" cy="7" r="6" /><path d="m11.5 11.5 4.5 4.5" /></svg
  >
{/snippet}
{#snippet brand()}
  <a href="/" class="jelementi-wordmark" aria-current={home ? 'page' : undefined}>Jelementi</a>
{/snippet}
<div class="reader-surface" class:reader-home={home}>
  <a class="skip-link" href="#reader:main">Skip to main content</a>
  <header class="site-header">
    {#if home}
      <div class="site-utility">
        <div class="shell-width">
          <span
            >{#if newestPublishedAt}Updated {formatPublishedDate(newestPublishedAt)}{/if}</span
          >
          <span
            >{storyCount} stories in {categoryCount === 5 ? 'five' : categoryCount} section{categoryCount ===
            1
              ? ''
              : 's'} · read or listen</span
          >
        </div>
      </div>
      <div class="home-masthead shell-width">
        {@render brand()}
        <p class="site-tagline">Curious, careful stories<br />from nearby and far away.</p>
      </div>
    {/if}
    <div class="mobile-masthead shell-width">
      {@render brand()}<a
        class="mobile-search"
        class:active={isCurrent('/search')}
        href="/search"
        aria-label="Search"
        aria-current={isCurrent('/search') ? 'page' : undefined}>{@render searchIcon()}</a
      >
    </div>
    <nav class="site-header__inner shell-width" aria-label="Primary navigation">
      {#if !home}<div class="compact-brand">{@render brand()}</div>{/if}
      <div class="nav-sections">
        {#each topics as topic (topic.slug)}
          <a
            style={`--hue: ${categoryHue(topic.slug)}`}
            href={`/categories/${topic.slug}`}
            aria-current={isCurrent(`/categories/${topic.slug}`) ? 'page' : undefined}
            ><span class="hue-dot"></span>{topic.name}</a
          >
        {/each}
      </div>
      <div class="nav-tools">
        <a href="/#series">Series</a><a href="/podcast.xml">Podcast</a><a
          href="/about"
          aria-current={isCurrent('/about') ? 'page' : undefined}>About</a
        >
        <form
          class="nav-search"
          class:active={isCurrent('/search')}
          role="search"
          aria-label="Navigation search"
          action="/search"
          method="get"
          data-sveltekit-reload
        >
          <button type="submit" aria-label="Find stories">{@render searchIcon()}</button>
          <input
            type="search"
            name="query"
            aria-label="Search stories"
            placeholder={`Search ${storyCount} stories`}
          />
        </form>
      </div>
    </nav>
  </header>
  <main id="reader:main" tabindex="-1" class="layout">{@render children()}</main>
  <footer class="site-footer">
    <div class="site-footer__inner shell-width">
      <div class="site-footer__top">
        <div class="footer-brand">
          {@render brand()}
          <p>Curious, careful stories from nearby and far away.</p>
        </div>
        <nav aria-label="Footer navigation">
          <div>
            <h2>Read</h2>
            <a href="/" aria-current={home ? 'page' : undefined}>Home</a><a
              href="/categories"
              aria-current={isCurrent('/categories') ? 'page' : undefined}>Sections</a
            ><a href="/#series">Series</a><a
              href="/search"
              aria-current={isCurrent('/search') ? 'page' : undefined}>Search</a
            >
          </div>
          <div>
            <h2>Listen</h2>
            <a href="/podcast.xml">Podcast</a><a href="/podcast.xml">Podcast RSS</a>
          </div>
          <div>
            <h2>About</h2>
            <a href="/about" aria-current={isCurrent('/about') ? 'page' : undefined}>About</a><a
              href="/feed.xml">Article feed</a
            >
          </div>
        </nav>
      </div>
      <p class="footer-note">Every story lists its sources.</p>
    </div>
  </footer>
</div>
