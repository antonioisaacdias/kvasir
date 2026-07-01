import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { dictionary, type Lang, type TranslationKey } from './dictionary';

const STORAGE_KEY = 'kvasir-lang';

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'pt-BR' ? 'pt-BR' : 'en';
}

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [langState, setLangState] = useState<Lang>(readStoredLang);

  function setLang(next: Lang) {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }

  const value = useMemo<I18nContextValue>(
    () => ({ lang: langState, setLang, t: (key) => dictionary[langState][key] }),
    [langState],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider, same pattern as Tormod
export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
