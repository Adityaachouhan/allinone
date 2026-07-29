const TOKEN_KEY = 'aio_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const text = await res.text();

  // A misconfigured proxy answers /api with the SPA's index.html, which would
  // otherwise reach the UI as an empty object and break rendering.
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`API did not return JSON (${res.status}) for /api${path}`);
  }

  if (!res.ok) {
    const error = (data as { error?: string })?.error;
    throw new Error(error || `Request failed (${res.status})`);
  }
  return data as T;
}
