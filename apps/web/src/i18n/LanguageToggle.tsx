import { useTranslation } from './useTranslation';

export function LanguageToggle() {
  const { lang, setLang } = useTranslation();

  return (
    <div className="flex gap-1 text-xs">
      <button
        onClick={() => setLang('en')}
        className={lang === 'en' ? 'font-semibold underline' : 'text-slate-400'}
      >
        EN
      </button>
      <span className="text-slate-300">·</span>
      <button
        onClick={() => setLang('pt-BR')}
        className={lang === 'pt-BR' ? 'font-semibold underline' : 'text-slate-400'}
      >
        PT-BR
      </button>
    </div>
  );
}
