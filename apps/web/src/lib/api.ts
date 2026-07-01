export interface SearchResult {
  source: string;
  externalId: string;
  title: string;
  author?: string;
  coverUrl?: string;
  language?: string;
  subjects?: string[];
}

export interface SearchOutcome {
  results: SearchResult[];
  errors: { source: string; message: string }[];
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api${path}`, { ...init, credentials: 'include' });
}

export async function register(username: string, password: string): Promise<Response> {
  return apiFetch('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string): Promise<Response> {
  return apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function search(query: string): Promise<SearchOutcome> {
  const res = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function download(result: SearchResult): Promise<Response> {
  return apiFetch('/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result),
  });
}
