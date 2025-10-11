import { clsx } from 'clsx';

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section
      className={clsx(
        'rounded-2xl border border-white/10 bg-black/80 p-8 shadow-2xl transition-all hover:border-white/20 hover:shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {title && <h2 className="text-2xl font-semibold text-white">{title}</h2>}
            {subtitle && <p className="text-base text-gray-300">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>
      )}
      <div className="space-y-6 text-base text-gray-200">{children}</div>
    </section>
  );
}
