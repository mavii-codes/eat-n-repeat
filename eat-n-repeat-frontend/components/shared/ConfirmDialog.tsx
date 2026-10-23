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

/* Runs async work inside the open dialog. Return a string to hold the dialog
   open and surface that message verbatim (e.g. a backend 409 like "Close the
   open shift first."); return null to confirm and close. */
type ConfirmActionRunner = () => Promise<string | null> | string | null;

interface ConfirmActionOptions extends ConfirmOptions {
  action: ConfirmActionRunner;
  /** Button copy while the action is in flight (default "Working…"). */
  workingLabel?: string;
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
  runner?: ConfirmActionRunner;
  workingLabel?: string;
  busy?: boolean;
  actionError?: string | null;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmAction: (options: ConfirmActionOptions) => Promise<boolean>;
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
      setState({ ...options, isOpen: true, resolve, runner: undefined, busy: false, actionError: null });
    });
  }, []);

  const confirmAction = useCallback((options: ConfirmActionOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...options,
        isOpen: true,
        resolve,
        runner: options.action,
        workingLabel: options.workingLabel || 'Working…',
        busy: false,
        actionError: null,
      });
    });
  }, []);

  const handleClose = (value: boolean) => {
    state.resolve?.(value);
    setState({ isOpen: false, title: '', message: '' });
  };

  /* Confirm button handler. Plain confirms resolve instantly; action confirms
     run the action with the visible spinner, and only close on success. */
  const handleConfirm = async () => {
    const { runner } = state;
    if (!runner || state.busy) {
      if (!state.busy) handleClose(true);
      return;
    }
    setState((s) => ({ ...s, busy: true, actionError: null }));
    try {
      const actionError = await runner();
      if (actionError) {
        // Keep the dialog open and show the backend message verbatim.
        setState((s) => ({ ...s, busy: false, actionError }));
        return;
      }
      state.resolve?.(true);
      setState({ isOpen: false, title: '', message: '' });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        busy: false,
        actionError: err?.message || 'Something went wrong. Try again.',
      }));
    }
  };

  // Cancelling mid-action would leave the call racing with a closed dialog,
  // so the side is simply locked while the spinner is up.
  const handleCancel = () => {
    if (state.busy) return;
    handleClose(false);
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
  const busy = state.busy === true;

  return (
    <ConfirmContext.Provider value={{ confirm, confirmAction }}>
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
              <button disabled={busy} onClick={handleCancel} className="shrink-0 p-1 text-stone-400 hover:text-stone-600 transition disabled:opacity-40">
                <X className="w-4 h-4" />
              </button>
            </div>
            {state.actionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
                {state.actionError}
              </p>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button
                disabled={busy}
                onClick={handleCancel}
                className="px-4 py-2 text-[13px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {state.cancelLabel || 'Cancel'}
              </button>
              <button
                disabled={busy}
                onClick={handleConfirm}
                className={`px-4 py-2 text-[13px] font-semibold text-white rounded-lg transition ${styles.confirmBg} disabled:opacity-70`}
              >
                {busy && (
                  <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-2px]"></span>
                )}
                {busy ? state.workingLabel || 'Working…' : state.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
