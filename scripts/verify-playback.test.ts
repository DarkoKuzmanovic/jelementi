import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Browser } from '@playwright/test';
import { verifyPlayback, type PlaybackAudio } from './verify-playback';

class TestAudio extends EventTarget {
  readyState = 1;
  duration = 30;
  paused = true;
  seeking = false;
  ended = false;
  error = null;
  time = 0;
  mode = 'ended-event';
  plays = 0;

  get currentTime(): number {
    return this.time;
  }
  set currentTime(value: number) {
    if (this.mode === 'seek-failure') return;
    this.time = value;
    this.seeking = true;
    setTimeout(() => {
      this.seeking = false;
      this.dispatchEvent(new Event('seeked'));
    }, 10);
  }
  load(): void {}
  pause(): void {
    this.paused = true;
  }
  async play(): Promise<void> {
    this.plays++;
    if (this.plays === 2 && this.mode === 'restart-failure') throw new Error('restart denied');
    if (this.plays === 2 && this.mode === 'restart-timeout') return new Promise(() => {});
    if (this.mode === 'start-failure') throw new Error('play denied');
    if (this.mode === 'start-timeout') return new Promise(() => {});
    this.paused = false;
    setInterval(() => {
      if (this.paused || this.mode === 'stalled') return;
      if (this.mode === 'near-end-only' && this.time >= 28) return;
      this.time = Math.min(this.duration, this.time + 0.1);
      if (this.time >= this.duration && this.mode !== 'no-ended') {
        this.paused = true;
        if (this.mode === 'ended-state') this.ended = true;
        else this.dispatchEvent(new Event('ended'));
      }
    }, 100);
  }
}

function boundary(audio: TestAudio, status = 200) {
  const close = vi.fn(async () => {});
  const launch = vi.fn(
    async () =>
      ({
        close,
        newPage: async () => ({
          goto: async () => ({ status: () => status }),
          locator: () => ({
            evaluate: async (
              callback: (element: PlaybackAudio, timeout: number) => Promise<unknown>,
              timeout: number,
            ) => callback(audio as unknown as PlaybackAudio, timeout),
          }),
        }),
      }) as unknown as Browser,
  );
  return { launch, close };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('browser playback evidence (injected browser, no Chromium)', () => {
  it.each(['ended-event', 'ended-state'])('accepts observed %s after seeking', async (mode) => {
    vi.useFakeTimers();
    const audio = new TestAudio();
    audio.mode = mode;
    const browser = boundary(audio);
    const result = verifyPlayback('https://example.test/articles/story', {
      launch: browser.launch,
      timeoutMs: 3000,
    });
    const assertion = expect(result).resolves.toMatchObject({
      metadata: { loaded: true, durationSeconds: 30 },
      playback: { advancing: true },
      seek: { succeeded: true, targetSeconds: 28 },
      end: { observed: true, eventObserved: mode === 'ended-event', ended: mode === 'ended-state' },
      scope:
        'Reached the end after seeking; not uninterrupted playback or a human listening review.',
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(browser.close).toHaveBeenCalledOnce();
    expect(audio.paused).toBe(true);
  });

  it.each([
    ['start-failure', 'Playback start failed: play denied'],
    ['start-timeout', 'Playback start timeout'],
    ['stalled', 'Playback stalled'],
    ['seek-failure', 'Seek failed'],
    ['restart-failure', 'Playback restart failed'],
    ['restart-timeout', 'Playback restart timeout'],
    ['near-end-only', 'End-wait timeout'],
    ['no-ended', 'End-wait timeout'],
  ])('fails closed for %s and closes browser', async (mode, message) => {
    vi.useFakeTimers();
    const audio = new TestAudio();
    audio.mode = mode;
    const browser = boundary(audio);
    const assertion = expect(
      verifyPlayback('https://example.test/articles/story', {
        launch: browser.launch,
        timeoutMs: 3000,
      }),
    ).rejects.toThrow(message);
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(browser.close).toHaveBeenCalledOnce();
    expect(audio.paused).toBe(true);
  });

  it('fails closed when metadata never loads', async () => {
    vi.useFakeTimers();
    const audio = new TestAudio();
    audio.readyState = 0;
    const browser = boundary(audio);
    const assertion = expect(
      verifyPlayback('https://example.test/articles/story', {
        launch: browser.launch,
        timeoutMs: 3000,
      }),
    ).rejects.toThrow('Metadata load timeout');
    await vi.advanceTimersByTimeAsync(4000);
    await assertion;
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('closes the browser on navigation failure', async () => {
    const browser = boundary(new TestAudio(), 404);
    await expect(
      verifyPlayback('https://example.test/articles/story', { launch: browser.launch }),
    ).rejects.toThrow('Playback article must return HTTP 200');
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
