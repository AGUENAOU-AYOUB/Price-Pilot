import { forwardRef } from 'react';
import { clsx } from 'clsx';

export const Input = forwardRef(({ label, helperText, className, adornment, ...props }, ref) => {
  return (
    <label className="flex flex-col gap-2 text-sm text-neutral-800">
      {label && <span className="font-medium text-neutral-800">{label}</span>}
      <div className="relative flex h-12 items-center rounded-xl border border-neutral-300 bg-white px-4 transition focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-200">
        <input
          ref={ref}
          className={clsx(
            'w-full border-none bg-transparent text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none',
            className,
          )}
          {...props}
        />
        {adornment && (
          <span className="ml-3 text-sm font-medium text-neutral-500" aria-hidden="true">
            {adornment}
          </span>
        )}
      </div>
      {helperText && <span className="text-sm text-neutral-500">{helperText}</span>}
    </label>
  );
});

Input.displayName = 'Input';
