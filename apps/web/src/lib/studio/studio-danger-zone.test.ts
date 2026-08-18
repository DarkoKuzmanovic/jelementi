import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';

/**
 * SSR output preserves the .svelte source's line wraps, and Prettier may re-wrap
 * long copy at any point. Collapse whitespace before asserting on prose phrases
 * so copy assertions never depend on where a line happens to break.
 */
const flatten = (html: string): string => html.replace(/\s+/g, ' ');
import StudioDangerZone from './StudioDangerZone.svelte';
import StudioDestructiveConfirmation from './StudioDestructiveConfirmation.svelte';
import StudioPublishPanel from './StudioPublishPanel.svelte';
import StudioDraftDiscardedNotice from './StudioDraftDiscardedNotice.svelte';
import type { StudioIndexEvidence, StudioLifecycle } from './contracts';

const article = {
  slug: 'tristan-da-cunha',
  title: 'Tristan da Cunha',
  status: 'published',
  updatedAt: '2026-08-01',
} as const;

const evidence: StudioIndexEvidence = {
  slug: article.slug,
  title: article.title,
  excerpt: 'A remote island.',
  publishedAt: '2026-07-01',
  updatedAt: article.updatedAt,
  category: 'Ideas',
  categorySlug: 'ideas',
  tags: ['islands'],
  author: 'Jelementi',
  cover: { src: 'articles/tristan-da-cunha/cover-v1.svg', alt: 'An island' },
  readingTimeMinutes: 4,
};

const live: StudioLifecycle = {
  kind: 'live',
  article,
  mainSha: 'a'.repeat(40),
  contentVersion: 'c'.repeat(64),
  expected: evidence,
  observed: evidence,
};

const ready: StudioLifecycle = {
  kind: 'ready',
  article,
  pullRequest: {
    number: 7,
    url: 'https://github.com/example/example/pull/7',
    headSha: 'd'.repeat(40),
  },
};

const archived: StudioLifecycle = {
  kind: 'archived',
  article,
  mainSha: 'a'.repeat(40),
};

