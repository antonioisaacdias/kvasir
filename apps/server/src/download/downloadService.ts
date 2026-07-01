import { createWriteStream, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type Database from 'better-sqlite3';
import type { SourceAdapter } from '../adapters/types.js';
import { findDownload, recordDownload } from '../db/downloads.js';

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
  const safeId = externalId.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${slug || 'book'}-${safeId || 'id'}.epub`;
}

function isTransientNetworkError(err: unknown): boolean {
  return err instanceof TypeError && err.message === 'fetch failed';
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientNetworkError(err) || attempt === attempts - 1) {
        throw err;
      }
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
  throw lastErr;
}

async function downloadToFile(adapter: SourceAdapter, externalId: string, filePath: string): Promise<void> {
  const webStream = await adapter.download(externalId);
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

  await withRetry(() => downloadToFile(adapter, meta.externalId, filePath));

  recordDownload(db, {
    source: meta.source,
    externalId: meta.externalId,
    title: meta.title,
    author: meta.author,
    downloadedAt: new Date().toISOString(),
  });

  return filePath;
}
