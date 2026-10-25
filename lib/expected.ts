import "server-only";
import { runReadOnly, type QueryResult } from "./db";
import { SOLUTIONS } from "./solutions";

// The data never changes, so each reference result is computed once per server instance.
const cache = new Map<string, Promise<QueryResult>>();

export function expectedResult(id: string): Promise<QueryResult> {
  let p = cache.get(id);
  if (!p) {
    p = runReadOnly(SOLUTIONS[id].sql, 5000);
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
