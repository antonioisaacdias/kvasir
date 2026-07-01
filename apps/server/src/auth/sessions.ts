import { randomBytes, createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createSession(db: Database.Database): string {
  const sessionId = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_sessions (id_hash, created_at) VALUES (?, ?)').run(
    sha256(sessionId),
    new Date().toISOString(),
  );
  return sessionId;
}

export function verifySession(db: Database.Database, sessionId: string): boolean {
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();
  return (
    db
      .prepare('SELECT 1 FROM auth_sessions WHERE id_hash = ? AND created_at > ?')
      .get(sha256(sessionId), cutoff) !== undefined
  );
}

export function deleteSession(db: Database.Database, sessionId: string): void {
  db.prepare('DELETE FROM auth_sessions WHERE id_hash = ?').run(sha256(sessionId));
}
