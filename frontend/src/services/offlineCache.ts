import { delMany, get, keys, set } from 'idb-keyval';

const CACHE_PREFIX = 'cache:';

export interface CachedEntry<T> {
  value: T;
  savedAt: string;
}

export async function saveCached<T>(key: string, value: T): Promise<void> {
  try {
    await set(CACHE_PREFIX + key, { value, savedAt: new Date().toISOString() });
  } catch {
    // Brak dostępu do IndexedDB (np. tryb prywatny) – aplikacja działa dalej, tylko bez pamięci offline.
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
    // Jak wyżej – nie ma czego czyścić.
  }
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}