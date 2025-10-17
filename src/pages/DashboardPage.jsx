import { Link } from 'react-router-dom';

import { Card } from '../components/Card';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { hasShopifyProxy } from '../config/shopify';

const iconClassName = 'h-6 w-6 text-primary-700';

const GlobalPricingIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={iconClassName}
  >
    <circle cx="12" cy="12" r="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 12h16" strokeLinecap="round" />
    <path d="M12 4c2.5 2.2 4 5.6 4 8s-1.5 5.8-4 8c-2.5-2.2-4-5.6-4-8s1.5-5.8 4-8z" strokeLinecap="round" />
  </svg>
);

const BraceletIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={iconClassName}
  >
    <path d="M8 9a4 4 0 0 1 8 0" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 15a4 4 0 0 0 8 0" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.5 11.5h-1" strokeLinecap="round" />
    <path d="M18.5 12.5h-1" strokeLinecap="round" />
    <path d="M12 5.5v1.2" strokeLinecap="round" />
  </svg>
);

const NecklaceIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={iconClassName}
  >
    <path d="M5.5 9a6.5 6.5 0 0 0 13 0" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 12.5v3.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="18.5" r="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RingIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={iconClassName}
  >
    <circle cx="12" cy="13.5" r="4.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.5 7.5 12 5l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 8.8h6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HandChainIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={iconClassName}
  >
    <path d="M9.2 8.8 7.4 10.6a3 3 0 0 0 0 4.2l1.6 1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14.8 15.2 16.6 13.4a3 3 0 0 0 0-4.2l-1.6-1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10.5 14.5 13.5 11.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SetsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={iconClassName}
  >
    <path d="M7 9h10l2 3-2 3H7l-2-3z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 15.5 7.5 18h9l-1.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 8.5 7.5 6h9L15 8.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArchiveIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    className={iconClassName}
  >
    <path d="M4 7h16v3H4z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 10h12v9H6z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 13h4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Metric = ({ icon, label, value, tone = 'primary' }) => {
  const toneClasses = {
    primary: 'bg-brand-blush/60 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-500',
  };

  return (
    <div className="flex items-start gap-4 rounded-3xl border border-neutral-200/70 bg-white/85 p-6 shadow-[0_24px_68px_-42px_rgba(30,64,175,0.32)] backdrop-blur-sm">
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

const SectionIcon = ({ tone, icon: Icon }) => {
  const tones = {
    primary: 'bg-brand-blush/70 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-500',
  };

  const toneClass = tones[tone] ?? tones.primary;

  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}>
      {Icon ? <Icon /> : null}
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
      icon: GlobalPricingIcon,
    },
    {
      to: '/bracelets',
      tone: 'success',
      title: t('dashboard.section.braceletsTitle'),
      description: t('dashboard.section.braceletsBody'),
      icon: BraceletIcon,
    },
    {
      to: '/necklaces',
      tone: 'primary',
      title: t('dashboard.section.necklacesTitle'),
      description: t('dashboard.section.necklacesBody'),
      icon: NecklaceIcon,
    },
    {
      to: '/rings',
      tone: 'warning',
      title: t('dashboard.section.ringsTitle'),
      description: t('dashboard.section.ringsBody'),
      icon: RingIcon,
    },
    {
      to: '/hand-chains',
      tone: 'primary',
      title: t('dashboard.section.handChainsTitle'),
      description: t('dashboard.section.handChainsBody'),
      icon: HandChainIcon,
    },
    {
      to: '/sets',
      tone: 'success',
      title: t('dashboard.section.setsTitle'),
      description: t('dashboard.section.setsBody'),
      icon: SetsIcon,
    },
    {
      to: '/azor-archive',
      tone: 'primary',
      title: t('dashboard.section.azorArchiveTitle'),
      description: t('dashboard.section.azorArchiveBody'),
      icon: ArchiveIcon,
    },
  ];

  return (
    <div className="space-y-12">
      <Card className="border border-neutral-200/80 bg-white/90" title={t('dashboard.heroTitle')}>
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
              className="group relative block h-full overflow-hidden rounded-[26px] border border-neutral-200/80 bg-white/85 p-8 shadow-[0_26px_70px_-40px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_34px_90px_-44px_rgba(15,23,42,0.4)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_68%)] opacity-80" aria-hidden="true" />
              <div className="relative flex h-full flex-col gap-6">
                <div className="flex items-center gap-4">
                  <SectionIcon tone={section.tone} icon={section.icon} />
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
