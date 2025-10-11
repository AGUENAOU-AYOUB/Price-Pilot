import { Link } from 'react-router-dom';

import { Card } from '../components/Card';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { hasShopifyProxy } from '../config/shopify';

const Metric = ({ icon, label, value, tone = 'neutral' }) => {
  const toneClasses =
    tone === 'success'
      ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30'
      : tone === 'warning'
      ? 'bg-amber-500/15 text-amber-200 border border-amber-400/30'
      : 'bg-rose-500/15 text-rose-200 border border-rose-400/30';

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-gray-200 shadow-2xl backdrop-blur-xl">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneClasses}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      </div>
    </div>
  );
};

const SectionIcon = ({ tone }) => {
  const tones = {
    primary: 'bg-rose-500/20 text-rose-200 border border-rose-400/30',
    success: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30',
    warning: 'bg-amber-500/20 text-amber-200 border border-amber-400/30',
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
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: t('dashboard.collections'),
      value: collectionCount,
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
    {
      to: '/spec-sets',
      tone: 'warning',
      title: t('dashboard.section.specSetsTitle'),
      description: t('dashboard.section.specSetsBody'),
    },
  ];

  return (
    <div className="space-y-10">
      <Card className="border-white/10 bg-black/70" title={t('dashboard.heroTitle')}>
        <div className="space-y-6 text-base text-gray-300">
          <p className="text-lg text-gray-200">{t('dashboard.heroSubtitle')}</p>
          <p>{t('dashboard.heroBody')}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {metrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{t('dashboard.sectionsTitle')}</h2>
            <p className="text-base text-gray-300">{t('dashboard.sectionsSubtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              className="group block h-full rounded-3xl border border-white/10 bg-white/5 p-8 text-gray-200 shadow-2xl transition duration-200 hover:-translate-y-1 hover:border-white/30 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              <div className="flex h-full flex-col gap-6">
                <div className="flex items-center gap-4">
                  <SectionIcon tone={section.tone} />
                  <span className="text-sm font-medium uppercase tracking-[0.2em] text-gray-400">
                    {section.title}
                  </span>
                </div>
                <p className="text-lg font-semibold text-white">{section.title}</p>
                <p className="text-base text-gray-300">{section.description}</p>
                <div className="mt-auto flex items-center gap-2 text-sm font-semibold text-rose-200">
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
