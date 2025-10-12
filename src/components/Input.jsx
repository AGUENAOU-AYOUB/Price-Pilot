import { forwardRef } from 'react';
import { clsx } from 'clsx';

export const Input = forwardRef(({ label, helperText, className, adornment, ...props }, ref) => {
  return (
    <label className="flex flex-col gap-2 text-sm text-brand-charcoal">
      {label && (
        <span className="font-medium uppercase tracking-[0.18em] text-xs text-neutral-500">
          {label}
        </span>
      )}
      <div className="relative flex h-12 items-center rounded-2xl border border-brand-blush/70 bg-white/80 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-primary-400 focus-within:shadow-[0_0_0_4px_rgba(195,100,149,0.18)]">
        <input
          ref={ref}
          className={clsx(
            'w-full border-none bg-transparent text-base text-brand-charcoal placeholder:text-neutral-400 focus:outline-none',
            className,
          )}
          {...props}
        />
        {adornment && (
          <span className="ml-3 text-sm font-semibold text-neutral-400" aria-hidden="true">
            {adornment}
          </span>
        )}
      </div>
      {helperText && <span className="text-xs text-neutral-400">{helperText}</span>}
    </label>
  );
});

Input.displayName = 'Input';
