import { Card } from '../components/Card';
import { LogPanel } from '../components/LogPanel';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { hasShopifyProxy } from '../config/shopify';

export function DashboardPage() {
  const products = usePricingStore((state) => state.products);
  const { t } = useTranslation();
  const credentialsReady = hasShopifyProxy();

  const activeCount = products.filter((product) => product.status === 'active').length;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <Card title={t('dashboard.welcomeTitle')} subtitle={t('dashboard.welcomeSubtitle')}>
          <p>
            Use the navigation to access dedicated playbooks for bracelets, necklaces, rings, hand
            chains, and sets. Each section keeps compare-at prices aligned and protects your data
            with instant backups and clear logs.
          </p>
        </Card>
        <Card title={t('dashboard.catalogTitle')}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 ring-1 ring-platinum">
              <dt className="text-xs uppercase tracking-wide text-slategray">
                {t('dashboard.activeProducts')}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-charcoal">{activeCount}</dd>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-platinum">
              <dt className="text-xs uppercase tracking-wide text-slategray">
                {t('dashboard.collections')}
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-charcoal">5</dd>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-platinum">
              <dt className="text-xs uppercase tracking-wide text-slategray">
                {t('dashboard.automation')}
              </dt>
              <dd className="mt-1 text-sm font-medium text-rosegold">
                {credentialsReady
                  ? t('dashboard.automationStatus')
                  : t('dashboard.automationMissing')}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
      <LogPanel />
    </div>
  );
}
