import { useCallback, useEffect, useMemo, useState } from 'react';
import { search, listDownloads, type SearchOutcome } from '../lib/api';
import { ResultCard } from './ResultCard';
import { SourceFilter, type SourceFilterState } from './SourceFilter';
import { Spinner } from '../ui/Spinner';
import { DownloadsList } from './DownloadsList';
import { useTranslation } from '../i18n/useTranslation';
import { LanguageToggle } from '../i18n/LanguageToggle';

const ALL_SOURCES: SourceFilterState = { gutenberg: true, 'standard-ebooks': true };

function downloadKey(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

export function SearchPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilterState>(ALL_SOURCES);
  const [isSearching, setIsSearching] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [downloadedKeys, setDownloadedKeys] = useState<Set<string> | null>(null);

  const refreshDownloadedKeys = useCallback(() => {
    listDownloads().then((downloads) => {
      setDownloadedKeys(new Set(downloads.map((d) => downloadKey(d.source, d.externalId))));
    });
  }, []);

  useEffect(() => {
    refreshDownloadedKeys();
  }, [refreshDownloadedKeys]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setIsSearching(true);
    try {
      setOutcome(await search(query));
    } finally {
      setIsSearching(false);
    }
  }

  const visibleResults = useMemo(
    () => outcome?.results.filter((r) => sourceFilter[r.source as keyof SourceFilterState] !== false) ?? [],
    [outcome, sourceFilter],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kvasir</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-xs text-slate-500 underline"
            onClick={() => setShowDownloads((v) => !v)}
          >
            {showDownloads ? t('backToSearch') : t('viewDownloads')}
          </button>
          <LanguageToggle />
        </div>
      </div>

      {showDownloads ? (
        <DownloadsList />
      ) : (
        <>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching}
              className="flex items-center gap-2 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
            >
              {isSearching && <Spinner />}
              {isSearching ? t('searching') : t('search')}
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
              <ResultCard
                key={`${r.source}-${r.externalId}`}
                result={r}
                alreadyDownloaded={downloadedKeys?.has(downloadKey(r.source, r.externalId)) ?? false}
                onDownloaded={refreshDownloadedKeys}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
