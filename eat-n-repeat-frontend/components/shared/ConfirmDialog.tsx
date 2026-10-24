'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

type ConfirmVariant = 'danger' | 'warning' | 'info';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ isOpen: false, title: '', message: '' });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, isOpen: true, resolve });
    });
  }, []);

  const handleClose = (value: boolean) => {
    state.resolve?.(value);
    setState({ isOpen: false, title: '', message: '' });
  };

  const variantStyles: Record<ConfirmVariant, { icon: ReactNode; confirmBg: string }> = {
    danger: {
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      confirmBg: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
      confirmBg: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-500" />,
      confirmBg: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const variant = state.variant || 'warning';
  const styles = variantStyles[variant];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{styles.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-stone-900">{state.title}</h3>
                <p className="mt-1 text-[13px] text-stone-600 leading-relaxed">{state.message}</p>
              </div>
              <button onClick={() => handleClose(false)} className="shrink-0 p-1 text-stone-400 hover:text-stone-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-[13px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition"
              >
                {state.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-4 py-2 text-[13px] font-semibold text-white rounded-lg transition ${styles.confirmBg}`}
              >
                {state.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
