import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';

import { subscribeToToasts, ToastVariants, toast } from '../utils/toast';

import './ToastProvider.css';

const variantLabels = {
  [ToastVariants.SUCCESS]: 'Success',
  [ToastVariants.ERROR]: 'Error',
  [ToastVariants.WARNING]: 'Warning',
  [ToastVariants.INFO]: 'Notice',
  [ToastVariants.LOADING]: 'Processing',
};

const progressColors = {
  [ToastVariants.SUCCESS]: '#059669',
  [ToastVariants.ERROR]: '#ef4444',
  [ToastVariants.WARNING]: '#f59e0b',
  [ToastVariants.INFO]: '#2563eb',
  [ToastVariants.LOADING]: '#2563eb',
};

const icons = {
  [ToastVariants.SUCCESS]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  [ToastVariants.ERROR]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 9v4" strokeLinecap="round" />
      <circle cx="12" cy="16" r="0.5" fill="currentColor" />
      <path
        d="M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  [ToastVariants.WARNING]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 8v5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" />
      <path
        d="M10.29 3.86L1.82 18a1 1 0 00.86 1.5h18.64a1 1 0 00.86-1.5L13.71 3.86a1 1 0 00-1.72 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  [ToastVariants.INFO]: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 11v5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const Spinner = () => (
  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

const ToastIcon = ({ variant }) => {
  if (variant === ToastVariants.LOADING) {
    return <Spinner />;
  }

  return icons[variant] ?? icons[ToastVariants.INFO];
};

export function ToastProvider() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  useEffect(() => {
    const unsubscribe = subscribeToToasts((event) => {
      if (event.type === 'show') {
        setToasts((previous) => {
          const existing = previous.find((toastItem) => toastItem.id === event.payload.id);
          if (existing) {
            return previous.map((toastItem) =>
              toastItem.id === event.payload.id ? { ...toastItem, ...event.payload } : toastItem,
            );
          }
          return [...previous, event.payload];
        });

        if (!event.payload.persistent) {
          const timer = setTimeout(() => {
            dismiss(event.payload.id);
          }, event.payload.duration);
          timers.current.set(event.payload.id, timer);
        }
      }

      if (event.type === 'dismiss') {
        dismiss(event.payload.id);
      }
    });

    return () => {
      unsubscribe();
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
      timers.current.clear();
    };
  }, []);

  const dismiss = (id) => {
    setToasts((previous) => previous.filter((toastItem) => toastItem.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  };

  const renderedToasts = useMemo(
    () =>
      toasts.map((toastItem) => {
        const { id, variant, message, description, duration, persistent } = toastItem;
        const label = variantLabels[variant] ?? 'Notice';
        const color = progressColors[variant] ?? '#2563eb';

        return (
          <div key={id} className="toast-card" data-variant={variant} role="status" aria-live="polite">
            <div className="toast-icon" aria-hidden="true">
              <ToastIcon variant={variant} />
            </div>
            <div className="flex flex-col gap-1">
              <h4>{message}</h4>
              {description && <p>{description}</p>}
              <span className="sr-only">{label}</span>
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(id)}
              aria-label="Dismiss notification"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
              </svg>
            </button>
            {!persistent && (
              <span
                className={clsx('toast-progress')}
                style={{
                  color,
                  animationDuration: `${duration}ms`,
                }}
              />
            )}
          </div>
        );
      }),
    [toasts],
  );

  return <div className="toast-viewport">{renderedToasts}</div>;
}

export const useToast = () => toast;
