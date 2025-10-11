import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PreviewTable } from '../components/PreviewTable';
import { useToast } from '../components/ToastProvider';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function SetsPage() {
  const previewSets = usePricingStore((state) => state.previewSets);
  const applySets = usePricingStore((state) => state.applySets);
  const alignSetVariantsFromMetafields = usePricingStore(
    (state) => state.alignSetVariantsFromMetafields,
  );
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const supplements = usePricingStore((state) => state.supplements);
  const { t } = useTranslation();
  const toast = useToast();

  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);

  const isBusy = loadingScopes.has('sets');

  const handlePreview = () => {
    const results = previewSets();
    setPreviews(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.previewEmpty', { scope: t('nav.sets') }));
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!preview?.variants) {
        return count;
      }
      return count + preview.variants.filter((variant) => variant.status === 'missing').length;
    }, 0);

    if (missingCount > 0) {
      toast.error(t('toast.previewMissing', { scope: t('nav.sets'), count: missingCount }));
      return;
    }

    toast.success(t('toast.previewReady', { scope: t('nav.sets') }));
  };

  const runAction = async (action, handler) => {
    setActiveAction(action);
    try {
      await handler();
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="space-y-8">
      <Card title={t('sets.title')} subtitle={t('sets.subtitle')}>
        <p className="text-base text-neutral-500">{t('sets.helper')}</p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-neutral-600">
                  Chain type
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-neutral-600">
                  Bracelet supplement
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-neutral-600">
                  Necklace supplement
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold uppercase tracking-wide text-neutral-600">
                  Combined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white text-base text-neutral-700">
              {Object.entries(supplements.necklaces).map(([title, data], index) => {
                const bracelet = supplements.bracelets[title] ?? 0;
                const combined = bracelet + data.supplement;
                const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
                return (
                  <tr key={title} className={rowClass}>
                    <td className="px-6 py-4 font-semibold text-neutral-900">{title}</td>
                    <td className="px-6 py-4 text-neutral-600">{bracelet.toFixed(2)} dh</td>
                    <td className="px-6 py-4 text-neutral-600">{data.supplement.toFixed(2)} dh</td>
                    <td className="px-6 py-4 font-semibold text-primary-600">{combined.toFixed(2)} dh</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={isBusy}>
            {t('action.preview')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            isLoading={isBusy && activeAction === 'metafields'}
            loadingText={t('action.aligningVariants')}
            onClick={() => runAction('metafields', alignSetVariantsFromMetafields)}
          >
            {t('action.alignVariants')}
          </Button>
          <Button
            type="button"
            isLoading={isBusy && activeAction === 'apply'}
            loadingText={t('action.applying')}
            onClick={() => runAction('apply', applySets)}
          >
            {t('action.apply')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={isBusy && activeAction === 'backup'}
            loadingText={t('action.backingUp')}
            onClick={() => runAction('backup', () => backupScope('sets'))}
          >
            {t('action.backup')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            isLoading={isBusy && activeAction === 'restore'}
            loadingText={t('action.restoring')}
            onClick={() => runAction('restore', () => restoreScope('sets'))}
          >
            {t('action.restoreBackup')}
          </Button>
        </div>
      </Card>
      <Card title={t('sets.previewTitle')} subtitle={t('sets.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
