<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<section aria-labelledby="studio-home-heading">
  <div class="studio-page-heading">
    <div>
      <p class="eyebrow">Canonical content</p>
      <h2 id="studio-home-heading">Articles</h2>
    </div>
    <a href="/studio/articles/new">New article</a>
  </div>

  {#if data.articles.length === 0}
    <p>No canonical articles found.</p>
  {:else}
    <ul class="studio-article-list">
      {#each data.articles as article (article.slug)}
        <li>
          <div class="studio-article-heading">
            <div>
              <h3><a href={`/studio/articles/${article.slug}`}>{article.title}</a></h3>
              <p class="studio-slug">{article.slug}</p>
            </div>
            <span class="studio-status">{article.canonicalStatus}</span>
          </div>
          <dl class="studio-state-list">
            <div>
              <dt>Production</dt>
              <dd>{article.production}</dd>
            </div>
            <div>
              <dt>Change</dt>
              <dd>{article.change}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{article.updatedAt}</dd>
            </div>
          </dl>
          <nav aria-label={`Evidence for ${article.slug}`}>
            {#if article.publicUrl}<a href={article.publicUrl}>Public article</a>{/if}
            {#if article.pullRequest}<a href={article.pullRequest.url}>Pull request</a>{/if}
            {#if article.branch}<a href={article.branch.url}>Studio branch</a>{/if}
            {#if article.check?.url}<a href={article.check.url}>Verify check</a>{/if}
            {#if article.branchPreviewUrl}<a href={article.branchPreviewUrl}>Branch preview</a>{/if}
            {#if article.buildUrl}<a href={article.buildUrl}>Build evidence</a>{/if}
          </nav>
        </li>
      {/each}
    </ul>
  {/if}
</section>
