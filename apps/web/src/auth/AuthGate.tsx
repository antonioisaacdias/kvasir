import { useEffect, useState, type ReactNode } from 'react';
import { login, register, getCurrentUser } from '../lib/api';
import { useTranslation } from '../i18n/useTranslation';
import { LanguageToggle } from '../i18n/LanguageToggle';
import { Spinner } from '../ui/Spinner';

export function AuthGate({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((user) => setAuthenticated(user !== null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = mode === 'login' ? await login(username, password) : await register(username, password);
      if (res.ok) {
        setAuthenticated(true);
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? t('authError'));
      }
    } catch {
      setError(t('authError'));
    }
  }

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Spinner className="h-6 w-6 text-slate-400" />
      </div>
    );
  }

  if (authenticated) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-80 space-y-3 rounded bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Kvasir</h1>
          <LanguageToggle />
        </div>
        {mode === 'register' && <p className="text-xs text-slate-500">{t('firstAccess')}</p>}
        <input
          className="w-full rounded border px-3 py-2"
          placeholder={t('username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="w-full rounded border px-3 py-2"
          type="password"
          placeholder={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded bg-slate-800 px-3 py-2 text-white">
          {mode === 'login' ? t('login') : t('register')}
        </button>
        <button
          type="button"
          className="w-full text-xs text-slate-500 underline"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? t('firstAccessCta') : t('haveAccount')}
        </button>
      </form>
    </div>
  );
}
