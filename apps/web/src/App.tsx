import { AuthGate } from './auth/AuthGate';
import { SearchPage } from './search/SearchPage';
import { I18nProvider } from './i18n/useTranslation';
import { ToastProvider } from './toast/ToastProvider';
import { ToastContainer } from './toast/ToastContainer';

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthGate>
          <SearchPage />
        </AuthGate>
        <ToastContainer />
      </ToastProvider>
    </I18nProvider>
  );
}
