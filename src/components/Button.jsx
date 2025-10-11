import { clsx } from 'clsx';

const baseStyles =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60';

const variants = {
  primary: 'bg-white text-black shadow-2xl hover:bg-gray-100',
  secondary: 'border border-white/20 bg-white/5 text-gray-100 shadow-2xl hover:border-white/40 hover:bg-white/10',
  ghost: 'bg-transparent text-gray-300 hover:bg-white/10',
  danger: 'bg-red-600 text-white shadow-2xl hover:bg-red-500',
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
