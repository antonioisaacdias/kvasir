import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/index';
import { findDownload, recordDownload, listDownloads } from '../../src/db/downloads';

describe('downloads store', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  it('returns undefined when nothing was downloaded yet', () => {
    expect(findDownload(db, 'gutenberg', '11')).toBeUndefined();
  });

  it('records a download and finds it by source+externalId', () => {
    recordDownload(db, {
      source: 'gutenberg',
      externalId: '11',
      title: "Alice's Adventures in Wonderland",
      author: 'Lewis Carroll',
      downloadedAt: '2026-06-30T12:00:00.000Z',
    });

    const found = findDownload(db, 'gutenberg', '11');
    expect(found?.title).toBe("Alice's Adventures in Wonderland");
  });

  it('rejects a duplicate (source, externalId) pair', () => {
    const record = {
      source: 'gutenberg',
      externalId: '11',
      title: 'Alice',
      author: 'Lewis Carroll',
      downloadedAt: '2026-06-30T12:00:00.000Z',
    };
    recordDownload(db, record);
    expect(() => recordDownload(db, record)).toThrow();
  });

  it('returns an empty list when nothing was downloaded yet', () => {
    expect(listDownloads(db)).toEqual([]);
  });

  it('lists downloads ordered by most recent first', () => {
    recordDownload(db, {
      source: 'gutenberg',
      externalId: '11',
      title: 'Alice',
      author: 'Lewis Carroll',
      downloadedAt: '2026-06-30T12:00:00.000Z',
    });
    recordDownload(db, {
      source: 'standard-ebooks',
      externalId: 'https://standardebooks.org/ebooks/x',
      title: 'Dracula',
      author: 'Bram Stoker',
      downloadedAt: '2026-06-30T13:00:00.000Z',
    });

    const all = listDownloads(db);
    expect(all.map((d) => d.title)).toEqual(['Dracula', 'Alice']);
  });
});
