export type Settled<R> = { ok: true; value: R } | { ok: false; error: string };

/**
 * Aplica `fn` a cada elemento con como mucho `limit` llamadas en curso a la vez. Un fallo no corta
 * el resto: cada resultado dice si salió bien, en el mismo orden que `items`.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<Settled<R>[]> {
  const results: Settled<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { ok: true, value: await fn(items[index]) };
      } catch (e: any) {
        results[index] = { ok: false, error: e?.message ?? 'error desconocido' };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
