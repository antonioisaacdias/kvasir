import { useState } from 'react';
import { download, type SearchResult } from '../lib/api';
import { useTranslation } from '../i18n/useTranslation';

export function ResultCard({ result }: { result: SearchResult }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'downloading' | 'done' | 'already' | 'error'>('idle');

  async function handleDownload() {
    setStatus('downloading');
    const res = await download(result);
    if (res.status === 201) setStatus('done');
    else if (res.status === 409) setStatus('already');
    else setStatus('error');
  }

  const label = {
    idle: t('download'),
    downloading: t('downloading'),
    done: t('downloaded'),
    already: t('alreadyDownloaded'),
    error: t('downloadError'),
  }[status];

  return (
    <div className="flex gap-3 rounded border bg-white p-3">
      {result.coverUrl ? (
        <img src={result.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover" />
      ) : (
        <div className="h-20 w-14 shrink-0 rounded bg-slate-300" />
      )}
      <div className="flex-1">
        <p className="font-medium">{result.title}</p>
        <p className="text-sm text-slate-500">
          {result.author ?? t('unknownAuthor')} · {result.source}
          {result.language ? ` · ${result.language.toUpperCase()}` : ''}
        </p>
        {result.subjects && result.subjects.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {result.subjects.map((subject) => (
              <span key={subject} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {subject}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={handleDownload}
        disabled={status === 'downloading' || status === 'done' || status === 'already'}
        className="h-fit self-center rounded bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}
