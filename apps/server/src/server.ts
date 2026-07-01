import { serve } from '@hono/node-server';
import { createApp } from './http/app';
import { mountStaticFrontend } from './http/staticServe';
import { openDb } from './db';
import { enabledAdapters } from './adapters/registry';

const dataDir = process.env.KVASIR_DATA_DIR ?? '/data';
const ingestDir = process.env.KVASIR_INGEST_DIR ?? '/cwa-book-ingest';
const webDistDir = process.env.KVASIR_WEB_DIST ?? '../web/dist';

const db = openDb(`${dataDir}/kvasir.db`);
const app = createApp({ db, ingestDir, adapters: enabledAdapters });
mountStaticFrontend(app, webDistDir);

const port = Number(process.env.PORT ?? 8790);
serve({ fetch: app.fetch, port }, () => {
  console.log(`kvasir server listening on :${port}`);
});
