import { useState } from 'react';
import { download, type SearchResult } from '../lib/api';
import { useTranslation } from '../i18n/useTranslation';
import { useToast } from '../toast/ToastProvider';

type Status = 'idle' | 'downloading' | 'done' | 'already' | 'error';

interface Progress {
  bytesDownloaded: number;
  totalBytes: number | null;
}

export function ResultCard({
  result,
  alreadyDownloaded = false,
  onDownloaded,
}: {
  result: SearchResult;
  alreadyDownloaded?: boolean;
  onDownloaded?: () => void;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [retryAttempt, setRetryAttempt] = useState<number | null>(null);

  const effectiveStatus: Status = status === 'idle' && alreadyDownloaded ? 'already' : status;

  async function handleDownload() {
    setStatus('downloading');
    setProgress(null);
    setRetryAttempt(null);
    await download(result, (event) => {
      if (event.type === 'progress') {
        setRetryAttempt(null);
        setProgress({ bytesDownloaded: event.bytesDownloaded, totalBytes: event.totalBytes });
      } else if (event.type === 'retrying') {
        setRetryAttempt(event.attempt);
        setProgress(null);
      } else if (event.type === 'done') {
        setStatus('done');
        addToast(t('toastDownloaded').replace('{title}', result.title), 'success');
        onDownloaded?.();
      } else if (event.type === 'already') {
        setStatus('already');
      } else {
        setStatus('error');
        addToast(t('toastDownloadError').replace('{title}', result.title), 'error');
      }
    });
  }

  const label = {
    idle: t('download'),
    downloading: t('downloading'),
    done: t('downloaded'),
    already: t('alreadyDownloaded'),
    error: t('downloadError'),
  }[effectiveStatus];

  const progressPercent =
    progress?.totalBytes != null ? Math.min(100, Math.round((progress.bytesDownloaded / progress.totalBytes) * 100)) : null;

  return (
    <div className="flex flex-col gap-2 rounded border bg-white p-3">
      <div className="flex gap-3">
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
          disabled={effectiveStatus === 'downloading' || effectiveStatus === 'done' || effectiveStatus === 'already'}
          className="h-fit self-center rounded bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {label}
        </button>
      </div>
      {status === 'downloading' && (
        <div className="space-y-1">
          {retryAttempt !== null && (
            <p className="text-xs text-amber-600">{t('retryingAttempt').replace('{n}', String(retryAttempt))}</p>
          )}
          <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200">
            <div
              className={
                progressPercent === null
                  ? 'h-1.5 w-1/3 animate-pulse rounded bg-slate-500'
                  : 'h-1.5 rounded bg-slate-500 transition-[width]'
              }
              style={progressPercent === null ? undefined : { width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
