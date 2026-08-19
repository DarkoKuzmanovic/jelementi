<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} — Jelementi</title>
</svelte:head>
<section aria-labelledby="error-heading">
  <h1 id="error-heading">{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
  <p>
    {page.status === 404
      ? 'The page you requested is not available.'
      : page.error?.message || 'Please try again later.'}
  </p>
  <p><a href="/">Return to the reader</a></p>
</section>
