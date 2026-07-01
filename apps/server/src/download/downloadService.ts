import { createWriteStream, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type Database from 'better-sqlite3';
import type { SourceAdapter } from '../adapters/types';
import { findDownload, recordDownload } from '../db/downloads';

export class AlreadyDownloadedError extends Error {
  constructor(source: string, externalId: string) {
    super(`${source}/${externalId} was already downloaded`);
    this.name = 'AlreadyDownloadedError';
  }
}

export interface BookMeta {
  source: string;
  externalId: string;
  title: string;
  author?: string;
}

function safeFileName(title: string, externalId: string): string {
  const slug = title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${slug || 'book'}-${externalId}.epub`;
}

export async function downloadBook(
  db: Database.Database,
  ingestDir: string,
  adapter: SourceAdapter,
  meta: BookMeta,
): Promise<string> {
  if (findDownload(db, meta.source, meta.externalId)) {
    throw new AlreadyDownloadedError(meta.source, meta.externalId);
  }

  const filePath = join(ingestDir, safeFileName(meta.title, meta.externalId));
  const webStream = await adapter.download(meta.externalId);

  try {
    await pipeline(Readable.fromWeb(webStream as never), createWriteStream(filePath));
  } catch (err) {
    try {
      unlinkSync(filePath);
    } catch {
      // best-effort cleanup; nothing to do if the partial file is already gone
    }
    throw err;
  }

  recordDownload(db, {
    source: meta.source,
    externalId: meta.externalId,
    title: meta.title,
    author: meta.author,
    downloadedAt: new Date().toISOString(),
  });

  return filePath;
}
