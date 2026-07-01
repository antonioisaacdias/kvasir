import { describe, it, expect, vi } from 'vitest';
import { standardEbooksAdapter } from '../../src/adapters/standardEbooks';

// Captured (and trimmed) from a real response of
// https://standardebooks.org/feeds/opds/all?query=alices+adventures+in+wonderland
// on 2026-07-01. Kept close to the real shape (namespaces, self-closing <category/>
// elements, multiple acquisition links with the "/open-access" rel suffix, nested
// <author> children) since the hand-rolled fixture this replaced didn't match reality
// and masked a live parsing bug.
const FEED_XML = `<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet href="https://standardebooks.org/feeds/opds/style" type="text/xsl"?>
	<feed xmlns="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:schema="http://schema.org/" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">
		<id>https://standardebooks.org/feeds/opds/all?query=alices+adventures+in+wonderland&amp;page=1&amp;per-page=12</id>
		<link href="https://standardebooks.org/feeds/opds/all?query=alices+adventures+in+wonderland&amp;page=1&amp;per-page=12" rel="self" type="application/atom+xml;profile=opds-catalog; charset=utf-8"/>
		<opensearch:totalResults>1</opensearch:totalResults>
		<title>Search Results</title>
		<updated>2026-07-01T03:37:22Z</updated>
		<author>
			<name>Standard Ebooks</name>
			<uri>https://standardebooks.org</uri>
		</author>
					<entry>
	<id>https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel</id>
	<dc:identifier>https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel</dc:identifier>
	<title>Alice’s Adventures in Wonderland</title>
			<author>
			<name>Lewis Carroll</name>
			<uri>https://standardebooks.org/ebooks/lewis-carroll</uri>
							<schema:alternateName>Charles Lutwidge Dodgson</schema:alternateName>
										<schema:sameAs>https://en.wikipedia.org/wiki/Lewis_Carroll</schema:sameAs>
					</author>
		<published>2014-05-25T00:00:00Z</published>
	<dc:issued>2014-05-25T00:00:00Z</dc:issued>
	<updated>2026-06-27T16:27:29Z</updated>
	<dc:language>en-GB</dc:language>
	<dc:publisher>Standard Ebooks</dc:publisher>
	<rights>Public domain in the United States.</rights>
	<summary type="text">A young girl follows a white rabbit into a strange land of poetry, humor, and whimsy.</summary>
			<category scheme="http://purl.org/dc/terms/LCSH" term="Fantasy"/>
				<category scheme="https://standardebooks.org/vocab/subjects" term="Children’s"/>
			<category scheme="https://standardebooks.org/vocab/subjects" term="Fiction"/>
		<link href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/downloads/cover.jpg" rel="http://opds-spec.org/image" type="image/jpeg"/>
	<link href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/downloads/cover-thumbnail.jpg" rel="http://opds-spec.org/image/thumbnail" type="image/jpeg"/>
	<link href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel" rel="alternate" title="This ebook’s page at Standard Ebooks" type="application/xhtml+xml"/>
			<link href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/downloads/lewis-carroll_alices-adventures-in-wonderland_john-tenniel.epub?source=feed" length="10635802" rel="http://opds-spec.org/acquisition/open-access" title="Recommended compatible epub" type="application/epub+zip" />
				<link href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/downloads/lewis-carroll_alices-adventures-in-wonderland_john-tenniel_advanced.epub?source=feed" length="25726409" rel="http://opds-spec.org/acquisition/open-access" title="Advanced epub" type="application/epub+zip" />
				<link href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/downloads/lewis-carroll_alices-adventures-in-wonderland_john-tenniel.kepub.epub?source=feed" length="25514108" rel="http://opds-spec.org/acquisition/open-access" title="Kobo Kepub epub" type="application/kepub+zip" />
				<link href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/downloads/lewis-carroll_alices-adventures-in-wonderland_john-tenniel.azw3?source=feed" length="10730054" rel="http://opds-spec.org/acquisition/open-access" title="Amazon Kindle azw3" type="application/x-mobipocket-ebook" />
				<link href="https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/text/single-page" length="73824215" rel="http://opds-spec.org/acquisition/open-access" title="XHTML" type="application/xhtml+xml" />
	</entry>
			</feed>`;

describe('standardEbooksAdapter.search', () => {
  it('parses the OPDS Atom feed into SearchResult[]', async () => {
    const fakeFetch = vi.fn(async () => new Response(FEED_XML, { status: 200 }));

    const results = await standardEbooksAdapter.search('alices adventures in wonderland', fakeFetch as unknown as typeof fetch);

    expect(results).toEqual([
      {
        source: 'standard-ebooks',
        externalId: 'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel',
        title: 'Alice’s Adventures in Wonderland',
        author: 'Lewis Carroll',
        language: 'en-GB',
        subjects: ['Fantasy', 'Children’s', 'Fiction'],
        coverUrl: 'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/downloads/cover.jpg',
      },
    ]);
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://standardebooks.org/feeds/opds/all?query=alices%20adventures%20in%20wonderland',
    );
  });
});

describe('standardEbooksAdapter.download', () => {
  it('re-fetches the entry by re-searching its book-title slug, then picks the recommended epub acquisition link', async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(FEED_XML, { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

    const id = 'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel';
    const stream = await standardEbooksAdapter.download(id, fakeFetch as unknown as typeof fetch);

    expect(stream).toBeDefined();
    expect(fakeFetch).toHaveBeenNthCalledWith(
      1,
      'https://standardebooks.org/feeds/opds/all?query=alices%20adventures%20in%20wonderland',
    );
    expect(fakeFetch).toHaveBeenNthCalledWith(
      2,
      'https://standardebooks.org/ebooks/lewis-carroll/alices-adventures-in-wonderland/john-tenniel/downloads/lewis-carroll_alices-adventures-in-wonderland_john-tenniel.epub?source=feed',
    );
  });
});
