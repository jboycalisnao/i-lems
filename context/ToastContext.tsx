import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  detail?: string;
  duration?: number;
}

export interface ToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  detail?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions | string) => void;
  removeToast: (id: string) => void;
  toast: {
    error: (message: string, title?: string, detail?: string) => void;
    warning: (message: string, title?: string, detail?: string) => void;
    success: (message: string, title?: string, detail?: string) => void;
    info: (message: string, title?: string, detail?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Module-level global listener for non-React or window.alert capture
let globalToastEmitter: ((item: ToastItem) => void) | null = null;

export const showToast = (options: ToastOptions | string) => {
  const opts: ToastOptions = typeof options === 'string' ? { message: options } : options;
  const item: ToastItem = {
    id: 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    type: opts.type || 'info',
    title: opts.title || (
      opts.type === 'error' ? 'Error' :
      opts.type === 'success' ? 'Success' :
      opts.type === 'warning' ? 'Notice' :
      'Information'
    ),
    message: opts.message,
    detail: opts.detail,
    duration: opts.duration !== undefined ? opts.duration : 5000
  };

  if (globalToastEmitter) {
    globalToastEmitter(item);
  }
};

export const toast = {
  error: (message: string, title?: string, detail?: string) => {
    showToast({ type: 'error', title: title || 'Error', message, detail });
  },
  warning: (message: string, title?: string, detail?: string) => {
    showToast({ type: 'warning', title: title || 'Notice', message, detail });
  },
  success: (message: string, title?: string, detail?: string) => {
    showToast({ type: 'success', title: title || 'Success', message, detail });
  },
  info: (message: string, title?: string, detail?: string) => {
    showToast({ type: 'info', title: title || 'Information', message, detail });
  }
};

// Global Native Alert Replacement
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = (message?: any) => {
    const rawMsg = message !== undefined && message !== null ? String(message) : '';
    let detectedType: ToastType = 'warning';
    let defaultTitle = 'System Notice';

    if (/fail|error|invalid|exceed|denied|cannot|require|required|wrong|crash/i.test(rawMsg)) {
      detectedType = 'error';
      defaultTitle = 'Action Required';
    } else if (/success|saved|copied|verified|completed|done|backed up/i.test(rawMsg)) {
      detectedType = 'success';
      defaultTitle = 'Success';
    } else if (/please|allow|check|verify|note/i.test(rawMsg)) {
      detectedType = 'info';
      defaultTitle = 'Notice';
    }

    showToast({
      type: detectedType,
      title: defaultTitle,
      message: rawMsg
    });
  };
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((item: ToastItem) => {
    setToasts(prev => [item, ...prev.slice(0, 4)]); // Maximum 5 simultaneous visible toasts

    if (item.duration && item.duration > 0) {
      setTimeout(() => {
        removeToast(item.id);
      }, item.duration);
    }
  }, [removeToast]);

  useEffect(() => {
    globalToastEmitter = addToast;
    return () => {
      globalToastEmitter = null;
    };
  }, [addToast]);

  const contextValue: ToastContextType = {
    showToast,
    removeToast,
    toast
  };

  const toastContainer = (
    <aside
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-5 left-5 z-[100000] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none"
    >
      {toasts.map((item) => {
        const isError = item.type === 'error';
        const isSuccess = item.type === 'success';
        const isWarning = item.type === 'warning';

        const iconContainerClass = isError
          ? 'bg-red-50 text-red-600 border border-red-200'
          : isSuccess
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : isWarning
          ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : 'bg-blue-50 text-blue-700 border border-blue-200';

        const titleTextClass = isError
          ? 'text-red-900'
          : isSuccess
          ? 'text-emerald-900'
          : isWarning
          ? 'text-amber-900'
          : 'text-blue-900';

        return (
          <div
            key={item.id}
            role="alert"
            className="pointer-events-auto bg-white border border-gray-200 shadow-2xl rounded-md p-3.5 flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-3 duration-200 select-text"
          >
            <div className={`p-1.5 rounded-md flex-shrink-0 ${iconContainerClass}`}>
              {isError && <AlertCircle className="w-5 h-5" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5" />}
              {isWarning && <AlertTriangle className="w-5 h-5" />}
              {!isError && !isSuccess && !isWarning && <Info className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h4 className={`text-xs font-bold leading-tight uppercase tracking-wider ${titleTextClass}`}>
                {item.title}
              </h4>
              <p className="text-xs text-gray-800 font-medium mt-1 leading-snug break-words">
                {item.message}
              </p>
              {item.detail && (
                <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed border-t border-gray-100 pt-1 break-words">
                  {item.detail}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="text-gray-400 hover:text-gray-700 p-1 -mr-1 -mt-1 rounded-sm hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
              title="Close Notification"
              aria-label="Close Notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </aside>
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {typeof document !== 'undefined' ? createPortal(toastContainer, document.body) : toastContainer}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    // Return standalone fallback so useToast can even be called outside provider
    return {
      showToast,
      removeToast: () => {},
      toast
    };
  }
  return context;
};

export default ToastProvider;
