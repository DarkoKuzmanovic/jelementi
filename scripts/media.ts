import type { ContentBatch } from './content';

export const productionMediaOrigin = 'https://media.jelementi.quz.ma';
export const immutableCacheControl = 'public, max-age=31536000, immutable';

const mimeByExtension = {
  svg: 'image/svg+xml',
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
} as const;

const mediaKeyPattern =
  /^articles\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*-v[1-9]\d*\.(svg|webp|png|jpg|jpeg|mp3|m4a)$/;

export type MediaExtension = keyof typeof mimeByExtension;

export interface MediaResponse {
  status: number;
  headers: Pick<Headers, 'get'>;
  url?: string;
}

export interface MediaFetchOptions {
  method: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  redirect: 'manual';
  cache?: 'no-store';
}

export type MediaFetch = (url: string, options: MediaFetchOptions) => Promise<MediaResponse>;

export interface MediaProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type MediaProcessRunner = (command: string, args: string[]) => Promise<MediaProcessResult>;

export interface MediaFileStats {
  isFile(): boolean;
  size: number;
}

export type MediaStatFile = (path: string) => Promise<MediaFileStats>;

export interface MediaKeyDetails {
  extension: MediaExtension;
  mimeType: string;
}

export interface UploadMediaOptions {
  file: string;
  key: string;
  contentType: string;
  mediaBaseUrl: string;
  fetch: MediaFetch;
  run: MediaProcessRunner;
  statFile: MediaStatFile;
  cacheBust?: () => string;
}

export interface VerifyMediaOptions {
  fetch: MediaFetch;
}

export interface VerifyPublishedMediaOptions extends VerifyMediaOptions {
  batch: ContentBatch;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mediaError(url: string, invariant: string): Error {
  return new Error(`Media verification failed for ${url}: ${invariant}`);
}

function productionUrlForKey(key: string, mediaBaseUrl: string): string {
  let base: URL;
  try {
    base = new URL(mediaBaseUrl);
  } catch (error: unknown) {
    throw new Error(`Production media base URL is invalid: ${errorMessage(error)}`);
  }
  if (base.origin !== productionMediaOrigin || base.pathname !== '/') {
    throw new Error(`Production media base URL must be ${productionMediaOrigin}/.`);
  }
  return new URL(key, base).toString();
}

function assertProductionMediaUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error: unknown) {
    throw new Error(`Media URL must be an HTTPS production media URL: ${errorMessage(error)}`);
  }
  if (url.protocol !== 'https:' || url.origin !== productionMediaOrigin) {
    throw new Error(`Media URL must be an HTTPS production media URL: ${value}`);
  }
  return url;
}

function assertResponseOrigin(url: string, response: MediaResponse): void {
  if (response.url === undefined || response.url === '') return;
  let responseUrl: URL;
  try {
    responseUrl = new URL(response.url);
  } catch (error: unknown) {
    throw mediaError(url, `response URL is invalid: ${errorMessage(error)}`);
  }
  if (responseUrl.origin !== productionMediaOrigin) {
    throw mediaError(url, `cross-host redirect to ${responseUrl.origin} is rejected`);
  }
}

function expectedMimeType(url: URL): string {
  const key = url.pathname.replace(/^\//, '');
  const extension = key.split('.').at(-1)?.toLowerCase() as MediaExtension | undefined;
  if (extension === undefined || !(extension in mimeByExtension)) {
    throw mediaError(url.toString(), 'uses an unsupported media extension');
  }
  return mimeByExtension[extension];
}

function header(headers: Pick<Headers, 'get'>, name: string): string | undefined {
  return headers.get(name) ?? undefined;
}

function assertImmutableHeaders(url: string, response: MediaResponse, mimeType: string): number {
  if (response.status < 200 || response.status >= 300) {
    throw mediaError(url, `expected a 2xx status, received ${response.status}`);
  }
  const receivedMimeType = header(response.headers, 'content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  if (receivedMimeType !== mimeType) {
    throw mediaError(
      url,
      `expected Content-Type ${mimeType}, received ${receivedMimeType ?? 'missing'}`,
    );
  }
  const cacheControl = header(response.headers, 'cache-control')?.toLowerCase() ?? '';
  if (
    !cacheControl.includes('public') ||
    !/max-age\s*=\s*31536000/.test(cacheControl) ||
    !cacheControl.includes('immutable')
  ) {
    throw mediaError(url, 'requires public, one-year immutable Cache-Control');
  }
  const contentLength = Number(header(response.headers, 'content-length'));
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw mediaError(url, 'requires a non-zero Content-Length');
  }
  return contentLength;
}

