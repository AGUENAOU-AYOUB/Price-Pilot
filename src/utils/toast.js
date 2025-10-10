const listeners = new Set();
let counter = 0;

const createEvent = (type, payload) => ({ type, payload });

export const subscribeToToasts = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (event) => {
  for (const listener of listeners) {
    listener(event);
  }
};

const show = (variant, message, options = {}) => {
  const id = options.id ?? `toast-${Date.now()}-${counter++}`;
  const duration = Number.isFinite(options.duration) ? options.duration : 4000;

  const toast = {
    id,
    variant,
    message,
    description: options.description ?? null,
    duration,
    persistent: options.persistent ?? duration === Infinity,
    createdAt: Date.now(),
  };

  emit(createEvent('show', toast));
  return id;
};

const dismiss = (id) => {
  emit(createEvent('dismiss', { id }));
};

export const toast = {
  success: (message, options) => show('success', message, options),
  error: (message, options) => show('error', message, options),
  warning: (message, options) => show('warning', message, options),
  info: (message, options) => show('info', message, options),
  loading: (message, options = {}) =>
    show('loading', message, { ...options, duration: Infinity, persistent: true }),
  dismiss,
};

export const ToastVariants = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  LOADING: 'loading',
};
