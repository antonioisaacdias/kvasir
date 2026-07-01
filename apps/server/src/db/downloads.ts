import type Database from 'better-sqlite3';

export interface DownloadRecord {
  source: string;
  externalId: string;
  title: string;
  author?: string;
  downloadedAt: string;
}

export function findDownload(
  db: Database.Database,
  source: string,
  externalId: string,
): DownloadRecord | undefined {
  const row = db
    .prepare(
      `SELECT source, external_id AS externalId, title, author, downloaded_at AS downloadedAt
       FROM downloads WHERE source = ? AND external_id = ?`,
    )
    .get(source, externalId) as DownloadRecord | undefined;
  return row;
}

export function recordDownload(db: Database.Database, record: DownloadRecord): void {
  db.prepare(
    `INSERT INTO downloads (source, external_id, title, author, downloaded_at)
     VALUES (@source, @externalId, @title, @author, @downloadedAt)`,
  ).run(record);
}
