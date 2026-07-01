import { useToast } from './ToastProvider';

const VARIANT_CLASSES = {
  success: 'bg-emerald-700',
  error: 'bg-red-700',
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded px-4 py-2 text-sm text-white shadow-lg ${VARIANT_CLASSES[toast.variant]}`}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={() => dismissToast(toast.id)} className="text-white/80 hover:text-white">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
