/**
 * Minimal in-memory TTL cache used by API routes to respect upstream rate
 * limits (EIA, NewsAPI). Lives for the lifetime of the server process. For a
 * multi-instance production deploy this would move to Redis or similar.
 */
interface Entry<T> {
  value: T;
  expires: number;
}

// Next.js bundles each route separately, so a plain module-level Map would be
// a different instance per API route (and reset on dev hot-reload). Anchor the
// store on globalThis so every route shares one cache.
const g = globalThis as unknown as { __ttlCache?: Map<string, Entry<unknown>> };
const store = (g.__ttlCache ??= new Map<string, Entry<unknown>>());

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}
