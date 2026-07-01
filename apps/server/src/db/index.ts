import Database from 'better-sqlite3';

export function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      source        TEXT NOT NULL,
      external_id   TEXT NOT NULL,
      title         TEXT NOT NULL,
      author        TEXT,
      downloaded_at TEXT NOT NULL,
      PRIMARY KEY (source, external_id)
    );
  `);
}

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  migrate(db);
  return db;
}
