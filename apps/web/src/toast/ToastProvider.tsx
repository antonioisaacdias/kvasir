import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant: ToastVariant) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 4000,
  error: 7000,
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = nextId++;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismissToast(id), AUTO_DISMISS_MS[variant]);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>{children}</ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
