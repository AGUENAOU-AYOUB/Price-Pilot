import { clsx } from 'clsx';

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section className={clsx('rounded-2xl bg-white p-6 shadow-sm ring-1 ring-platinum', className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-semibold text-charcoal">{title}</h2>}
            {subtitle && <p className="text-sm text-slategray">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="space-y-4 text-sm text-charcoal">{children}</div>
    </section>
  );
}
