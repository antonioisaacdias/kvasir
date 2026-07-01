import { useMemo, useState } from 'react';
import { search, type SearchOutcome } from '../lib/api';
import { ResultCard } from './ResultCard';
import { SourceFilter, type SourceFilterState } from './SourceFilter';
import { useTranslation } from '../i18n/useTranslation';
import { LanguageToggle } from '../i18n/LanguageToggle';

const ALL_SOURCES: SourceFilterState = { gutenberg: true, 'standard-ebooks': true };

export function SearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilterState>(ALL_SOURCES);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOutcome(await search(query));
  }

  const visibleResults = useMemo(
    () => outcome?.results.filter((r) => sourceFilter[r.source as keyof SourceFilterState] !== false) ?? [],
    [outcome, sourceFilter],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kvasir</h1>
        <LanguageToggle />
      </div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="rounded bg-slate-800 px-4 py-2 text-white">
          {t('search')}
        </button>
      </form>

      <SourceFilter state={sourceFilter} onChange={setSourceFilter} />

      {outcome?.errors.map((err) => (
        <p key={err.source} className="text-sm text-amber-600">
          {err.source} {t('sourceUnavailable')}: {err.message}
        </p>
      ))}

      {!outcome && <p className="pt-12 text-center text-sm text-slate-400">{t('emptyHint')}</p>}

      <div className="space-y-2">
        {visibleResults.map((r) => (
          <ResultCard key={`${r.source}-${r.externalId}`} result={r} />
        ))}
      </div>
    </div>
  );
}
