<script lang="ts">
  import type { ArticleDocument } from '@jelementi/article-model';

  let { article }: { article: ArticleDocument } = $props();
</script>

{#if article.audio}
  <section class="article-audio" aria-label={`Audio for ${article.title}`}>
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
    margin: var(--space-4) 0;
    color: var(--foundation-muted);
    font-size: var(--text-small);
  }

  .article-audio audio {
    max-width: 100%;
  }
</style>
