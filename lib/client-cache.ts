// Lightweight in-memory client-side cache with optional stale-while-revalidate strategy.
// Designed as a quick win without external dependencies.

// NOTE: Runs only in the browser (guards prevent SSR execution side-effects).
// Keys are arbitrary strings (recommend: `${dataset}:v1:${param1}:${param2}`)

export type CacheState = 'fresh' | 'stale' | 'miss';

interface Entry<T = any> {
  data: T;
  ts: number;          // timestamp (ms) when stored
  ttl: number;          // fresh window length (ms)
  staleWindow: number;  // additional window where data is returned while background refresh runs
}

interface GetResult<T> { value: T | undefined; state: CacheState }

// Internal store kept per tab (no cross-tab sync for now)
const store = new Map<string, Entry<any>>();

// Keys we persist (prefix match). Keep lightweight; adjust when needed.
const PERSIST_PREFIXES = ['projects:v1', 'consultants:v1', 'daysoff:v1'];
const LS_KEY = '__appCache_v1';
let persistenceLoaded = false;

interface PersistShape { [key: string]: { data: any; ts: number; ttl: number; staleWindow: number } }

function shouldPersist(key: string){
  return PERSIST_PREFIXES.some(p => key.startsWith(p));
}

function loadPersistence(){
  if (persistenceLoaded) return;
  persistenceLoaded = true;
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const obj: PersistShape = JSON.parse(raw);
    const now = Date.now();
    for (const [k,v] of Object.entries(obj)){
      const age = now - v.ts;
      if (age <= v.ttl + v.staleWindow) {
        store.set(k, v);
      }
    }
  } catch {}
}

function savePersistence(){
  if (typeof window === 'undefined') return;
  try {
    const toSave: PersistShape = {};
    for (const [k,v] of store.entries()){
      if (shouldPersist(k)) toSave[k] = v;
    }
    localStorage.setItem(LS_KEY, JSON.stringify(toSave));
  } catch {}
}

// Optional: track background refresh promises to dedupe concurrent fetches
const inFlight = new Map<string, Promise<any>>();

// Periodic cleanup (lazy initialized in browser)
const CLEAN_INTERVAL = 5 * 60_000; // 5 min
let cleanupStarted = false;
let cleanupTimerRef: ReturnType<typeof setInterval> | null = null;
function ensureCleanupTimer() {
  if (cleanupStarted || typeof window === 'undefined') return;
  cleanupStarted = true;
  cleanupTimerRef = setInterval(() => {
    const now = Date.now();
    for (const [k, e] of store.entries()) {
      if (now - e.ts > e.ttl + e.staleWindow) store.delete(k);
    }
  }, CLEAN_INTERVAL);
}

export function get<T = any>(key: string): GetResult<T> {
  ensureCleanupTimer();
  loadPersistence();
  const e = store.get(key);
  if (!e) return { value: undefined, state: 'miss' };
  const age = Date.now() - e.ts;
  if (age <= e.ttl) return { value: e.data as T, state: 'fresh' };
  if (age <= e.ttl + e.staleWindow) return { value: e.data as T, state: 'stale' };
  store.delete(key);
  // Save after deletion (garbage collected entry)
  savePersistence();
  return { value: undefined, state: 'miss' };
}

// Lightweight peek of only the state (no data copy) – convenience helper.
export function peekState(key: string): CacheState {
  const r = get(key);
  return r.state;
}

export function set<T = any>(key: string, data: T, opts: { ttlMs: number; staleWindowMs?: number }) {
  ensureCleanupTimer();
  loadPersistence();
  store.set(key, { data, ts: Date.now(), ttl: opts.ttlMs, staleWindow: opts.staleWindowMs ?? 0 });
  if (shouldPersist(key)) savePersistence();
}

export async function getOrLoad<T>(
  key: string,
  loader: () => Promise<T>,
  opts: { ttlMs: number; staleWindowMs?: number; onBackgroundRefresh?: (fresh: T) => void }
): Promise<{ value: T; from: 'cache' | 'network' }> {
  const g = get<T>(key);
  if (g.state === 'fresh') return { value: g.value as T, from: 'cache' };
  if (g.state === 'stale') {
    // schedule background refresh (dedup)
    if (!inFlight.has(key)) {
      const p = loader()
        .then(data => {
          set(key, data, opts);
          opts.onBackgroundRefresh?.(data);
          inFlight.delete(key);
          return data;
        })
        .catch(err => {
          inFlight.delete(key);
          // swallow error (stale data retained)
          if (process.env.NODE_ENV !== 'production') console.debug('[client-cache] background refresh error', key, err);
        });
      inFlight.set(key, p);
    }
    return { value: g.value as T, from: 'cache' };
  }
  // miss: ensure single network load per key
  if (inFlight.has(key)) {
    const data = await inFlight.get(key)!;
    return { value: data as T, from: 'network' };
  }
  const prom = loader().then(data => {
    set(key, data, opts);
    inFlight.delete(key);
    return data;
  }).catch(err => {
    inFlight.delete(key);
    throw err;
  });
  inFlight.set(key, prom);
  const data = await prom;
  return { value: data as T, from: 'network' };
}

export function invalidate(keyOrPrefix: string) {
  for (const key of store.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) store.delete(key);
  }
  savePersistence();
}

export function prime<T>(key: string, data: T, opts: { ttlMs: number; staleWindowMs?: number }) {
  // Insert only if not already present (avoid overwriting fresher data)
  if (!store.has(key)) set(key, data, opts);
}

export function destroy() {
  if (cleanupTimerRef) {
    clearInterval(cleanupTimerRef);
    cleanupTimerRef = null;
  }
  cleanupStarted = false;
  store.clear();
  inFlight.clear();
}

export function stats() {
  return { size: store.size, keys: Array.from(store.keys()) };
}
