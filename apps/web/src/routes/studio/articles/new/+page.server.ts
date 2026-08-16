import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  loadNewStudioEditorPage,
  previewStudioEditorAction,
  type StudioEditorRouteEvent,
} from '../../../../lib/server/studio/editor-route.server';
import type { StudioEditorData } from '../../../../lib/server/studio/editor.server';

export const prerender = false;
export const csr = false;

export const load: PageServerLoad<{ editor: StudioEditorData }> = async (event) =>
  loadNewStudioEditorPage(eventForEditorRoute(event));

export const actions: Actions = {
  preview: (event) => previewStudioEditorAction(eventForEditorRoute(event)),
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
