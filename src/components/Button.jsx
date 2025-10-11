import { clsx } from 'clsx';

const baseStyles =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold tracking-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a3a4a]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60';

const variants = {
  primary:
    'bg-[#1a3a4a] text-white shadow-[0_20px_40px_-24px_rgba(26,58,74,0.65)] hover:bg-[#152d39] focus-visible:ring-[#1a3a4a]',
  secondary:
    'border border-[#1a3a4a] text-[#1a3a4a] bg-transparent hover:bg-[#e8f2f7] shadow-[0_16px_32px_-26px_rgba(26,58,74,0.4)]',
  ghost: 'bg-transparent text-[#5a6c7d] hover:bg-[#e8f2f7]/70',
  danger:
    'bg-[#d64545] text-white shadow-[0_20px_40px_-24px_rgba(214,69,69,0.55)] hover:bg-[#b93838] focus-visible:ring-[#d64545]',
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
