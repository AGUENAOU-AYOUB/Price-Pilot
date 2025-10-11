import { clsx } from 'clsx';

export function Card({ title, subtitle, actions, children, className }) {
  return (
    <section
      className={clsx(
        'rounded-3xl border border-[#d7e0e8] bg-white/95 p-8 shadow-[0_24px_60px_-28px_rgba(26,58,74,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_32px_70px_-32px_rgba(26,58,74,0.32)] backdrop-blur-sm',
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {title && <h2 className="text-2xl font-semibold text-[#1e2835]">{title}</h2>}
            {subtitle && <p className="text-base text-[#5a6c7d]">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3 text-[#1e2835]">{actions}</div>}
        </header>
      )}
      <div className="space-y-6 text-base text-[#1e2835]">{children}</div>
    </section>
  );
}
