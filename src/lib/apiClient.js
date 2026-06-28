/**
 * Thin fetch wrapper for this app's own same-origin /api/* endpoints.
 * Returns parsed JSON; throws on a non-ok response.
 *
 * Shell only — not wired to any caller yet. The api/ serverless functions
 * do not exist in this phase.
 */
export async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`apiFetch ${path} failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
