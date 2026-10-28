// Fixed destinations only: this endpoint never accepts an arbitrary URL.
export const destinations = ['https://www.whatnot.com/', 'https://www.instagram.com/', 'https://www.ebay.com/'];
export function classifyStatus(status) {
  if (status >= 500) return 'upstream-5xx';
  if (status === 403 || status === 429) return 'restricted';
  if (status >= 200 && status < 400) return 'reachable';
  return 'http-error';
}
export function networkDiagnostics(fetcher = fetch, now = Date.now) {
  let cached, pending;
  return async () => {
    if (cached && now() - cached.checkedAt < 60000) return cached;
    if (pending) return pending;
    pending = Promise.all(destinations.map(async url => {
      const started = now();
      try {
        const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
        await response.body?.cancel();
        return { host: new URL(url).hostname, status: response.status, result: classifyStatus(response.status), elapsedMs: now() - started };
      } catch { return { host: new URL(url).hostname, status: null, result: 'network-error', elapsedMs: now() - started }; }
    })).then(results => (cached = { checkedAt: now(), results })).finally(() => { pending = null; });
    return pending;
  };
}
