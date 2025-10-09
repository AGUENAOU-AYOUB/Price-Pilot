import { clsx } from 'clsx';

const baseStyles =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rosegold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const variants = {
  primary: 'bg-rosegold text-white hover:bg-champagne',
  secondary: 'bg-pearl text-charcoal border border-diamond hover:bg-blush',
  ghost: 'bg-transparent text-rosegold hover:bg-blush',
};

export function Button({ variant = 'primary', className, ...props }) {
  return <button className={clsx(baseStyles, variants[variant], className)} {...props} />;
}
