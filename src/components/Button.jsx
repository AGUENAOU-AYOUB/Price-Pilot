import { clsx } from 'clsx';

const baseStyles =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const variants = {
  primary: 'bg-primary-600 text-white shadow-sm hover:bg-primary-500 disabled:shadow-none',
  secondary:
    'border border-neutral-300 bg-white text-neutral-800 shadow-sm hover:border-primary-200 hover:bg-neutral-100',
  ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100',
  danger: 'bg-error-500 text-white shadow-sm hover:bg-red-500/90',
};

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export function Button({
  variant = 'primary',
  className,
  children,
  isLoading = false,
  loadingText,
  icon,
  disabled,
  ...props
}) {
  const content = isLoading ? (
    <>
      <Spinner />
      <span>{loadingText ?? children}</span>
    </>
  ) : (
    <>
      {icon}
      <span>{children}</span>
    </>
  );

  return (
    <button
      className={clsx(baseStyles, variants[variant] ?? variants.primary, className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {content}
    </button>
  );
}
