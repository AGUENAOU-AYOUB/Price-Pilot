import { Link } from 'react-router-dom';

import { Card } from '../components/Card';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { hasShopifyProxy } from '../config/shopify';

const Metric = ({ icon, label, value, tone = 'primary' }) => {
  const toneClasses = {
    primary: 'bg-brand-blush/60 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-500',
  };

  return (
    <div className="flex items-start gap-4 rounded-3xl border border-brand-blush/60 bg-white/80 p-6 shadow-[0_22px_60px_-40px_rgba(139,58,98,0.55)] backdrop-blur-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses[tone] ?? toneClasses.primary}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">{label}</p>
        <p className="mt-3 text-3xl font-semibold text-brand-charcoal">{value}</p>
      </div>
    </div>
  );
};

const SectionIcon = ({ tone }) => {
  const tones = {
    primary: 'bg-brand-blush/70 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-500',
  };

  const toneClass = tones[tone] ?? tones.primary;

  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M12 6v12M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

export function DashboardPage() {
  const products = usePricingStore((state) => state.products);
  const { t } = useTranslation();
  const credentialsReady = hasShopifyProxy();

  const activeCount = products.filter((product) => product.status === 'active').length;
  const collections = new Set(
    products
      .map((product) => product.collection)
      .filter((collection) => typeof collection === 'string' && collection.length > 0),
  );
  const collectionCount = collections.size;

  const metrics = [
    {
      label: t('dashboard.activeProducts'),
      value: activeCount,
      tone: 'primary',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: t('dashboard.collections'),
      value: collectionCount,
      tone: 'primary',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path d="M4 4h16v4H4zM4 10h10v10H4zM16 10h4v10h-4z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: t('dashboard.automation'),
      value: credentialsReady ? t('dashboard.automationStatus') : t('dashboard.automationMissing'),
      tone: credentialsReady ? 'success' : 'warning',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  const sections = [
    {
      to: '/global-pricing',
      tone: 'primary',
      title: t('dashboard.section.globalTitle'),
      description: t('dashboard.section.globalBody'),
    },
    {
      to: '/bracelets',
      tone: 'success',
      title: t('dashboard.section.braceletsTitle'),
      description: t('dashboard.section.braceletsBody'),
    },
    {
      to: '/necklaces',
      tone: 'primary',
      title: t('dashboard.section.necklacesTitle'),
      description: t('dashboard.section.necklacesBody'),
    },
    {
      to: '/rings',
      tone: 'warning',
      title: t('dashboard.section.ringsTitle'),
      description: t('dashboard.section.ringsBody'),
    },
    {
      to: '/hand-chains',
      tone: 'primary',
      title: t('dashboard.section.handChainsTitle'),
      description: t('dashboard.section.handChainsBody'),
    },
    {
      to: '/sets',
      tone: 'success',
      title: t('dashboard.section.setsTitle'),
      description: t('dashboard.section.setsBody'),
    },
  ];

  return (
    <div className="space-y-12">
      <Card className="border border-brand-blush/60 bg-white/85" title={t('dashboard.heroTitle')}>
        <div className="space-y-6 text-base text-neutral-600">
          <p className="text-lg text-neutral-600">{t('dashboard.heroSubtitle')}</p>
          <p>{t('dashboard.heroBody')}</p>
          <div className="grid gap-5 md:grid-cols-3">
            {metrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </Card>

      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-brand-charcoal">{t('dashboard.sectionsTitle')}</h2>
            <p className="text-base text-neutral-500">{t('dashboard.sectionsSubtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              className="group relative block h-full overflow-hidden rounded-[26px] border border-brand-blush/60 bg-white/80 p-8 shadow-[0_24px_60px_-36px_rgba(139,58,98,0.45)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_30px_80px_-40px_rgba(139,58,98,0.55)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(195,100,149,0.15),_transparent_65%)] opacity-80" aria-hidden="true" />
              <div className="relative flex h-full flex-col gap-6">
                <div className="flex items-center gap-4">
                  <SectionIcon tone={section.tone} />
                  <span className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
                    {section.title}
                  </span>
                </div>
                <p className="text-xl font-semibold text-brand-charcoal">{section.title}</p>
                <p className="text-base text-neutral-500">{section.description}</p>
                <div className="mt-auto flex items-center gap-2 text-sm font-semibold text-primary-600">
                  <span>{t('dashboard.openWorkspace')}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-4 w-4 transition group-hover:translate-x-1"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
