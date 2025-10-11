import { Link } from 'react-router-dom';

import { Card } from '../components/Card';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { hasShopifyProxy } from '../config/shopify';

const Metric = ({ icon, label, value, tone = 'neutral' }) => {
  const toneClasses =
    tone === 'success'
      ? 'bg-[#e8f5f0] text-[#1f5c43] border border-[#b7dfcb]'
      : tone === 'warning'
      ? 'bg-[#fff7e6] text-[#8a5a12] border border-[#f2d59a]'
      : 'bg-[#e8f2f7] text-[#1a3a4a] border border-[#c5d9e3]';

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[#d7e0e8] bg-white/95 p-5 text-[#1e2835] shadow-[0_20px_50px_-28px_rgba(26,58,74,0.28)]">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneClasses}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#5a6c7d]">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-[#1e2835]">{value}</p>
      </div>
    </div>
  );
};

const SectionIcon = ({ tone }) => {
  const tones = {
    primary: 'bg-[#e8f2f7] text-[#1a3a4a] border border-[#c5d9e3]',
    success: 'bg-[#e8f5f0] text-[#1f5c43] border border-[#b7dfcb]',
    warning: 'bg-[#fff7e6] text-[#8a5a12] border border-[#f2d59a]',
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
    <div className="space-y-12">
      <Card title={t('dashboard.heroTitle')}>
        <div className="space-y-6 text-base text-[#5a6c7d]">
          <p className="text-lg font-medium text-[#1e2835]">{t('dashboard.heroSubtitle')}</p>
          <p>{t('dashboard.heroBody')}</p>
          <div className="grid gap-5 md:grid-cols-3">
            {metrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </div>
        </div>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#1e2835]">{t('dashboard.sectionsTitle')}</h2>
            <p className="text-base text-[#5a6c7d]">{t('dashboard.sectionsSubtitle')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              className="group block h-full rounded-3xl border border-[#d7e0e8] bg-white/95 p-8 text-[#1e2835] shadow-[0_26px_70px_-34px_rgba(26,58,74,0.3)] transition duration-200 hover:-translate-y-1 hover:border-[#c2d3dd] hover:shadow-[0_32px_80px_-36px_rgba(26,58,74,0.35)] focus:outline-none focus:ring-2 focus:ring-[#1a3a4a]/40"
            >
              <div className="flex h-full flex-col gap-6">
                <div className="flex items-center gap-4">
                  <SectionIcon tone={section.tone} />
                  <span className="text-sm font-medium uppercase tracking-[0.24em] text-[#5a6c7d]">
                    {section.title}
                  </span>
                </div>
                <p className="text-lg font-semibold text-[#1e2835]">{section.title}</p>
                <p className="text-base text-[#5a6c7d]">{section.description}</p>
                <div className="mt-auto flex items-center gap-2 text-sm font-semibold text-[#1a3a4a]">
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
