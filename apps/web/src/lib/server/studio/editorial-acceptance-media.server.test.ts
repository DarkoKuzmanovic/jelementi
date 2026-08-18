import { describe, expect, it } from 'vitest';
import { studioEditorialAcceptanceMediaFetch } from './editorial-acceptance-media.server';

describe('studioEditorialAcceptanceMediaFetch', () => {
  it('returns deterministic HEAD success only for bounded acceptance article media', async () => {
    const response = await studioEditorialAcceptanceMediaFetch(
      'https://media.studio-acceptance.invalid/articles/lighthouse-watch/cover-v1.svg',
      { method: 'HEAD' },
    );

    expect(response.status).toBe(200);
  });

  it('fails closed for another origin, an unsafe path, or a non-HEAD request', async () => {
    const otherOrigin = await studioEditorialAcceptanceMediaFetch(
      'https://example.com/articles/lighthouse-watch/cover-v1.svg',
      { method: 'HEAD' },
    );
    const unsafePath = await studioEditorialAcceptanceMediaFetch(
      'https://media.studio-acceptance.invalid/articles/lighthouse-watch/%2e%2e/secret',
      { method: 'HEAD' },
    );
    const wrongMethod = await studioEditorialAcceptanceMediaFetch(
      'https://media.studio-acceptance.invalid/articles/lighthouse-watch/cover-v1.svg',
      { method: 'GET' },
    );

    expect(otherOrigin.status).toBe(404);
    expect(unsafePath.status).toBe(404);
    expect(wrongMethod.status).toBe(405);
  });
});
