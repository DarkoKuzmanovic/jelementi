import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from '@playwright/test';

// Root scripts have no DOM lib; describe only the native audio surface used by the probe.
export interface PlaybackAudio {
  readyState: number;
  duration: number;
  currentTime: number;
  paused: boolean;
  seeking: boolean;
  ended: boolean;
  error: { code: number } | null;
  load(): void;
  play(): Promise<void>;
  pause(): void;
  addEventListener(event: string, listener: () => void): void;
  removeEventListener(event: string, listener: () => void): void;
}

export interface PlaybackEvidence {
  articleUrl: string;
  metadata: { loaded: true; durationSeconds: number };
  playback: { advancing: true; fromSeconds: number; toSeconds: number };
  seek: { succeeded: true; targetSeconds: number; actualSeconds: number };
  end: { observed: true; eventObserved: boolean; ended: boolean; currentTimeSeconds: number };
  scope: 'Reached the end after seeking; not uninterrupted playback or a human listening review.';
}

export async function verifyPlayback(
  articleUrl: string,
  {
    launch = () => chromium.launch({ headless: true }),
    timeoutMs = 15_000,
  }: { launch?: () => Promise<Browser>; timeoutMs?: number } = {},
): Promise<PlaybackEvidence> {
  const url = new URL(articleUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Playback article must be an HTTP(S) URL without credentials.');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Playback timeout must be positive and finite.');
  }
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const response = await page.goto(url.href, { timeout: timeoutMs });
    if (response?.status() !== 200) throw new Error('Playback article must return HTTP 200.');
    const evidence = await page.locator('audio').evaluate(
      async (element, timeout) => {
        const audio = element as unknown as PlaybackAudio;
        let endedEvent = false;
        let seekedEvent = false;
        // Anonymous tuple callbacks avoid tsx's module-scoped __name helper in browser code.
        const [onEnded, onSeeked] = [
          () => {
            endedEvent = true;
          },
          () => {
            seekedEvent = true;
          },
        ] as const;
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('seeked', onSeeked);
        const [wait] = [
          async (check: () => boolean, failure: string) => {
            const deadline = Date.now() + timeout;
            while (!check()) {
              if (audio.error) throw new Error(`${failure}: audio error ${audio.error.code}.`);
              if (Date.now() >= deadline) {
                throw new Error(
                  `${failure} after ${timeout}ms (time=${audio.currentTime}, paused=${audio.paused}, ended=${audio.ended}).`,
                );
              }
              await new Promise((done) => setTimeout(done, 50));
            }
            if (audio.error) throw new Error(`${failure}: audio error ${audio.error.code}.`);
          },
        ] as const;
        try {
          audio.load();
          await wait(
            () => audio.readyState >= 1 && Number.isFinite(audio.duration) && audio.duration > 0,
            'Metadata load timeout',
          );
          const durationSeconds = audio.duration;
          let startTimer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              audio.play().catch((error: unknown) => {
                throw new Error(
                  `Playback start failed: ${error instanceof Error ? error.message : String(error)}`,
                );
              }),
              new Promise<never>((_, reject) => {
                startTimer = setTimeout(() => reject(new Error('Playback start timeout')), timeout);
              }),
            ]);
          } finally {
            clearTimeout(startTimer);
          }
          const fromSeconds = audio.currentTime;
          await wait(
            () => !audio.paused && audio.currentTime > fromSeconds + 0.1,
            'Playback stalled',
          );
          const toSeconds = audio.currentTime;
          audio.pause();
          const targetSeconds = Math.max(0, durationSeconds - 2);
          // ponytail: sample the opening and final two seconds, never claim a complete listen.
          endedEvent = false;
          seekedEvent = false;
          audio.currentTime = targetSeconds;
          await wait(
            () =>
              seekedEvent && !audio.seeking && Math.abs(audio.currentTime - targetSeconds) < 0.25,
            'Seek failed',
          );
          const actualSeconds = audio.currentTime;
          // Resume within a bounded start wait as well; play() can hang after a seek.
          let resumeSettled = false;
          let resumeError: unknown;
          void audio.play().then(
            () => {
              resumeSettled = true;
            },
            (error: unknown) => {
              resumeError = error;
              resumeSettled = true;
            },
          );
          await wait(() => resumeSettled, 'Playback restart timeout');
          if (resumeError !== undefined)
            throw new Error(`Playback restart failed: ${String(resumeError)}`);
          await wait(
            () => endedEvent || audio.ended,
            'End-wait timeout (playback stalled or no ended evidence)',
          );
          return {
            metadata: { loaded: true as const, durationSeconds },
            playback: { advancing: true as const, fromSeconds, toSeconds },
            seek: { succeeded: true as const, targetSeconds, actualSeconds },
            end: {
              observed: true as const,
              eventObserved: endedEvent,
              ended: audio.ended,
              currentTimeSeconds: audio.currentTime,
            },
            scope:
              'Reached the end after seeking; not uninterrupted playback or a human listening review.' as const,
          };
        } finally {
          audio.pause();
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('seeked', onSeeked);
        }
      },
      timeoutMs,
      { timeout: timeoutMs * 6 },
    );
    return { articleUrl: url.href, ...evidence };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  if (args.length !== 1) {
    console.error('Usage: pnpm exec tsx scripts/verify-playback.ts <article-url>');
    process.exitCode = 1;
  } else {
    verifyPlayback(args[0]!).then(
      (evidence) => console.log(JSON.stringify(evidence, null, 2)),
      (error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
      },
    );
  }
}
