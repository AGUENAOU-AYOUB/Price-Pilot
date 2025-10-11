import { forwardRef } from 'react';
import { clsx } from 'clsx';

export const Input = forwardRef(({ label, helperText, className, adornment, ...props }, ref) => {
  return (
    <label className="flex flex-col gap-2 text-sm text-gray-200">
      {label && <span className="font-medium text-gray-100">{label}</span>}
      <div className="relative flex h-12 items-center rounded-xl border border-gray-700 bg-gray-900/80 px-4 text-white shadow-inner transition focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-red-500/40">
        <input
          ref={ref}
          className={clsx(
            'w-full border-none bg-transparent text-base text-white placeholder:text-gray-400 focus:outline-none',
            className,
          )}
          {...props}
        />
        {adornment && (
          <span className="ml-3 text-sm font-medium text-gray-300" aria-hidden="true">
            {adornment}
          </span>
        )}
      </div>
      {helperText && <span className="text-sm text-gray-400">{helperText}</span>}
    </label>
  );
});

Input.displayName = 'Input';
