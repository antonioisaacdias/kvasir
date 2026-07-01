import { describe, it, expect, vi, afterEach } from 'vitest';
import { download, type SearchResult, type DownloadEvent } from '../../src/lib/api';

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
}

const result: SearchResult = { source: 'gutenberg', externalId: '11', title: 'Alice' };

describe('download', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reassembles an SSE event split across two network chunks', async () => {
    const body = streamFromChunks(['data: {"typ', 'e":"progress","bytesDownloaded":50,"totalBytes":100}\n\n']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );

    const events: DownloadEvent[] = [];
    await download(result, (event) => events.push(event));

    expect(events).toEqual([{ type: 'progress', bytesDownloaded: 50, totalBytes: 100 }]);
  });

  it('parses multiple events delivered in a single chunk', async () => {
    const body = streamFromChunks([
      'data: {"type":"progress","bytesDownloaded":10,"totalBytes":100}\n\ndata: {"type":"done"}\n\n',
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    );

    const events: DownloadEvent[] = [];
    await download(result, (event) => events.push(event));

    expect(events).toEqual([
      { type: 'progress', bytesDownloaded: 10, totalBytes: 100 },
      { type: 'done' },
    ]);
  });

  it('reports an error event when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'unknown source x' }), { status: 400 })),
    );

    const events: DownloadEvent[] = [];
    await download(result, (event) => events.push(event));

    expect(events).toEqual([{ type: 'error', message: 'unknown source x' }]);
  });
});
