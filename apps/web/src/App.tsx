import { AuthGate } from './auth/AuthGate';
import { SearchPage } from './search/SearchPage';
import { I18nProvider } from './i18n/useTranslation';

export default function App() {
  return (
    <I18nProvider>
      <AuthGate>
        <SearchPage />
      </AuthGate>
    </I18nProvider>
  );
}
