import { Card } from '../components/Card';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { hasShopifyProxy } from '../config/shopify';

const MetricIcon = ({ children, tone }) => (
  <div
    className={`flex h-12 w-12 items-center justify-center rounded-xl ${
      tone === 'primary'
        ? 'bg-primary-100 text-primary-600'
        : tone === 'success'
        ? 'bg-success-500/10 text-success-600'
        : 'bg-warning-500/10 text-warning-500'
    }`}
  >
    {children}
  </div>
);

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

  const automationTone = credentialsReady ? 'success' : 'warning';
  const automationLabel = credentialsReady
    ? t('dashboard.automationStatus')
    : t('dashboard.automationMissing');

  return (
    <div className="space-y-8">
      <Card title={t('dashboard.welcomeTitle')} subtitle={t('dashboard.welcomeSubtitle')}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-neutral-600">{t('dashboard.welcomeBody')}</p>
            <ul className="space-y-3 text-base text-neutral-600">
              <li>• {t('dashboard.welcomeBullet1')}</li>
              <li>• {t('dashboard.welcomeBullet2')}</li>
              <li>• {t('dashboard.welcomeBullet3')}</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-white/60 p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-neutral-900">{t('dashboard.checklistTitle')}</h3>
            <ol className="mt-4 space-y-3 text-base text-neutral-600">
              <li>1. {t('dashboard.checklistStep1')}</li>
              <li>2. {t('dashboard.checklistStep2')}</li>
              <li>3. {t('dashboard.checklistStep3')}</li>
            </ol>
          </div>
        </div>
      </Card>

      <Card title={t('dashboard.catalogTitle')}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
            <MetricIcon tone="primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
              </svg>
            </MetricIcon>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                {t('dashboard.activeProducts')}
              </p>
              <p className="mt-2 text-3xl font-semibold text-neutral-900">{activeCount}</p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
            <MetricIcon tone="primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path d="M4 4h16v4H4zM4 10h10v10H4zM16 10h4v10h-4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MetricIcon>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                {t('dashboard.collections')}
              </p>
              <p className="mt-2 text-3xl font-semibold text-neutral-900">{collectionCount}</p>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
            <MetricIcon tone={automationTone}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </MetricIcon>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                {t('dashboard.automation')}
              </p>
              <p
                className={`mt-2 text-lg font-semibold ${
                  automationTone === 'success' ? 'text-success-600' : 'text-warning-500'
                }`}
              >
                {automationLabel}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
