import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/http/app';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const app = createApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
