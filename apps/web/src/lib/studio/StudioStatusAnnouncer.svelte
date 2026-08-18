<script lang="ts">
  /**
   * StudioStatusAnnouncer — one polite status region and one assertive
   * error-summary region (#73). Ordinary typing is never announced: this
   * component only ever renders text explicitly passed to it by a server-
   * authored projection, never live input echo.
   */
  let {
    politeMessage = '',
    assertiveMessage = '',
  }: { politeMessage?: string; assertiveMessage?: string } = $props();
</script>

<p class="studio-status-announcer-polite" role="status" aria-live="polite">{politeMessage}</p>
<p class="studio-status-announcer-assertive" role="alert" aria-live="assertive">
  {assertiveMessage}
</p>
