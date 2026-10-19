<script lang="ts">
  import { articleAudioAnchor } from './audio-anchor';
  import type { ArticleDocument } from '@jelementi/article-model';

  let { article }: { article: ArticleDocument } = $props();
</script>

{#if article.audio}
  <section id={articleAudioAnchor} class="article-audio" aria-label={`Audio for ${article.title}`}>
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
