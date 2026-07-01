import { describe, it, expect, vi } from 'vitest';
import { standardEbooksAdapter } from '../../src/adapters/standardEbooks';

const FEED_XML = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog" xmlns:dc="http://purl.org/dc/terms/">
  <entry>
    <id>https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland</id>
    <title>Alice's Adventures in Wonderland</title>
    <author><name>Lewis Carroll</name></author>
    <dc:language>en</dc:language>
    <category term="Fiction"/>
    <category term="Fantasy"/>
    <link rel="http://opds-spec.org/acquisition"
          type="application/epub+zip"
          href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/downloads/alice.epub"/>
    <link rel="http://opds-spec.org/image"
          type="image/jpeg"
          href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/downloads/cover-thumbnail.jpg"/>
  </entry>
</feed>`;

describe('standardEbooksAdapter.search', () => {
  it('parses the OPDS Atom feed into SearchResult[]', async () => {
    const fakeFetch = vi.fn(async () => new Response(FEED_XML, { status: 200 }));

    const results = await standardEbooksAdapter.search('alice', fakeFetch as unknown as typeof fetch);

    expect(results).toEqual([
      {
        source: 'standard-ebooks',
        externalId: 'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland',
        title: "Alice's Adventures in Wonderland",
        author: 'Lewis Carroll',
        language: 'en',
        subjects: ['Fiction', 'Fantasy'],
        coverUrl: 'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/downloads/cover-thumbnail.jpg',
      },
    ]);
    expect(fakeFetch).toHaveBeenCalledWith('https://standardebooks.org/opds/search?query=alice');
  });
});

describe('standardEbooksAdapter.download', () => {
  it('re-fetches the entry to resolve the acquisition link, then downloads it', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(FEED_XML, { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const id = 'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland';
    const stream = await standardEbooksAdapter.download(id, fakeFetch as unknown as typeof fetch);

    expect(stream).toBeDefined();
    expect(fakeFetch).toHaveBeenNthCalledWith(
      2,
      'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/downloads/alice.epub',
    );
  });
});
