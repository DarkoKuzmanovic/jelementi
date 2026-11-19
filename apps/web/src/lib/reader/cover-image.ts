/** Cover sources come from R2 at full size (2–4 MB PNG); Cloudflare resizes them at the edge. */
// shortcut: only the production media host has image transformations on; other hosts (fixtures, local media) stay as is.
const RESIZABLE_HOST = 'media.jelementi.quz.ma';
const WIDTHS = [400, 800, 1400];

function resized(src: string, width: number): string | undefined {
  const url = new URL(src);
  return url.hostname === RESIZABLE_HOST
    ? `${url.origin}/cdn-cgi/image/width=${width},format=auto${url.pathname}`
    : undefined;
}

/** `src`/`srcset`/`sizes` for a cover `<img>`; `sizes` is the rendered width, e.g. `(max-width: 760px) 104px, 282px`. */
export function coverImage(
  src: string,
  sizes: string,
): { src: string; srcset?: string; sizes?: string } {
  const middle = resized(src, 800);
  return middle === undefined
    ? { src }
    : { src: middle, srcset: WIDTHS.map((w) => `${resized(src, w)} ${w}w`).join(', '), sizes };
}
