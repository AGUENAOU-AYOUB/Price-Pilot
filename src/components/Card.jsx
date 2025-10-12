import { clsx } from 'clsx';

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section
      className={clsx(
        'relative overflow-hidden rounded-[28px] border border-brand-blush/50 bg-white/80 p-10 shadow-[0_26px_70px_-36px_rgba(139,58,98,0.45)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_30px_80px_-40px_rgba(139,58,98,0.5)]',
        'before:pointer-events-none before:absolute before:-inset-1 before:bg-[radial-gradient(circle_at_top,_rgba(195,100,149,0.18),_transparent_60%)] before:opacity-70 before:content-[""]',
        className,
      )}
    >
      <div className="relative z-10 space-y-8 text-base text-neutral-600">
        {(title || actions) && (
          <header className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-2">
              {title && (
                <h2 className="text-3xl font-semibold tracking-tight text-brand-charcoal">
                  <span className="bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-500 bg-clip-text text-transparent">
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
