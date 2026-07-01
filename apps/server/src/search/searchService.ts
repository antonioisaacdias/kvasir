import type { SearchResult, SourceAdapter } from '../adapters/types';

export interface SearchError {
  source: string;
  message: string;
}

export interface SearchOutcome {
  results: SearchResult[];
  errors: SearchError[];
}

export async function searchAllSources(query: string, adapters: SourceAdapter[]): Promise<SearchOutcome> {
  const settled = await Promise.allSettled(adapters.map((adapter) => adapter.search(query)));

  const results: SearchResult[] = [];
  const errors: SearchError[] = [];

  settled.forEach((outcome, index) => {
    const source = adapters[index].id;
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value);
    } else {
      errors.push({ source, message: (outcome.reason as Error).message });
    }
  });

  return { results, errors };
}
