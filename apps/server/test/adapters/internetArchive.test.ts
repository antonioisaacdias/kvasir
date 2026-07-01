import { describe, it, expect, vi } from 'vitest';
import { internetArchiveAdapter } from '../../src/adapters/internetArchive';

describe('internetArchiveAdapter.search', () => {
  it('maps search results to SearchResult[], normalizing 3-letter language codes', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          response: {
            docs: [
              {
                identifier: 'memoriasPostumasBrasCubas',
                title: 'Memórias Póstumas de Brás Cubas',
                creator: 'Machado de Assis',
                language: 'por',
                subject: ['Literatura Brasileira', 'Romance'],
              },
              {
                identifier: 'helena_202503',
                title: 'Helena',
                creator: 'Machado de Assis',
                language: 'por',
                subject: 'Literatura Brasileira',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const results = await internetArchiveAdapter.search('machado de assis', fakeFetch as unknown as typeof fetch);

    expect(results).toEqual([
      {
        source: 'internet-archive',
        externalId: 'memoriasPostumasBrasCubas',
        title: 'Memórias Póstumas de Brás Cubas',
        author: 'Machado de Assis',
        language: 'pt',
        subjects: ['Literatura Brasileira', 'Romance'],
        coverUrl: 'https://archive.org/services/img/memoriasPostumasBrasCubas',
      },
      {
        source: 'internet-archive',
        externalId: 'helena_202503',
        title: 'Helena',
        author: 'Machado de Assis',
        language: 'pt',
        subjects: ['Literatura Brasileira'],
        coverUrl: 'https://archive.org/services/img/helena_202503',
      },
    ]);

    const calledUrl = fakeFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('archive.org/advancedsearch.php');
    expect(calledUrl).toContain('mediatype%3Atexts');
    expect(calledUrl).toContain('licenseurl');
  });

  it('handles an array creator by using the first author', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          response: {
            docs: [
              {
                identifier: 'multiauthor',
                title: 'Co-written Work',
                creator: ['First Author', 'Second Author'],
                language: 'eng',
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const results = await internetArchiveAdapter.search('test', fakeFetch as unknown as typeof fetch);

    expect(results[0].author).toBe('First Author');
    expect(results[0].language).toBe('en');
    expect(results[0].subjects).toBeUndefined();
  });

  it('drops unrecognized language values instead of passing them through raw', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          response: {
            docs: [{ identifier: 'oddlang', title: 'Odd Language Item', language: 'Majorcan' }],
          },
        }),
        { status: 200 },
      ),
    );

    const results = await internetArchiveAdapter.search('test', fakeFetch as unknown as typeof fetch);

    expect(results[0].language).toBeUndefined();
  });

  it('constrains the query to public-domain, non-restricted texts', async () => {
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify({ response: { docs: [] } }), { status: 200 }));

    await internetArchiveAdapter.search('test', fakeFetch as unknown as typeof fetch);

    const calledUrl = fakeFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('-access-restricted-item%3Atrue');
  });
});

describe('internetArchiveAdapter.download', () => {
  it('finds the EPUB file from item metadata and downloads it', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            metadata: { 'access-restricted-item': 'false' },
            files: [
              { name: 'memoriasBras_djvu.txt', format: 'DjVu XML' },
              { name: 'memoriasBras.epub', format: 'EPUB' },
              { name: 'memoriasBras.pdf', format: 'Text PDF' },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-length': '3' } }),
      );

    const result = await internetArchiveAdapter.download(
      'memoriasPostumasBrasCubas',
      fakeFetch as unknown as typeof fetch,
    );

    expect(result.stream).toBeDefined();
    expect(result.totalBytes).toBe(3);
    expect(fakeFetch).toHaveBeenNthCalledWith(1, 'https://archive.org/metadata/memoriasPostumasBrasCubas', {
      signal: undefined,
    });
    expect(fakeFetch).toHaveBeenNthCalledWith(
      2,
      'https://archive.org/download/memoriasPostumasBrasCubas/memoriasBras.epub',
      { signal: undefined },
    );
  });

  it('throws when no EPUB format is available', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ metadata: { 'access-restricted-item': 'false' }, files: [{ name: 'book.pdf', format: 'Text PDF' }] }),
        { status: 200 },
      ),
    );

    await expect(
      internetArchiveAdapter.download('no-epub-item', fakeFetch as unknown as typeof fetch),
    ).rejects.toThrow('no epub format available');
  });

  it('throws when the item is access-restricted, even if it slipped past the search filter', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          metadata: { 'access-restricted-item': 'true' },
          files: [{ name: 'restricted.epub', format: 'EPUB' }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      internetArchiveAdapter.download('restricted-item', fakeFetch as unknown as typeof fetch),
    ).rejects.toThrow('access-restricted');
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('throws when the file download itself returns a non-ok status', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            metadata: { 'access-restricted-item': 'false' },
            files: [{ name: 'book.epub', format: 'EPUB' }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('<title>Unauthorized</title>', { status: 401 }));

    await expect(
      internetArchiveAdapter.download('unauthorized-item', fakeFetch as unknown as typeof fetch),
    ).rejects.toThrow('HTTP 401');
  });
});
