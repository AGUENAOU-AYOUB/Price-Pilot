import { forwardRef } from 'react';
import { clsx } from 'clsx';

export const Input = forwardRef(({ label, helperText, className, adornment, ...props }, ref) => {
  return (
    <label className="flex flex-col gap-2 text-sm text-[#5a6c7d]">
      {label && <span className="font-semibold text-[#1e2835]">{label}</span>}
      <div className="relative flex h-12 items-center rounded-xl border border-[#d4dde3] bg-white/90 px-4 text-[#1e2835] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] transition focus-within:border-[#1a3a4a] focus-within:ring-2 focus-within:ring-[#1a3a4a]/25">
        <input
          ref={ref}
          className={clsx(
            'w-full border-none bg-transparent text-base text-[#1e2835] placeholder:text-[#8aa0b1] focus:outline-none',
            className,
          )}
          {...props}
        />
        {adornment && (
          <span className="ml-3 text-sm font-semibold text-[#1a3a4a]" aria-hidden="true">
            {adornment}
          </span>
        )}
      </div>
      {helperText && <span className="text-xs text-[#5a6c7d]">{helperText}</span>}
    </label>
  );
});

Input.displayName = 'Input';
