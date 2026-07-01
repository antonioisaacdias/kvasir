import { serve } from '@hono/node-server';
import { createApp } from './http/app';

const app = createApp();
const port = Number(process.env.PORT ?? 8790);
serve({ fetch: app.fetch, port }, () => {
  console.log(`kvasir server listening on :${port}`);
});
