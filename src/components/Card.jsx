import { clsx } from 'clsx';

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section
      className={clsx(
        'rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {title && <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>}
            {subtitle && <p className="text-base text-neutral-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>
      )}
      <div className="space-y-6 text-base text-neutral-700">{children}</div>
    </section>
  );
}
