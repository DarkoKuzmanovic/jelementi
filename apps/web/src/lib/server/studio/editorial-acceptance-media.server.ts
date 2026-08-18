const ACCEPTANCE_MEDIA_ORIGIN = 'https://media.studio-acceptance.invalid';
const ARTICLE_MEDIA_PATH = /^\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * #75-owned deterministic media preflight transport for browser acceptance.
 * The article route injects it only behind #73's exact acceptance-mode
 * predicate. Production continues to use Publish's default network transport.
 */
export async function studioEditorialAcceptanceMediaFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);
  if (request.method !== 'HEAD') return new Response(null, { status: 405 });

  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return new Response(null, { status: 404 });
  }
  if (url.origin !== ACCEPTANCE_MEDIA_ORIGIN || !ARTICLE_MEDIA_PATH.test(url.pathname)) {
    return new Response(null, { status: 404 });
  }

  return new Response(null, { status: 200 });
}
