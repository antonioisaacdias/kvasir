import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type Database from 'better-sqlite3';
import { hasUser, registerUser, verifyCredentials } from './users';
import { createSession, verifySession, deleteSession } from './sessions';

const COOKIE_NAME = 'kvasir_session';

export function createAuthRoutes(db: Database.Database) {
  const auth = new Hono();

  auth.post('/register', async (c) => {
    if (hasUser(db)) {
      return c.json({ error: 'a user is already registered' }, 409);
    }
    const { username, password } = await c.req.json<{ username: string; password: string }>();
    await registerUser(db, username, password);
    const sessionId = createSession(db);
    setCookie(c, COOKIE_NAME, sessionId, { httpOnly: true, sameSite: 'Strict', path: '/' });
    return c.json({ username }, 201);
  });

  auth.post('/login', async (c) => {
    const { username, password } = await c.req.json<{ username: string; password: string }>();
    const user = await verifyCredentials(db, username, password);
    if (!user) {
      return c.json({ error: 'invalid credentials' }, 401);
    }
    const sessionId = createSession(db);
    setCookie(c, COOKIE_NAME, sessionId, { httpOnly: true, sameSite: 'Strict', path: '/' });
    return c.json({ username: user.username });
  });

  auth.post('/logout', (c) => {
    const sessionId = getCookie(c, COOKIE_NAME);
    if (sessionId) deleteSession(db, sessionId);
    setCookie(c, COOKIE_NAME, '', { httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 0 });
    return c.json({ ok: true });
  });

  return auth;
}

export function requireSession(db: Database.Database) {
  return async (c: Context, next: () => Promise<void>) => {
    const sessionId = getCookie(c, COOKIE_NAME);
    if (!sessionId || !verifySession(db, sessionId)) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    await next();
  };
}
