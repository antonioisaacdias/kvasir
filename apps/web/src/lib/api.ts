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

export interface DownloadRecord {
  source: string;
  externalId: string;
  title: string;
  author?: string;
  downloadedAt: string;
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

export async function getCurrentUser(): Promise<{ username: string } | null> {
  const res = await apiFetch('/auth/me');
  if (!res.ok) return null;
  return res.json();
}

export async function search(query: string): Promise<SearchOutcome> {
  const res = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export type DownloadEvent =
  | { type: 'progress'; bytesDownloaded: number; totalBytes: number | null }
  | { type: 'retrying'; attempt: number }
  | { type: 'done' }
  | { type: 'already' }
  | { type: 'error'; message: string };

function parseSSEChunk(chunk: string): DownloadEvent | null {
  const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice('data: '.length)) as DownloadEvent;
  } catch {
    return null;
  }
}

export async function download(result: SearchResult, onEvent: (event: DownloadEvent) => void): Promise<void> {
  const res = await apiFetch('/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result),
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    onEvent({ type: 'error', message: body.error ?? 'download failed' });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';
    for (const chunk of chunks) {
      const event = parseSSEChunk(chunk);
      if (event) onEvent(event);
    }
  }
}

export async function listDownloads(): Promise<DownloadRecord[]> {
  const res = await apiFetch('/downloads');
  const body: { downloads: DownloadRecord[] } = await res.json();
  return body.downloads;
}