describe('StudioDangerZone', () => {
  it('renders a labelled disclosure with a complete inline no-JS Unpublish confirmation for a live article', () => {
    const { body } = render(StudioDangerZone, { props: { status: live } });

    expect(body).toContain('<details');
    expect(body).toContain('Danger zone');
    expect(body).toContain('separate from ordinary writing');
    expect(body).toContain('action="?/unpublish"');
    expect(body).toContain('Unpublish starts an archive change');
    expect(body).toContain('Readers may continue to see this article');
    expect(body).toContain('to archive this article');
    expect(body).toContain('id="unpublish-confirmation"');
    expect(body).toContain('name="confirmation"');
    expect(body).toContain('>Unpublish</button>');
    // The no-JS submit must not ship disabled: the server owns validation.
    expect(body).not.toContain('disabled=""');
    // A live article has no unmerged Draft PR, so Discard is absent.
    expect(body).not.toContain('action="?/discard"');
  });

  it('offers Discard with the expected head and Draft PR link for an approved (ready) PR per ADR-0008', () => {
    const { body } = render(StudioDangerZone, { props: { status: ready } });

    expect(body).toContain('action="?/discard"');
    expect(body).toContain('name="expectedHeadSha"');
    expect(body).toContain(`value="${'d'.repeat(40)}"`);
    expect(body).toContain('href="https://github.com/example/example/pull/7"');
    // The issue requires the copy to promise that only the sole exact
    // unmerged Draft PR for this branch closes — never "a" PR in general.
    expect(flatten(body)).toContain(
      'Discard closes only the sole exact unmerged Draft PR for <code>studio/article/tristan-da-cunha</code>',
    );
    expect(body).toContain('<code>studio/article/tristan-da-cunha</code>');
    expect(body).toContain('to discard this draft');
    expect(body).toContain('id="discard-confirmation"');
    expect(body).toContain('>Discard draft</button>');
    // An approved PR is also still unpublishable (retry after stalled auto-merge).
    expect(body).toContain('action="?/unpublish"');
  });

  it('renders nothing for an archived article with no destructive action available', () => {
    const { body } = render(StudioDangerZone, { props: { status: archived } });

    expect(body).not.toContain('<details');
    expect(body).not.toContain('Danger zone');
  });

  it('states reader effect and work safety for every destructive outcome', () => {
    const submitted = render(StudioDangerZone, {
      props: {
        status: live,
        unpublish: {
          kind: 'unpublish_submitted',
          commitSha: 'e'.repeat(40),
          pullRequest: {
            number: 9,
            url: 'https://github.com/example/example/pull/9',
          },
        },
      },
    }).body;
    expect(flatten(submitted)).toContain('Readers may continue to see');
    expect(flatten(submitted)).toContain('other Studio work is untouched');

    const conflict = render(StudioDangerZone, {
      props: {
        status: live,
        unpublish: {
          kind: 'unpublish_conflict',
          expectedHeadSha: 'a'.repeat(40),
          currentHeadSha: 'b'.repeat(40),
        },
      },
    }).body;
    // A conflict can surface after auto-merge transport ambiguity with branch
    // disappearance, so the copy scopes claims to this attempt and must not
    // vouch for reader state — Check status owns that truth.
    expect(flatten(conflict)).toContain('made no further change');
    expect(flatten(conflict)).toContain('Studio has not verified what readers currently see');
    expect(flatten(conflict)).toContain('Check status for the true published state');
    expect(flatten(conflict)).toContain('other Studio work is untouched');
    expect(flatten(conflict)).not.toContain('Nothing reached');
    expect(flatten(conflict)).not.toContain('readers still see the article as before');

    const rejected = render(StudioDangerZone, {
      props: {
        status: live,
        unpublish: {
          kind: 'unpublish_rejected',
          compileIssues: [{ code: 'X', message: 'bad', sourcePath: 'content/articles/a.md' }],
        },
      },
    }).body;
    expect(flatten(rejected)).toContain('readers still see the article');
    expect(flatten(rejected)).toContain('other Studio work is untouched');

    const blockedDraft = render(StudioDangerZone, {
      props: {
        status: live,
        unpublish: { kind: 'unpublish_blocked', reason: 'differing-draft' },
      },
    }).body;
    expect(flatten(blockedDraft)).toContain('never overwrites it');
    expect(flatten(blockedDraft)).toContain('readers still see the published article');

    const blockedUnpublished = render(StudioDangerZone, {
      props: {
        status: live,
        unpublish: { kind: 'unpublish_blocked', reason: 'not-published' },
      },
    }).body;
    expect(flatten(blockedUnpublished)).toContain('Nothing changed');
    expect(flatten(blockedUnpublished)).toContain('Studio work is untouched');
    // Canonical absence on main does not prove deployed absence: the copy
    // must say reader state is unverified and Check status owns the truth.
    expect(flatten(blockedUnpublished)).toContain('Absence from <code>main</code>');
    expect(flatten(blockedUnpublished)).toContain('Check status to verify the deployed state');

    // A github-reason failure can strike AFTER real steps succeeded (archive
    // commit, ready flip) and auto-merge transport ambiguity means Studio
    // cannot prove main unchanged — the copy must claim only what is
    // confirmed and admit surviving partial state.
    const failed = render(StudioDangerZone, {
      props: {
        status: live,
        unpublish: { kind: 'unpublish_failed', phase: 'auto-merge', reason: 'github' },
      },
    }).body;
    expect(flatten(failed)).toContain('No merge has been verified');
    expect(flatten(failed)).toContain('readers may still see the article');
    expect(flatten(failed)).toContain('Steps that had already succeeded');
    expect(flatten(failed)).toContain('other Studio work is untouched');
    expect(flatten(failed)).not.toContain('<code>main</code> is unchanged');

    const failedTopology = render(StudioDangerZone, {
      props: {
        status: live,
        unpublish: { kind: 'unpublish_failed', phase: 'branch', reason: 'topology' },
      },
    }).body;
    expect(flatten(failedTopology)).toContain('approved no merge');
    expect(flatten(failedTopology)).toContain('Check status for the true published state');
    expect(flatten(failedTopology)).toContain('other Studio work is untouched');

    const discarded = render(StudioDangerZone, {
      props: {
        status: ready,
        discard: {
          kind: 'discarded',
          pullRequest: {
            number: 7,
            url: 'https://github.com/example/example/pull/7',
          },
        },
      },
    }).body;
    expect(flatten(discarded)).toContain('readers are unaffected');

    const discardFailed = render(StudioDangerZone, {
      props: {
        status: ready,
        discard: { kind: 'discard_failed', phase: 'delete-branch', reason: 'github' },
      },
    }).body;
    expect(flatten(discardFailed)).toContain('published article are unchanged');
    expect(flatten(discardFailed)).toContain('readers are unaffected');
    expect(flatten(discardFailed)).toContain('the remaining step');
    // A delete-branch partial failure comes after the PR close (ADR-0008
    // close-before-delete), so the copy must admit the PR may already be closed.
    expect(flatten(discardFailed)).toContain('already closed the Draft PR, it stays closed');

    const discardFailedTopology = render(StudioDangerZone, {
      props: {
        status: ready,
        discard: { kind: 'discard_failed', phase: 'pull-request', reason: 'topology' },
      },
    }).body;
    expect(flatten(discardFailedTopology)).toContain('never touches <code>main</code>');
    expect(flatten(discardFailedTopology)).toContain('readers are unaffected');
    // Topology can be reported on a retry after a prior attempt already
    // closed the Draft PR (ADR-0008 close-before-delete): disclose that
    // possibly-surviving partial state.
    expect(flatten(discardFailedTopology)).toContain(
      'already closed the Draft PR, it stays closed',
    );
    expect(flatten(discardFailedTopology)).toContain('only the branch deletion may remain');

    // A delete-branch topology failure can follow THIS attempt's own PR
    // close (close-before-delete), so the copy must admit the current
    // attempt — not only an earlier one — may have closed the PR, and must
    // state other-work safety, not only main/reader effect.
    const discardFailedDeleteTopology = render(StudioDangerZone, {
      props: {
        status: ready,
        discard: { kind: 'discard_failed', phase: 'delete-branch', reason: 'topology' },
      },
    }).body;
    expect(flatten(discardFailedDeleteTopology)).toContain(
      'this or an earlier attempt had already closed the Draft PR, it stays closed',
    );
    expect(flatten(discardFailedDeleteTopology)).toContain('only the branch deletion may remain');
    expect(flatten(discardFailedDeleteTopology)).toContain('other Studio work is untouched');
    expect(flatten(discardFailedDeleteTopology)).toContain('readers are unaffected');
  });

  it('presents the unpublish_submitted outcome with sanitized evidence and reader effect', () => {
    const { body } = render(StudioDangerZone, {
      props: {
        status: live,
        unpublish: {
          kind: 'unpublish_submitted',
          commitSha: 'e'.repeat(40),
          pullRequest: {
            number: 9,
            url: 'https://github.com/example/example/pull/9',
          },
        },
      },
    });

    expect(body).toContain('Unpublish submitted');
    expect(body).toContain('e'.repeat(40));
    expect(body).toContain('href="https://github.com/example/example/pull/9"');
  });

  it('states discard-conflict effects truthfully: nothing deleted by this attempt, readers safe', () => {
    const { body } = render(StudioDangerZone, {
      props: {
        status: ready,
        discard: {
          kind: 'discard_conflict',
          expectedHeadSha: 'd'.repeat(40),
          currentHeadSha: 'f'.repeat(40),
        },
      },
    });
    const flat = flatten(body);

    // A discard_conflict can arise before anything happened (stale head), from
    // the delete-branch race after the PR was already closed (ADR-0008
    // close-before-delete), or with the branch already gone entirely — so the
    // copy scopes every claim to THIS attempt and never asserts the branch
    // still exists or that no content was lost.
    expect(flat).toContain('this attempt deleted nothing');
    expect(flat).not.toContain('the branch was not deleted');
    expect(flat).not.toContain('no draft content was lost');
    expect(flat).toContain('already closed the Draft PR before the head moved');
    expect(flat).toContain('readers are unaffected');
    expect(body).toContain('d'.repeat(40));
    expect(body).toContain('f'.repeat(40));
  });

  it('handles a discard-conflict with the branch already gone: shows branch not found', () => {
    const { body } = render(StudioDangerZone, {
      props: {
        status: ready,
        discard: {
          kind: 'discard_conflict',
          expectedHeadSha: 'd'.repeat(40),
          currentHeadSha: null,
        },
      },
    });
    const flat = flatten(body);

    expect(flat).toContain('branch not found');
    expect(flat).toContain('this attempt deleted nothing');
    expect(flat).toContain('removed outside this attempt');
  });

  it('server-renders no dialog: the modal is a JS-only enhancement over the inline form', () => {
    const { body } = render(StudioDangerZone, { props: { status: ready } });

    expect(body).not.toContain('<dialog');
    expect(body).toContain('method="POST"');
  });

  it('presents the discarded outcome scoped to the exact PR and branch with main unchanged', () => {
    const { body } = render(StudioDangerZone, {
      props: {
        status: ready,
        discard: {
          kind: 'discarded',
          pullRequest: {
            number: 7,
            url: 'https://github.com/example/example/pull/7',
          },
        },
      },
    });

    expect(body).toContain('Draft discarded');
    expect(body).toContain('<code>studio/article/tristan-da-cunha</code>');
    expect(body).toContain('<code>main</code> is unchanged');
  });
});

