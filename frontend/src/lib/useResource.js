import { useCallback, useEffect, useState } from 'react';

/**
 * Loads something from the API and keeps the three states every screen needs:
 * loading, the data, and an error worth showing the student. `reload` is
 * returned so a failed screen can offer a retry rather than a dead end.
 */
export function useResource(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // The loader closes over the deps the caller passes, which is what decides
  // when this refetches.
  const load = useCallback(loader, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await load();
      setData(result);
      return result;
    } catch (caught) {
      if (caught.name !== 'AbortError') {
        setError(caught);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
