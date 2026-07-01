export interface SearchResult {
  source: string;
  externalId: string;
  title: string;
  author?: string;
  coverUrl?: string;
  language?: string;
  subjects?: string[];
}

export interface SourceAdapter {
  id: string;
  search(query: string, fetchFn?: typeof fetch): Promise<SearchResult[]>;
  download(externalId: string, fetchFn?: typeof fetch): Promise<ReadableStream<Uint8Array>>;
}
