import { useMemo, useState } from 'react';

import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useToast } from '../components/ToastProvider';
import { usePricingStore } from '../store/pricingStore';
import { hasShopifyProxy } from '../config/shopify';
import { useTranslation } from '../i18n/useTranslation';

const AZOR_ARCHIVE_SCOPE = 'azor-archive';
const AZOR_ARCHIVE_FILE = 'azor-backup/pct-backup-2025-10-08T16-48-56-745Z.json';

export function AzorArchivePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const refreshBackupsFromProxy = usePricingStore((state) => state.refreshBackupsFromProxy);
  const archiveBackup = usePricingStore((state) => state.backups?.[AZOR_ARCHIVE_SCOPE]);
  const isScopeLoading = usePricingStore((state) =>
    typeof state.isScopeLoading === 'function' ? state.isScopeLoading(AZOR_ARCHIVE_SCOPE) : false,
  );
  const proxyAvailable = hasShopifyProxy();
  const [activeAction, setActiveAction] = useState(null);

  const metadata = useMemo(() => {
    const productCount = Array.isArray(archiveBackup?.products)
      ? archiveBackup.products.length
      : 0;
    const formattedCount = productCount > 0 ? productCount.toLocaleString() : null;

    const timestamp = archiveBackup?.timestamp;
    let formattedTimestamp = null;
    if (typeof timestamp === 'string' && timestamp.trim()) {
      const parsed = new Date(timestamp);
      formattedTimestamp = Number.isNaN(parsed.getTime())
        ? null
        : parsed.toLocaleString();
    }

    return {
      productCount,
      formattedCount,
      formattedTimestamp,
    };
  }, [archiveBackup]);

  const runAction = async (action, handler, { successMessage, errorMessage, pendingMessage } = {}) => {
    setActiveAction(action);
    try {
      if (pendingMessage) {
        toast.info(pendingMessage);
      }

      await handler();

      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (error) {
      console.error('Azor archive action failed', error);
      if (errorMessage) {
        toast.error(errorMessage);
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleRefresh = () =>
    runAction(
      'refresh',
      () => refreshBackupsFromProxy(),
      {
        successMessage: t('azorArchive.refreshSuccess'),
        errorMessage: t('azorArchive.refreshError'),
      },
    );

  const handleRestore = () =>
    runAction('restore', () => restoreScope(AZOR_ARCHIVE_SCOPE), {
      pendingMessage: t('azorArchive.restoreStarted'),
    });

  const renderMetadataValue = (value, fallbackKey) =>
    value ?? t(fallbackKey);

  return (
    <div className="space-y-8">
      <Card
        title={t('azorArchive.title')}
        subtitle={t('azorArchive.subtitle')}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleRefresh}
              isLoading={activeAction === 'refresh'}
              loadingText={t('azorArchive.refreshing')}
            >
              {t('azorArchive.refresh')}
            </Button>
            <Button
              type="button"
              onClick={handleRestore}
              isLoading={isScopeLoading || activeAction === 'restore'}
              loadingText={t('action.restoring')}
              disabled={!proxyAvailable}
            >
              {t('action.restoreBackup')}
            </Button>
          </div>
        }
      >
        <p>{t('azorArchive.description')}</p>
        <ul className="list-disc space-y-2 rounded-2xl border border-neutral-200/70 bg-white/70 p-5 text-neutral-600">
          <li>{t('azorArchive.step1')}</li>
          <li>{t('azorArchive.step2')}</li>
          <li>{t('azorArchive.step3')}</li>
        </ul>
        {!proxyAvailable && (
          <div className="rounded-2xl border border-warning-200/70 bg-warning-50/80 p-4 text-warning-700">
            {t('azorArchive.proxyWarning')}
          </div>
        )}
        <div className="rounded-2xl border border-neutral-200/80 bg-white/75 p-6">
          <dl className="grid gap-6 sm:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
                {t('azorArchive.fileLabel')}
              </dt>
              <dd className="text-base font-semibold text-brand-charcoal break-all">{AZOR_ARCHIVE_FILE}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
                {t('azorArchive.timestampLabel')}
              </dt>
              <dd className="text-base font-semibold text-brand-charcoal">
                {renderMetadataValue(metadata.formattedTimestamp, 'azorArchive.timestampMissing')}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">
                {t('azorArchive.productsLabel')}
              </dt>
              <dd className="text-base font-semibold text-brand-charcoal">
                {metadata.formattedCount
                  ? t('azorArchive.productsValue', { count: metadata.formattedCount })
                  : t('azorArchive.productsMissing')}
              </dd>
            </div>
          </dl>
        </div>
        <p className="text-sm text-neutral-500">{t('azorArchive.restoreHint')}</p>
      </Card>
    </div>
  );
}
