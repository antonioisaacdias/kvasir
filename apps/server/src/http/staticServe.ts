import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

export function mountStaticFrontend(app: Hono, webDistDir: string): void {
  app.use('/assets/*', serveStatic({ root: webDistDir }));
  app.get('*', serveStatic({ path: `${webDistDir}/index.html` }));
}
