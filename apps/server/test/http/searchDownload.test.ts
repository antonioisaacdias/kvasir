import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/index';
import { createApp } from '../../src/http/app';
import type { SourceAdapter, DownloadStream } from '../../src/adapters/types';

function streamOf(bytes: number[], totalBytes: number | null = bytes.length): DownloadStream {
  return {
    totalBytes,
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(bytes));
        controller.close();
      },
    }),
  };
}

function fakeAdapter(): SourceAdapter {
  return {
    id: 'gutenberg',
    async search(query) {
      return [{ source: 'gutenberg', externalId: '11', title: `Result for ${query}`, author: 'Someone' }];
    },
    async download() {
      return streamOf([1, 2, 3]);
    },
  };
}

async function parseSSE(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => {
      const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));
      return dataLine ? (JSON.parse(dataLine.slice('data: '.length)) as Record<string, unknown>) : null;
    })
    .filter((event): event is Record<string, unknown> => event !== null);
}

async function loggedInApp(db: Database.Database, ingestDir: string, adapters: SourceAdapter[]) {
  const app = createApp({ db, ingestDir, adapters });
  const register = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'odin', password: 'correct horse battery staple' }),
  });
  const cookie = register.headers.get('set-cookie')!.split(';')[0];
  return { app, cookie };
}

describe('GET /api/search', () => {
  it('returns aggregated results as JSON', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);

    const res = await app.request('/api/search?q=alice', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([
      { source: 'gutenberg', externalId: '11', title: 'Result for alice', author: 'Someone' },
    ]);
  });
});

describe('POST /api/download', () => {
  it('streams progress events and a final done event', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);

    const res = await app.request('/api/download', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ source: 'gutenberg', externalId: '11', title: 'Alice', author: 'Someone' }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = await parseSSE(res);
    expect(events).toContainEqual({ type: 'progress', bytesDownloaded: 3, totalBytes: 3 });
    expect(events[events.length - 1]).toEqual({ type: 'done' });
  });

  it('streams a retrying event before recovering from a transient network error', async () => {
    vi.useFakeTimers();
    try {
      const db = new Database(':memory:');
      migrate(db);
      const flakyAdapter: SourceAdapter = {
        id: 'gutenberg',
        async search() {
          return [];
        },
        download: vi
          .fn()
          .mockRejectedValueOnce(new TypeError('fetch failed'))
          .mockResolvedValueOnce(streamOf([1, 2, 3])),
      };
      const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [flakyAdapter]);

      const resPromise = app.request('/api/download', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ source: 'gutenberg', externalId: '11', title: 'Alice', author: 'Someone' }),
      });
      await vi.advanceTimersByTimeAsync(5000);
      const events = await parseSSE(await resPromise);

      expect(events).toContainEqual({ type: 'retrying', attempt: 2 });
      expect(events[events.length - 1]).toEqual({ type: 'done' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('streams an already event for an already-downloaded book', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);
    const body = JSON.stringify({ source: 'gutenberg', externalId: '11', title: 'Alice', author: 'Someone' });

    await parseSSE(
      await app.request('/api/download', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body }),
    );
    const res = await app.request('/api/download', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body });

    const events = await parseSSE(res);
    expect(events[events.length - 1]).toEqual({ type: 'already' });
  });

  it('returns 400 when a required field is missing', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);

    const res = await app.request('/api/download', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ source: 'gutenberg', externalId: '11' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);

    const res = await app.request('/api/download', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: 'not json',
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/downloads', () => {
  it('rejects with no session', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const app = createApp({ db, ingestDir: mkdtempSync(join(tmpdir(), 'kvasir-')), adapters: [fakeAdapter()] });

    const res = await app.request('/api/downloads');
    expect(res.status).toBe(401);
  });

  it('returns an empty list before anything is downloaded', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);

    const res = await app.request('/api/downloads', { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ downloads: [] });
  });

  it('lists a book after it has been downloaded', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);

    await parseSSE(
      await app.request('/api/download', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ source: 'gutenberg', externalId: '11', title: 'Alice', author: 'Someone' }),
      }),
    );

    const res = await app.request('/api/downloads', { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.downloads).toHaveLength(1);
    expect(body.downloads[0]).toMatchObject({ source: 'gutenberg', externalId: '11', title: 'Alice', author: 'Someone' });
  });
});
