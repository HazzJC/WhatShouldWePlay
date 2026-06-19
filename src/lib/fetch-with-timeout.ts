const DEFAULT_TIMEOUT_MS = 5000;

/**
 * `fetch` with a hard timeout that actually aborts the underlying request.
 *
 * Serverless functions are billed for wall-clock time and have a hard max
 * duration, so a third-party API that stalls (Steam Store and IGDB do this
 * regularly) must not be allowed to hang the whole invocation. This aborts the
 * socket on timeout rather than just abandoning the promise, freeing the
 * connection instead of leaving it in flight.
 *
 * Callers are expected to try/catch and degrade gracefully — a timeout surfaces
 * as a rejected promise (an `AbortError`).
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
