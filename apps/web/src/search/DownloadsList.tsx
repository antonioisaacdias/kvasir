import { useEffect, useState } from 'react';
import { listDownloads, type DownloadRecord } from '../lib/api';
import { useTranslation } from '../i18n/useTranslation';
import { Spinner } from '../ui/Spinner';

export function DownloadsList() {
  const { t } = useTranslation();
  const [downloads, setDownloads] = useState<DownloadRecord[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    listDownloads()
      .then(setDownloads)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="pt-12 text-center text-sm text-red-600">{t('loadError')}</p>;
  }

  if (downloads === null) {
    return (
      <div className="flex items-center gap-2 pt-12 text-sm text-slate-400">
        <Spinner />
        {t('loading')}
      </div>
    );
  }

  if (downloads.length === 0) {
    return <p className="pt-12 text-center text-sm text-slate-400">{t('noDownloadsYet')}</p>;
  }

  return (
    <div className="space-y-2">
      {downloads.map((d) => (
        <div key={`${d.source}-${d.externalId}`} className="rounded border bg-white p-3">
          <p className="font-medium">{d.title}</p>
          <p className="text-sm text-slate-500">
            {d.author ?? t('unknownAuthor')} · {d.source} · {new Date(d.downloadedAt).toLocaleDateString()}
          </p>
        </div>
      ))}
    </div>
  );
}
