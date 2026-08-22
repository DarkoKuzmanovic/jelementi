<script lang="ts">
  import { formatStudioVerifiedAt, type StudioWorkspaceProjection } from './workspace-projection';

  /**
   * StudioLifecycleSummary — renders the plain-language summary and the two
   * lifecycle axes (Published version, Working change) kept editorially
   * separate (#73). Consumes only the server-authored projection; it never
   * derives lifecycle truth itself.
   */
  let { projection }: { projection: StudioWorkspaceProjection } = $props();

  // #116: a verified outcome shows when it was verified, so "Live and
  // verified" stays visibly bounded in time ("Live — verified <time>").
  const verifiedAt = $derived(formatStudioVerifiedAt(projection.publishedVersion.verifiedAt));
</script>

<section class="studio-lifecycle-summary" aria-labelledby="studio-lifecycle-summary-heading">
  <h3 id="studio-lifecycle-summary-heading">Lifecycle summary</h3>
  <p>{projection.summary}</p>
  <p><strong>Recommended:</strong> {projection.recommendedAction}</p>

  <div class="studio-lifecycle-summary__axis">
    <div>
      <p class="studio-lifecycle-summary__axis-title">Published version</p>
      <p class="studio-lifecycle-summary__label">
        <span>{projection.publishedVersion.label}</span>{#if verifiedAt}<span
            >&nbsp;· verified {verifiedAt}</span
          >{/if}
      </p>
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
