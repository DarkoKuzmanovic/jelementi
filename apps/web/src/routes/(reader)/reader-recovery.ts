const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export function recoveryRetryHref(status: number, url: URL): string | undefined {
  return RETRYABLE_STATUSES.has(status) ? `${url.pathname}${url.search}` : undefined;
}
