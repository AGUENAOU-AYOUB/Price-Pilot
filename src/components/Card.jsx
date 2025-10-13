import { clsx } from 'clsx';

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section
      className={clsx(
        'relative overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white/85 p-10 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_36px_90px_-44px_rgba(15,23,42,0.4)]',
        'before:pointer-events-none before:absolute before:-inset-1 before:bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_62%)] before:opacity-70 before:content-[""]',
        className,
      )}
    >
      <div className="relative z-10 space-y-8 text-base text-neutral-600">
        {(title || actions) && (
          <header className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-2">
              {title && (
                <h2 className="text-3xl font-semibold tracking-tight text-brand-charcoal">
                  <span className="bg-gradient-to-r from-primary-700 via-primary-600 to-secondary-500 bg-clip-text text-transparent">
                    {title}
                  </span>
                </h2>
              )}
              {subtitle && <p className="text-base text-neutral-500">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </header>
        )}
        <div className="space-y-6 text-base text-neutral-600">{children}</div>
      </div>
    </section>
  );
}
