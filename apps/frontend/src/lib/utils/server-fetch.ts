const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

export function getBackendUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

export async function fetchBackend(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(getBackendUrl(path), init);
}
