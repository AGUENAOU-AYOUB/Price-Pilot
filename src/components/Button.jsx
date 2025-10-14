import { clsx } from 'clsx';

const baseStyles =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70';

const variants = {
  primary:
    'bg-primary-600 text-white shadow-[0_20px_45px_-24px_rgba(30,64,175,0.55)] hover:bg-primary-500 hover:shadow-[0_24px_55px_-24px_rgba(30,64,175,0.6)] disabled:shadow-none',
  secondary:
    'border border-neutral-200/80 bg-white/85 text-brand-charcoal shadow-[0_14px_36px_-24px_rgba(15,23,42,0.25)] hover:border-brand-rose/60 hover:bg-neutral-100',
  ghost: 'bg-transparent text-brand-charcoal hover:bg-neutral-100/80',
  danger:
    'bg-error-500 text-white shadow-[0_20px_45px_-24px_rgba(239,68,68,0.55)] hover:bg-error-500/90',
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
