import { createWriteStream, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
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

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number | null;
}

export type OnProgress = (progress: DownloadProgress) => void;
export type OnRetry = (attempt: number) => void;

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

async function withRetry<T>(
  fn: () => Promise<T>,
  onRetry?: OnRetry,
  attempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientNetworkError(err) || attempt === attempts - 1) {
        throw err;
      }
      onRetry?.(attempt + 2);
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
  throw lastErr;
}

function trackProgress(
  webStream: ReadableStream<Uint8Array>,
  totalBytes: number | null,
  onProgress?: OnProgress,
): ReadableStream<Uint8Array> {
  if (!onProgress) return webStream;
  let bytesDownloaded = 0;
  return webStream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytesDownloaded += chunk.byteLength;
        onProgress({ bytesDownloaded, totalBytes });
        controller.enqueue(chunk);
      },
    }),
  );
}

// A retried attempt tracks bytes from zero again (it's a fresh stream), so a client
// watching progress will see it drop back down after a retry — this reflects the real
// byte count of the new attempt rather than a bug in the counter.
async function downloadToFile(
  adapter: SourceAdapter,
  externalId: string,
  filePath: string,
  onProgress?: OnProgress,
  signal?: AbortSignal,
): Promise<void> {
  const { stream: webStream, totalBytes } = await adapter.download(externalId, undefined, signal);
  const tracked = trackProgress(webStream, totalBytes, onProgress);
  const writeStream = createWriteStream(filePath);
  try {
    await pipeline(Readable.fromWeb(tracked as unknown as NodeWebReadableStream), writeStream, { signal });
  } catch (err) {
    // pipeline() destroys writeStream on failure, but the underlying file descriptor
    // may still be mid-open at that point (timing varies across Node versions) — wait
    // for the stream to genuinely close before unlinking, so we don't race a partial
    // file into existing right after we tried to clean it up.
    await new Promise<void>((resolve) => {
      if (writeStream.closed) {
        resolve();
        return;
      }
      writeStream.once('close', () => resolve());
      writeStream.destroy();
    });
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
  onProgress?: OnProgress,
  signal?: AbortSignal,
  onRetry?: OnRetry,
): Promise<string> {
  if (findDownload(db, meta.source, meta.externalId)) {
    throw new AlreadyDownloadedError(meta.source, meta.externalId);
  }

  const filePath = join(ingestDir, safeFileName(meta.title, meta.externalId));

  await withRetry(() => downloadToFile(adapter, meta.externalId, filePath, onProgress, signal), onRetry);

  recordDownload(db, {
    source: meta.source,
    externalId: meta.externalId,
    title: meta.title,
    author: meta.author,
    downloadedAt: new Date().toISOString(),
  });

  return filePath;
}
