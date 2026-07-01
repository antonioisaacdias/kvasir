import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/index';
import { findDownload } from '../../src/db/downloads';
import { downloadBook, AlreadyDownloadedError } from '../../src/download/downloadService';
import type { SourceAdapter } from '../../src/adapters/types';

function streamOf(bytes: number[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
}

describe('downloadBook', () => {
  let db: Database.Database;
  let ingestDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    ingestDir = mkdtempSync(join(tmpdir(), 'kvasir-ingest-'));
  });

  it('writes the stream to the ingest folder and records it', async () => {
    const adapter: SourceAdapter = {
      id: 'gutenberg',
      async search() {
        return [];
      },
      async download() {
        return streamOf([1, 2, 3]);
      },
    };

    const filePath = await downloadBook(db, ingestDir, adapter, {
      source: 'gutenberg',
      externalId: '11',
      title: "Alice's Adventures in Wonderland",
      author: 'Lewis Carroll',
    });

    expect(existsSync(filePath)).toBe(true);
    expect(Array.from(readFileSync(filePath))).toEqual([1, 2, 3]);
    expect(findDownload(db, 'gutenberg', '11')?.title).toBe("Alice's Adventures in Wonderland");
  });

  it('refuses to re-download an already-recorded book', async () => {
    const adapter: SourceAdapter = {
      id: 'gutenberg',
      async search() {
        return [];
      },
      download: vi.fn(async () => streamOf([1])),
    };
    const meta = { source: 'gutenberg', externalId: '11', title: 'Alice', author: 'Lewis Carroll' };

    await downloadBook(db, ingestDir, adapter, meta);
    await expect(downloadBook(db, ingestDir, adapter, meta)).rejects.toBeInstanceOf(AlreadyDownloadedError);
    expect(adapter.download).toHaveBeenCalledTimes(1);
  });

  it('does not record a download that fails mid-stream', async () => {
    const adapter: SourceAdapter = {
      id: 'gutenberg',
      async search() {
        return [];
      },
      async download() {
        return new ReadableStream({
          start(controller) {
            controller.error(new Error('connection reset'));
          },
        });
      },
    };
    const meta = { source: 'gutenberg', externalId: '12', title: 'Broken', author: 'Nobody' };

    await expect(downloadBook(db, ingestDir, adapter, meta)).rejects.toThrow('connection reset');
    expect(findDownload(db, 'gutenberg', '12')).toBeUndefined();
    expect(readdirSync(ingestDir)).toEqual([]);
  });

  describe('retry on transient network errors', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('retries a transient network error and eventually succeeds', async () => {
      const adapter: SourceAdapter = {
        id: 'gutenberg',
        async search() {
          return [];
        },
        download: vi
          .fn()
          .mockRejectedValueOnce(new TypeError('fetch failed'))
          .mockResolvedValueOnce(streamOf([1, 2, 3])),
      };
      const meta = { source: 'gutenberg', externalId: '20', title: 'Retry Me', author: 'Someone' };

      const promise = downloadBook(db, ingestDir, adapter, meta);
      await vi.advanceTimersByTimeAsync(5000);
      const filePath = await promise;

      expect(existsSync(filePath)).toBe(true);
      expect(adapter.download).toHaveBeenCalledTimes(2);
    });

    it('does not retry a non-network error', async () => {
      const adapter: SourceAdapter = {
        id: 'gutenberg',
        async search() {
          return [];
        },
        download: vi.fn().mockRejectedValue(new Error('no epub format available')),
      };
      const meta = { source: 'gutenberg', externalId: '21', title: 'No Epub', author: 'Someone' };

      await expect(downloadBook(db, ingestDir, adapter, meta)).rejects.toThrow('no epub format available');
      expect(adapter.download).toHaveBeenCalledTimes(1);
    });

    it('gives up after repeated transient network errors', async () => {
      const adapter: SourceAdapter = {
        id: 'gutenberg',
        async search() {
          return [];
        },
        download: vi.fn().mockRejectedValue(new TypeError('fetch failed')),
      };
      const meta = { source: 'gutenberg', externalId: '22', title: 'Always Fails', author: 'Someone' };

      const promise = downloadBook(db, ingestDir, adapter, meta);
      const assertion = expect(promise).rejects.toThrow('fetch failed');
      await vi.advanceTimersByTimeAsync(10000);
      await assertion;
      expect(adapter.download).toHaveBeenCalledTimes(3);
    });
  });
});
