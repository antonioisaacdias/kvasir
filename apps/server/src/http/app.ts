import { Hono } from 'hono';
import type Database from 'better-sqlite3';
import { createAuthRoutes, requireSession } from '../auth/http';

export interface AppDeps {
  db: Database.Database;
  ingestDir: string;
}

export function createApp(deps?: Partial<AppDeps>) {
  const app = new Hono();
  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  if (deps?.db) {
    app.route('/api/auth', createAuthRoutes(deps.db));
    app.use('/api/search', requireSession(deps.db));
    app.use('/api/download', requireSession(deps.db));
  }

  return app;
}
