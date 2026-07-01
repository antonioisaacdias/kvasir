import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type Database from 'better-sqlite3';
import { createAuthRoutes, requireSession } from '../auth/http.js';
import { searchAllSources } from '../search/searchService.js';
import { downloadBook, AlreadyDownloadedError } from '../download/downloadService.js';
import { listDownloads } from '../db/downloads.js';
import { enabledAdapters } from '../adapters/registry.js';
import type { SourceAdapter } from '../adapters/types.js';

export interface AppDeps {
  db: Database.Database;
  ingestDir: string;
  adapters: SourceAdapter[];
}

export function createApp(deps?: Partial<AppDeps>) {
  const app = new Hono();
  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  if (deps?.db) {
    const db = deps.db;
    const adapters = deps.adapters ?? enabledAdapters;
    const ingestDir = deps.ingestDir ?? '/cwa-book-ingest';

    app.route('/api/auth', createAuthRoutes(db));
    app.use('/api/search', requireSession(db));
    app.use('/api/download', requireSession(db));
    app.use('/api/downloads', requireSession(db));

    app.get('/api/search', async (c) => {
      const query = c.req.query('q') ?? '';
      const outcome = await searchAllSources(query, adapters);
      return c.json(outcome);
    });

    app.get('/api/downloads', (c) => {
      return c.json({ downloads: listDownloads(db) });
    });

    app.post('/api/download', async (c) => {
      let body: { source: string; externalId: string; title: string; author?: string };
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: 'invalid JSON body' }, 400);
      }

      if (!body.source || !body.externalId || !body.title) {
        return c.json({ error: 'missing required field: source, externalId, and title are required' }, 400);
      }

      const adapter = adapters.find((a) => a.id === body.source);
      if (!adapter) {
        return c.json({ error: `unknown source ${body.source}` }, 400);
      }

      return streamSSE(c, async (stream) => {
        const controller = new AbortController();
        stream.onAbort(() => controller.abort());

        try {
          await downloadBook(
            db,
            ingestDir,
            adapter,
            body,
            async (progress) => {
              await stream.writeSSE({ data: JSON.stringify({ type: 'progress', ...progress }) });
            },
            controller.signal,
            async (attempt) => {
              await stream.writeSSE({ data: JSON.stringify({ type: 'retrying', attempt }) });
            },
          );
          await stream.writeSSE({ data: JSON.stringify({ type: 'done' }) });
        } catch (err) {
          if (controller.signal.aborted) {
            return;
          }
          if (err instanceof AlreadyDownloadedError) {
            await stream.writeSSE({ data: JSON.stringify({ type: 'already' }) });
          } else {
            await stream.writeSSE({ data: JSON.stringify({ type: 'error', message: (err as Error).message }) });
          }
        }
      });
    });
  }

  return app;
}
