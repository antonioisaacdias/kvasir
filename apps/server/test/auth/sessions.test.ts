import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/index';
import { createSession, verifySession, deleteSession, sha256 } from '../../src/auth/sessions';

describe('sessions', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  it('creates a session id that later verifies as valid', () => {
    const sessionId = createSession(db);
    expect(verifySession(db, sessionId)).toBe(true);
  });

  it('rejects an unknown session id', () => {
    expect(verifySession(db, 'not-a-real-session')).toBe(false);
  });

  it('invalidates a session after delete', () => {
    const sessionId = createSession(db);
    deleteSession(db, sessionId);
    expect(verifySession(db, sessionId)).toBe(false);
  });

  it('rejects a session older than the TTL', () => {
    const sessionId = createSession(db);
    const ancientDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE auth_sessions SET created_at = ? WHERE id_hash = ?').run(
      ancientDate,
      sha256(sessionId),
    );
    expect(verifySession(db, sessionId)).toBe(false);
  });
});
