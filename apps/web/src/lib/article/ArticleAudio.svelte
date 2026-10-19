<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';

  let { article }: { article: ArticleDocument } = $props();
</script>

{#if article.audio}
  <section id="article-audio" class="article-audio" aria-label={`Audio for ${article.title}`}>
    <audio
      controls
      preload="metadata"
      src={article.audio.src}
      aria-label={`Audio for ${article.title}`}
    >
      <a href={article.audio.src}>Listen to the audio for {article.title}</a>
    </audio>
  </section>
{/if}

<style>
  .article-audio {
    margin: 0 auto 2.5rem;
    max-width: var(--article-prose-width, 39rem);
    padding: 1rem;
    background: var(--foundation-accent-soft);
    color: var(--foundation-muted);
    font-size: var(--text-small);
  }

  .article-audio audio {
    width: 100%;
    max-width: 100%;
    display: block;
  }
</style>
