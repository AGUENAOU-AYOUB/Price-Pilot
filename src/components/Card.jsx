import { clsx } from 'clsx';

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section
      className={clsx(
        'rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm ring-1 ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:p-8',
        className,
      )}
    >
      <div className="space-y-6 text-base text-slate-600">
        {(title || actions) && (
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              {title && <h2 className="text-xl font-semibold text-slate-900">{title}</h2>}
              {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
        )}
        <div className="space-y-4 text-sm text-slate-600">{children}</div>
      </div>
    </section>
  );
}
