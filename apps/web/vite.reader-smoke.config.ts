import { mergeConfig } from 'vite';
import baseConfig from './vite.config';

/** Isolates canonical Reader smoke transforms from concurrent issue worktrees. */
export default mergeConfig(baseConfig, {
  cacheDir: `/tmp/jelementi-reader-smoke-vite-${process.pid}`,
});
