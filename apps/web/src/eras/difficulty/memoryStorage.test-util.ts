// A Storage in memory, for tests that stub localStorage (as state/storage.test.ts does).
export function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => data.delete(k),
    setItem: (k, v) => data.set(k, v),
  };
}

/** A Storage that throws on every use (private mode, blocked storage). */
export function blockedStorage(): Storage {
  const no = () => {
    throw new Error('blocked');
  };
  return { length: 0, clear: no, getItem: no, key: no, removeItem: no, setItem: no };
}
