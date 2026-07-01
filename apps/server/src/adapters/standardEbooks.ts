import { XMLParser } from 'fast-xml-parser';
import type { SearchResult, SourceAdapter } from './types.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

interface AtomLink {
  '@_rel': string;
  '@_type': string;
  '@_href': string;
}

interface AtomCategory {
  '@_term': string;
}

interface AtomEntry {
  id: string;
  title: string;
  author: { name: string };
  link: AtomLink | AtomLink[];
  category?: AtomCategory | AtomCategory[];
  'dc:language'?: string;
}

interface AtomFeed {
  feed: {
    entry?: AtomEntry | AtomEntry[];
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function acquisitionLink(entry: AtomEntry): string | undefined {
  return asArray(entry.link).find(
    (link) => link['@_rel'] === 'http://opds-spec.org/acquisition' && link['@_type'] === 'application/epub+zip',
  )?.['@_href'];
}

function imageLink(entry: AtomEntry): string | undefined {
  return asArray(entry.link).find((link) => link['@_rel'] === 'http://opds-spec.org/image')?.['@_href'];
}

function subjects(entry: AtomEntry): string[] | undefined {
  const categories = asArray(entry.category).map((c) => c['@_term']);
  return categories.length > 0 ? categories : undefined;
}

async function fetchEntry(id: string, fetchFn: typeof fetch): Promise<AtomEntry | undefined> {
  // The id doubles as the entry's canonical URL; searching by it re-fetches the same feed shape.
  const res = await fetchFn(`https://standardebooks.org/opds/search?query=${encodeURIComponent(id)}`);
  const feed = parser.parse(await res.text()) as AtomFeed;
  return asArray(feed.feed.entry)[0];
}

export const standardEbooksAdapter: SourceAdapter = {
  id: 'standard-ebooks',

  async search(query, fetchFn = fetch) {
    const url = `https://standardebooks.org/opds/search?query=${encodeURIComponent(query)}`;
    const res = await fetchFn(url);
    const feed = parser.parse(await res.text()) as AtomFeed;
    return asArray(feed.feed.entry).map(
      (entry): SearchResult => ({
        source: 'standard-ebooks',
        externalId: entry.id,
        title: entry.title,
        author: entry.author?.name,
        language: entry['dc:language'],
        subjects: subjects(entry),
        coverUrl: imageLink(entry),
      }),
    );
  },

  async download(externalId, fetchFn = fetch) {
    const entry = await fetchEntry(externalId, fetchFn);
    const epubUrl = entry && acquisitionLink(entry);
    if (!epubUrl) {
      throw new Error(`no epub acquisition link found for standard-ebooks entry ${externalId}`);
    }
    const fileRes = await fetchFn(epubUrl);
    if (!fileRes.body) {
      throw new Error(`empty response body downloading standard-ebooks entry ${externalId}`);
    }
    return fileRes.body;
  },
};
