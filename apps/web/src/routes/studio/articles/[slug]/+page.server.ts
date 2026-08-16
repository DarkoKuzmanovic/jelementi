import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  loadStudioEditorPage,
  previewStudioEditorAction,
  saveStudioEditorAction,
  type StudioEditorRouteEvent,
} from '../../../../lib/server/studio/editor-route.server';
import type { StudioEditorData } from '../../../../lib/server/studio/editor.server';

export const prerender = false;
export const csr = false;

export const load: PageServerLoad<{ editor: StudioEditorData }> = async (event) =>
  loadStudioEditorPage(eventForEditorRoute(event), event.params.slug);

export const actions: Actions = {
  preview: (event) => previewStudioEditorAction(eventForEditorRoute(event), event.params.slug),
  save: (event) => saveStudioEditorAction(eventForEditorRoute(event), event.params.slug),
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
