import { describe, expect, it } from 'vitest';
import { coverImage } from './cover-image';

describe('coverImage', () => {
  it('resizes production media covers through Cloudflare image transformations', () => {
    const image = coverImage('https://media.jelementi.quz.ma/articles/a/cover-v1.png', '282px');
    expect(image.src).toBe(
      'https://media.jelementi.quz.ma/cdn-cgi/image/width=800,format=auto/articles/a/cover-v1.png',
    );
    expect(image.srcset).toContain(
      '/cdn-cgi/image/width=400,format=auto/articles/a/cover-v1.png 400w',
    );
    expect(image.srcset).toContain('width=1400,format=auto/articles/a/cover-v1.png 1400w');
    expect(image.sizes).toBe('282px');
  });

  it('leaves other hosts untouched', () => {
    expect(coverImage('https://example.test/1.webp', '282px')).toEqual({
      src: 'https://example.test/1.webp',
    });
  });
});
