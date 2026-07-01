import type { SearchResult, SourceAdapter } from './types.js';

interface GutendexAuthor {
  name: string;
}

interface GutendexBook {
  id: number;
  title: string;
  authors: GutendexAuthor[];
  languages?: string[];
  subjects?: string[];
  formats?: Record<string, string>;
}

interface GutendexSearchResponse {
  results: GutendexBook[];
}

export const gutenbergAdapter: SourceAdapter = {
  id: 'gutenberg',

  async search(query, fetchFn = fetch) {
    const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
    const res = await fetchFn(url);
    const body = (await res.json()) as GutendexSearchResponse;
    return body.results.map(
      (book): SearchResult => ({
        source: 'gutenberg',
        externalId: String(book.id),
        title: book.title,
        author: book.authors[0]?.name,
        language: book.languages?.[0],
        subjects: book.subjects,
        coverUrl: book.formats?.['image/jpeg'],
      }),
    );
  },

  async download(externalId, fetchFn = fetch, signal = undefined) {
    const bookRes = await fetchFn(`https://gutendex.com/books/${externalId}`, { signal });
    const book = (await bookRes.json()) as GutendexBook;
    const epubUrl = book.formats?.['application/epub+zip'];
    if (!epubUrl) {
      throw new Error(`no epub format available for gutenberg book ${externalId}`);
    }
    const fileRes = await fetchFn(epubUrl, { signal });
    if (!fileRes.body) {
      throw new Error(`empty response body downloading gutenberg book ${externalId}`);
    }
    const contentLength = fileRes.headers.get('content-length');
    return { stream: fileRes.body, totalBytes: contentLength ? Number(contentLength) : null };
  },
};
