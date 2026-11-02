import { delMany, get, keys, set } from 'idb-keyval';

const CACHE_PREFIX = 'cache:';

export interface CachedEntry<T> {
  value: T;
  savedAt: string;
}

export async function saveCached<T>(key: string, value: T, savedAt: Date = new Date()): Promise<void> {
  try {
    await set(CACHE_PREFIX + key, { value, savedAt: savedAt.toISOString() });
  } catch {
    console.log('Nie udało się wyczyścić pamięci offline.');
  }
}

export async function loadCached<T>(key: string): Promise<CachedEntry<T> | null> {
  try {
    return (await get<CachedEntry<T>>(CACHE_PREFIX + key)) ?? null;
  } catch {
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const cacheKeys = (await keys()).filter((key) => typeof key === 'string' && key.startsWith(CACHE_PREFIX));
    await delMany(cacheKeys);
  } catch {
    console.log('Nie udało się wyczyścić pamięci offline.');
  }
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}