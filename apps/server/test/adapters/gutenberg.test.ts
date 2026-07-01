import { describe, it, expect, vi } from 'vitest';
import { gutenbergAdapter } from '../../src/adapters/gutenberg';

describe('gutenbergAdapter.search', () => {
  it('maps Gutendex results to SearchResult[]', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              id: 11,
              title: "Alice's Adventures in Wonderland",
              authors: [{ name: 'Carroll, Lewis' }],
              languages: ['en'],
              subjects: ['Fantasy fiction', "Children's stories"],
              formats: { 'image/jpeg': 'https://gutendex.com/cache/epub/11/pg11.cover.medium.jpg' },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const results = await gutenbergAdapter.search('alice', fakeFetch as unknown as typeof fetch);

    expect(results).toEqual([
      {
        source: 'gutenberg',
        externalId: '11',
        title: "Alice's Adventures in Wonderland",
        author: 'Carroll, Lewis',
        language: 'en',
        subjects: ['Fantasy fiction', "Children's stories"],
        coverUrl: 'https://gutendex.com/cache/epub/11/pg11.cover.medium.jpg',
      },
    ]);
    expect(fakeFetch).toHaveBeenCalledWith('https://gutendex.com/books/?search=alice');
  });
});

describe('gutenbergAdapter.download', () => {
  it('fetches the epub format URL for the given id', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 11,
            formats: { 'application/epub+zip': 'https://gutendex.com/cache/epub/11/pg11.epub' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-length': '3' } }),
      );

    const result = await gutenbergAdapter.download('11', fakeFetch as unknown as typeof fetch);

    expect(result.stream).toBeDefined();
    expect(result.totalBytes).toBe(3);
    expect(fakeFetch).toHaveBeenNthCalledWith(1, 'https://gutendex.com/books/11', { signal: undefined });
    expect(fakeFetch).toHaveBeenNthCalledWith(2, 'https://gutendex.com/cache/epub/11/pg11.epub', {
      signal: undefined,
    });
  });

  it('forwards an abort signal to both fetch calls', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 11,
            formats: { 'application/epub+zip': 'https://gutendex.com/cache/epub/11/pg11.epub' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const controller = new AbortController();

    await gutenbergAdapter.download('11', fakeFetch as unknown as typeof fetch, controller.signal);

    expect(fakeFetch).toHaveBeenNthCalledWith(1, 'https://gutendex.com/books/11', { signal: controller.signal });
    expect(fakeFetch).toHaveBeenNthCalledWith(2, 'https://gutendex.com/cache/epub/11/pg11.epub', {
      signal: controller.signal,
    });
  });

  it('returns totalBytes null when the response has no content-length', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 11,
            formats: { 'application/epub+zip': 'https://gutendex.com/cache/epub/11/pg11.epub' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const result = await gutenbergAdapter.download('11', fakeFetch as unknown as typeof fetch);

    expect(result.totalBytes).toBeNull();
  });
});