describe('StudioPublishPanel destructive narratives', () => {
  it('describes unpublish_pending as removing: readers may still see the article, other work safe', () => {
    const { body } = render(StudioPublishPanel, {
      props: {
        status: { kind: 'unpublish_pending', article, mainSha: 'a'.repeat(40) },
      },
    });

    expect(body).toContain('Unpublish is in flight');
    expect(body).toContain('Readers may still see');
    expect(body).toContain('Check status');
    expect(body).toContain('other Studio work is');
  });

  it('describes archived as removed-and-verified: absent from index and article route', () => {
    const { body } = render(StudioPublishPanel, {
      props: {
        status: { kind: 'archived', article, mainSha: 'a'.repeat(40) },
      },
    });

    const flat = flatten(body);
    expect(flat).toContain('Archived on <code>main</code>');
    expect(flat).toContain('public index');
    expect(flat).toContain('article route');
    expect(flat).toContain('readers no longer see it');
    expect(flat).toContain('other Studio work is untouched');
  });
});

describe('StudioDraftDiscardedNotice', () => {
  it('announces the Flowboard landing outcome: work removed safely, readers unaffected', () => {
    const { body } = render(StudioDraftDiscardedNotice, { props: {} });
    const flat = flatten(body);

    expect(body).toContain('role="status"');
    expect(flat).toContain('Draft discarded');
    expect(flat).toContain('Draft PR was closed');
    expect(flat).toContain('branch deleted');
    expect(flat).toContain('No published article changed');
    expect(flat).toContain('cannot see the discarded draft');
  });
});

