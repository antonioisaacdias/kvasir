import { describe, it, expect } from 'vitest';
import { searchAllSources } from '../../src/search/searchService';
import type { SourceAdapter } from '../../src/adapters/types';

function fakeAdapter(id: string, behavior: 'ok' | 'fail'): SourceAdapter {
  return {
    id,
    async search() {
      if (behavior === 'fail') throw new Error(`${id} is down`);
      return [{ source: id, externalId: '1', title: `Book from ${id}` }];
    },
    async download() {
      throw new Error('not used in this test');
    },
  };
}

describe('searchAllSources', () => {
  it('aggregates results from every adapter that succeeds', async () => {
    const result = await searchAllSources('query', [fakeAdapter('a', 'ok'), fakeAdapter('b', 'ok')]);
    expect(result.results.map((r) => r.source)).toEqual(['a', 'b']);
    expect(result.errors).toEqual([]);
  });

  it('returns partial results and reports failing adapters without throwing', async () => {
    const result = await searchAllSources('query', [fakeAdapter('a', 'ok'), fakeAdapter('b', 'fail')]);
    expect(result.results.map((r) => r.source)).toEqual(['a']);
    expect(result.errors).toEqual([{ source: 'b', message: 'b is down' }]);
  });
});
