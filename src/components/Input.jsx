import { forwardRef } from 'react';
import { clsx } from 'clsx';

export const Input = forwardRef(({ label, helperText, className, adornment, prefix, ...props }, ref) => {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      {label && <span className="font-semibold text-slate-700">{label}</span>}
      <div className="relative flex h-11 items-center rounded-md border border-slate-300 bg-white px-3 shadow-sm transition duration-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        {prefix && <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{prefix}</span>}
        <input
          ref={ref}
          className={clsx(
            'w-full border-none bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none',
            className,
          )}
          {...props}
        />
        {adornment && (
          <span className="ml-3 text-sm font-semibold text-slate-400" aria-hidden="true">
            {adornment}
          </span>
        )}
      </div>
      {helperText && <span className="text-xs text-slate-500">{helperText}</span>}
    </label>
  );
});

Input.displayName = 'Input';
