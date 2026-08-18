import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  loadNewStudioEditorPage,
  previewStudioEditorAction,
  saveStudioEditorAction,
  type StudioEditorRouteEvent,
} from '../../../../lib/server/studio/editor-route.server';
import type { StudioEditorData } from '../../../../lib/server/studio/editor.server';

export const prerender = false;
// CSR opt-in for #78: the named new-article page is one of exactly three
// hydrated Studio routes (Flowboard, this page, and the existing article
// page). +layout.server.ts stays `csr = false`; public reader routes and
// unlisted Studio routes remain non-hydrated. The page keeps full
// no-JavaScript form operation — enhancement is transport only.
export const csr = true;

export const load: PageServerLoad<{ editor: StudioEditorData }> = async (event) =>
  loadNewStudioEditorPage(eventForEditorRoute(event));

export const actions: Actions = {
  preview: (event) => previewStudioEditorAction(eventForEditorRoute(event)),
  save: (event) => saveStudioEditorAction(eventForEditorRoute(event)),
};

function eventForEditorRoute(event: {
  request: Request;
  platform?: App.Platform;
  locals: App.Locals;
}): StudioEditorRouteEvent {
  return {
    request: event.request,
    platform: event.platform,
    locals: event.locals as Record<string, unknown>,
  };
}
