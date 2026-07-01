import type Database from 'better-sqlite3';
import { hashPassword, verifyPassword } from './password.js';

export interface User {
  id: number;
  username: string;
}

export function hasUser(db: Database.Database): boolean {
  return db.prepare('SELECT 1 FROM users WHERE id = 1').get() !== undefined;
}

export async function registerUser(db: Database.Database, username: string, password: string): Promise<User> {
  if (hasUser(db)) {
    throw new Error('a user is already registered');
  }
  const passwordHash = await hashPassword(password);
  db.prepare('INSERT INTO users (id, username, password_hash) VALUES (1, ?, ?)').run(username, passwordHash);
  return { id: 1, username };
}

export async function verifyCredentials(
  db: Database.Database,
  username: string,
  password: string,
): Promise<User | undefined> {
  const row = db.prepare('SELECT username, password_hash AS passwordHash FROM users WHERE id = 1').get() as
    | { username: string; passwordHash: string }
    | undefined;
  if (!row || row.username !== username) return undefined;
  const ok = await verifyPassword(row.passwordHash, password);
  return ok ? { id: 1, username: row.username } : undefined;
}
