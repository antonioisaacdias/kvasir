import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/index';
import { createApp } from '../../src/http/app';
import type { SourceAdapter } from '../../src/adapters/types';

function streamOf(bytes: number[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
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
  it('downloads a book and returns its stored metadata', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);

    const res = await app.request('/api/download', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ source: 'gutenberg', externalId: '11', title: 'Alice', author: 'Someone' }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: 'downloaded' });
  });

  it('returns 409 for an already-downloaded book', async () => {
    const db = new Database(':memory:');
    migrate(db);
    const { app, cookie } = await loggedInApp(db, mkdtempSync(join(tmpdir(), 'kvasir-')), [fakeAdapter()]);
    const body = JSON.stringify({ source: 'gutenberg', externalId: '11', title: 'Alice', author: 'Someone' });

    await app.request('/api/download', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body });
    const res = await app.request('/api/download', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body });

    expect(res.status).toBe(409);
  });
});
