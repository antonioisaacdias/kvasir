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
    (link) => link['@_rel'].startsWith('http://opds-spec.org/acquisition') && link['@_type'] === 'application/epub+zip',
  )?.['@_href'];
}

function imageLink(entry: AtomEntry): string | undefined {
  return asArray(entry.link).find((link) => link['@_rel'] === 'http://opds-spec.org/image')?.['@_href'];
}

function subjects(entry: AtomEntry): string[] | undefined {
  const categories = asArray(entry.category).map((c) => c['@_term']);
  return categories.length > 0 ? categories : undefined;
}

function searchUrl(query: string): string {
  return `https://standardebooks.org/feeds/opds/all?query=${encodeURIComponent(query)}`;
}

function slugSearchTerms(id: string): string {
  // externalId is the entry's canonical ebook page URL, shaped as
  // https://standardebooks.org/ebooks/<author-slug>/<book-slug>[/<illustrator-or-translator-slug>].
  // There is no per-book OPDS entry endpoint, so re-derive search terms from the book-title
  // slug (the segment right after the author) and re-run the catalog search to find the
  // matching entry again. The trailing illustrator/translator slug is unreliable as search
  // input (rarely indexed by the catalog's full-text search).
  const segments = id.split('/').filter(Boolean);
  const ebooksIndex = segments.indexOf('ebooks');
  const bookSlug = ebooksIndex >= 0 ? segments[ebooksIndex + 2] : undefined;
  return (bookSlug ?? segments.pop() ?? id).replace(/-/g, ' ');
}

async function fetchEntry(id: string, fetchFn: typeof fetch): Promise<AtomEntry | undefined> {
  const res = await fetchFn(searchUrl(slugSearchTerms(id)));
  const feed = parser.parse(await res.text()) as AtomFeed;
  return asArray(feed.feed.entry).find((entry) => entry.id === id);
}

export const standardEbooksAdapter: SourceAdapter = {
  id: 'standard-ebooks',

  async search(query, fetchFn = fetch) {
    const res = await fetchFn(searchUrl(query));
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
