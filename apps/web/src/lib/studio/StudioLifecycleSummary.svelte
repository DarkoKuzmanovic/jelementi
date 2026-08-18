<script lang="ts">
  import type { StudioWorkspaceProjection } from '$lib/studio/workspace-projection';

  /**
   * StudioLifecycleSummary — renders the plain-language summary and the two
   * lifecycle axes (Published version, Working change) kept editorially
   * separate (#73). Consumes only the server-authored projection; it never
   * derives lifecycle truth itself.
   */
  let { projection }: { projection: StudioWorkspaceProjection } = $props();
</script>

<section class="studio-lifecycle-summary" aria-labelledby="studio-lifecycle-summary-heading">
  <h3 id="studio-lifecycle-summary-heading">Lifecycle summary</h3>
  <p>{projection.summary}</p>
  <p><strong>Recommended:</strong> {projection.recommendedAction}</p>

  <div class="studio-lifecycle-summary__axis">
    <div>
      <p class="studio-lifecycle-summary__axis-title">Published version</p>
      <p class="studio-lifecycle-summary__label">{projection.publishedVersion.label}</p>
    </div>
    <div>
      <p class="studio-lifecycle-summary__axis-title">Working change</p>
      <p class="studio-lifecycle-summary__label">{projection.workingChange.label}</p>
    </div>
  </div>

  <p class="studio-lifecycle-summary__reader-effect">{projection.readerEffect}</p>

  <!-- Always visible, never gated behind Evidence disclosure (#72: "validation
       failure and Publish blocking never [hide behind Evidence]"). -->
  <p class="studio-lifecycle-summary__validation">{projection.validationSummary}</p>
</section>
