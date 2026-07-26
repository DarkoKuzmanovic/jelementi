<script lang="ts">
  import { sampleArticle } from '@jelementi/article-model';
</script>

<section class="home">
  <h1>Jelementi</h1>
  <p class="lede">Unlisted beta.</p>
  <ul class="article-list">
    <li>
      <a href={`/articles/${sampleArticle.slug}`}>{sampleArticle.title}</a>
      <p>{sampleArticle.excerpt}</p>
    </li>
  </ul>
</section>
