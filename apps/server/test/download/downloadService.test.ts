import { describe, it, expect, beforeEach, vi } from 'vitest';
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
});
