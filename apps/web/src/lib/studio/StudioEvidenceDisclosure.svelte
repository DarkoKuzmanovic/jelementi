<script lang="ts">
  import type { StudioWorkspaceProjection } from '$lib/studio/workspace-projection';

  /**
   * StudioEvidenceDisclosure — a native `<details>` progressive disclosure
   * of the sanitized evidence rows the server-authored projection carries
   * (SHAs, Draft PR, check, branch preview, deployment, probe evidence).
   * No JS required to open it; ordinary form submission and no-JS
   * navigation both work against this markup.
   */
  let { projection }: { projection: StudioWorkspaceProjection } = $props();
</script>

<details class="studio-evidence-disclosure">
  <summary>Evidence</summary>
  {#if projection.evidence.length === 0}
    <p>No evidence recorded yet.</p>
  {:else}
    <dl>
      {#each projection.evidence as row, index (index)}
        <dt>{row.label}</dt>
        <dd>
          {#if row.url}
            <a href={row.url}>{row.value}</a>
          {:else}
            {row.value}
          {/if}
        </dd>
      {/each}
    </dl>
  {/if}
</details>