export function validateMediaKey(key: string, contentType: string): MediaKeyDetails {
  const match = mediaKeyPattern.exec(key);
  const extension = match?.[1] as MediaExtension | undefined;
  if (extension === undefined) {
    throw new Error(`Media key must be a versioned canonical media key: ${key}`);
  }
  const mimeType = mimeByExtension[extension];
  if (contentType !== mimeType) {
    throw new Error(`Content type ${contentType} does not match .${extension} (${mimeType}).`);
  }
  return { extension, mimeType };
}

export async function verifyMediaUrl(url: string, { fetch }: VerifyMediaOptions): Promise<void> {
  const parsedUrl = assertProductionMediaUrl(url);
  const mimeType = expectedMimeType(parsedUrl);
  let head: MediaResponse;
  try {
    head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
  } catch (error: unknown) {
    throw mediaError(url, `HEAD request failed: ${errorMessage(error)}`);
  }
  assertResponseOrigin(url, head);
  const contentLength = assertImmutableHeaders(url, head, mimeType);
  if (mimeType !== 'audio/mpeg' && mimeType !== 'audio/mp4') return;

  let range: MediaResponse;
  try {
    range = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'manual',
    });
  } catch (error: unknown) {
    throw mediaError(url, `byte-range request failed: ${errorMessage(error)}`);
  }
  assertResponseOrigin(url, range);
  if (range.status !== 206) {
    throw mediaError(url, `audio byte-range request must return 206, received ${range.status}`);
  }
  if (header(range.headers, 'accept-ranges')?.toLowerCase() !== 'bytes') {
    throw mediaError(url, 'audio byte-range response requires Accept-Ranges: bytes');
  }
  if (header(range.headers, 'content-range') !== `bytes 0-0/${contentLength}`) {
    throw mediaError(url, 'audio byte-range response has an inconsistent Content-Range');
  }
}

export async function uploadMedia({
  file,
  key,
  contentType,
  mediaBaseUrl,
  fetch,
  run,
  statFile,
  cacheBust = () => crypto.randomUUID(),
}: UploadMediaOptions): Promise<string> {
  validateMediaKey(key, contentType);
  const source = await statFile(file);
  if (!source.isFile() || source.size <= 0) {
    throw new Error(`Media source must be a non-empty regular file: ${file}`);
  }
  const publicUrl = productionUrlForKey(key, mediaBaseUrl);
  const preflightUrl = new URL(publicUrl);
  preflightUrl.searchParams.set('media-guard', cacheBust());
  let preflight: MediaResponse;
  try {
    preflight = await fetch(preflightUrl.toString(), {
      method: 'HEAD',
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (error: unknown) {
    throw mediaError(publicUrl, `missing-object check failed: ${errorMessage(error)}`);
  }
  assertResponseOrigin(publicUrl, preflight);
  if (preflight.status !== 404) {
    throw mediaError(publicUrl, `must return 404 before upload, received ${preflight.status}`);
  }

  let upload: MediaProcessResult;
  try {
    upload = await run('pnpm', [
      'exec',
      'wrangler',
      'r2',
      'object',
      'put',
      `jelementi-media/${key}`,
      '--file',
      file,
      '--content-type',
      contentType,
      '--cache-control',
      immutableCacheControl,
      '--remote',
    ]);
  } catch (error: unknown) {
    throw new Error(`Wrangler upload failed: ${errorMessage(error)}`);
  }
  if (upload.exitCode !== 0) {
    throw new Error(
      `Wrangler upload failed: ${upload.stderr || upload.stdout || `exit ${upload.exitCode}`}`,
    );
  }
  await verifyMediaUrl(publicUrl, { fetch });
  return publicUrl;
}

export function collectMediaUrls(batch: ContentBatch): string[] {
  const urls = new Set<string>();
  for (const { compiled } of batch.published) {
    const { document } = compiled;
    urls.add(document.cover.src);
    for (const block of document.blocks) {
      if (block.type === 'image') urls.add(block.src);
    }
    if (document.audio !== undefined) urls.add(document.audio.src);
  }
  for (const url of urls) assertProductionMediaUrl(url);
  return [...urls];
}

export async function verifyPublishedMedia({
  batch,
  fetch,
}: VerifyPublishedMediaOptions): Promise<void> {
  for (const url of collectMediaUrls(batch)) {
    await verifyMediaUrl(url, { fetch });
  }
}
