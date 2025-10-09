import { forwardRef } from 'react';
import { clsx } from 'clsx';

export const Input = forwardRef(({ label, helperText, className, adornment, ...props }, ref) => {
  return (
    <label className="flex flex-col gap-1 text-sm text-charcoal">
      {label && <span className="font-medium">{label}</span>}
      <div className="flex items-center gap-2 rounded-lg border border-platinum bg-pearl px-3 py-2 focus-within:ring-2 focus-within:ring-rosegold">
        <input
          ref={ref}
          className={clsx('w-full border-none bg-transparent text-charcoal focus:outline-none', className)}
          {...props}
        />
        {adornment && <span className="text-slategray">{adornment}</span>}
      </div>
      {helperText && <span className="text-xs text-slategray">{helperText}</span>}
    </label>
  );
});

Input.displayName = 'Input';