describe('StudioDestructiveConfirmation', () => {
  const description = createRawSnippet(() => ({
    render: () => '<p>Consequence copy visible without JS.</p>',
  }));

  it('server-renders a complete inline confirmation: consequence copy, labelled typed-slug input, real submit', () => {
    const { body } = render(StudioDestructiveConfirmation, {
      props: {
        action: '?/unpublish',
        slug: 'tristan-da-cunha',
        idPrefix: 'unpublish',
        invokeLabel: 'Unpublish',
        title: 'Unpublish this article?',
        confirmPrompt: 'to archive this article',
        description,
      },
    });

    expect(body).toContain('Consequence copy visible without JS.');
    expect(body).toContain('method="POST"');
    expect(body).toContain('action="?/unpublish"');
    expect(body).toContain('for="unpublish-confirmation"');
    expect(body).toContain('id="unpublish-confirmation"');
    expect(body).toContain('name="confirmation"');
    expect(body).toContain('autocomplete="off"');
    expect(body).toContain('<code>tristan-da-cunha</code>');
    expect(body).toContain('to archive this article');
    expect(body).toContain('>Unpublish</button>');
    expect(body).not.toContain('name="expectedHeadSha"');
    expect(body).not.toContain('disabled');
  });

  it('carries expectedHeadSha as a hidden field only when provided', () => {
    const { body } = render(StudioDestructiveConfirmation, {
      props: {
        action: '?/discard',
        slug: 'tristan-da-cunha',
        idPrefix: 'discard',
        invokeLabel: 'Discard draft',
        title: 'Discard this draft?',
        confirmPrompt: 'to discard this draft',
        expectedHeadSha: 'd'.repeat(40),
        description,
      },
    });

    expect(body).toContain('type="hidden"');
    expect(body).toContain('name="expectedHeadSha"');
    expect(body).toContain(`value="${'d'.repeat(40)}"`);
  });
});
