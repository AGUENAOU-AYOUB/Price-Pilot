import { forwardRef } from 'react';
import { clsx } from 'clsx';

export const Select = forwardRef(({ label, helperText, className, options = [], ...props }, ref) => {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      {label && <span className="font-semibold text-slate-700">{label}</span>}
      <div className="relative flex h-11 items-center rounded-md border border-slate-300 bg-white px-3 shadow-sm transition duration-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
        <select
          ref={ref}
          className={clsx(
            'w-full appearance-none border-none bg-transparent text-base text-slate-900 focus:outline-none',
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 flex h-5 w-5 items-center justify-center text-slate-400" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      {helperText && <span className="text-xs text-slate-500">{helperText}</span>}
    </label>
  );
});

Select.displayName = 'Select';
