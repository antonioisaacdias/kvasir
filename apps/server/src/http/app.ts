import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { createAuthRoutes, requireSession } from '../auth/http';
import { searchAllSources } from '../search/searchService';
import { downloadBook, AlreadyDownloadedError } from '../download/downloadService';
import { enabledAdapters } from '../adapters/registry';
import type { SourceAdapter } from '../adapters/types';

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

    app.get('/api/search', async (c) => {
      const query = c.req.query('q') ?? '';
      const outcome = await searchAllSources(query, adapters);
      return c.json(outcome);
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
      try {
        await downloadBook(db, ingestDir, adapter, body);
        return c.json({ status: 'downloaded' }, 201);
      } catch (err) {
        if (err instanceof AlreadyDownloadedError) {
          return c.json({ error: err.message }, 409);
        }
        throw err;
      }
    });
  }

  return app;
}
