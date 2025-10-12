import { clsx } from 'clsx';

const baseStyles =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70';

const variants = {
  primary:
    'bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500 text-white shadow-[0_18px_40px_-20px_rgba(139,58,98,0.6)] hover:shadow-[0_22px_50px_-22px_rgba(139,58,98,0.65)] disabled:shadow-none',
  secondary:
    'border border-brand-blush/70 bg-white/80 text-brand-charcoal shadow-[0_12px_30px_-20px_rgba(139,58,98,0.35)] hover:border-brand-rose/70 hover:bg-brand-blush/40',
  ghost: 'bg-transparent text-brand-charcoal hover:bg-brand-blush/35',
  danger:
    'bg-error-500 text-white shadow-[0_18px_40px_-20px_rgba(217,92,108,0.6)] hover:bg-error-500/90',
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
