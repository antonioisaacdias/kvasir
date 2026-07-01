import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/index';
import { createApp } from '../../src/http/app';
import * as usersModule from '../../src/auth/users';

function cookieFrom(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? '';
  return setCookie.split(';')[0];
}

describe('auth http flow', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  it('rejects protected routes with no session', async () => {
    const app = createApp({ db, ingestDir: '/tmp' });
    const res = await app.request('/api/search?q=alice');
    expect(res.status).toBe(401);
  });

  it('registers on first use, then allows login and access to protected routes', async () => {
    const app = createApp({ db, ingestDir: '/tmp' });

    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'odin', password: 'correct horse battery staple' }),
    });
    expect(register.status).toBe(201);
    const cookie = cookieFrom(register);

    const protectedRes = await app.request('/api/search?q=alice', { headers: { cookie } });
    expect(protectedRes.status).not.toBe(401);
  });

  it('refuses a second registration once a user exists', async () => {
    const app = createApp({ db, ingestDir: '/tmp' });
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'odin', password: 'correct horse battery staple' }),
    });

    const second = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'someone-else', password: 'another password' }),
    });
    expect(second.status).toBe(409);
  });

  it('returns 409 instead of a raw 500 when the app-level pre-check loses the race', async () => {
    const app = createApp({ db, ingestDir: '/tmp' });
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'odin', password: 'correct horse battery staple' }),
    });

    // Simulate two requests interleaving before either write lands: force the
    // handler's `hasUser` pre-check to report "no user yet" even though one
    // was already registered above, so the request falls through to
    // `registerUser`, which then hits the DB's PRIMARY KEY constraint.
    const hasUserSpy = vi.spyOn(usersModule, 'hasUser').mockReturnValue(false);

    const racing = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'someone-else', password: 'another password' }),
    });

    hasUserSpy.mockRestore();

    expect(racing.status).toBe(409);
    const body = await racing.json();
    expect(body).toEqual({ error: 'a user is already registered' });
  });
});
