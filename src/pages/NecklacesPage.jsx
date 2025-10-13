import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PreviewTable } from '../components/PreviewTable';
import { useToast } from '../components/ToastProvider';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function NecklacesPage() {
  const supplements = usePricingStore((state) => state.supplements.necklaces);
  const updateSupplement = usePricingStore((state) => state.updateNecklaceSupplement);
  const previewNecklaces = usePricingStore((state) => state.previewNecklaces);
  const applyNecklaces = usePricingStore((state) => state.applyNecklaces);
  const alignNecklaceVariantsFromMetafields = usePricingStore(
    (state) => state.alignNecklaceVariantsFromMetafields,
  );
  const previewNecklaceAdjustment = usePricingStore(
    (state) => state.previewNecklaceChainAdjustment,
  );
  const applyNecklaceAdjustment = usePricingStore(
    (state) => state.applyNecklaceChainAdjustment,
  );
  const restoreNecklaceAdjustment = usePricingStore(
    (state) => state.restoreNecklaceChainAdjustment,
  );
  const necklaceAdjustmentBackup = usePricingStore(
    (state) => state.chainAdjustmentBackups?.necklaces,
  );
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();
  const toast = useToast();

  const [previews, setPreviews] = useState([]);
  const [adjustmentPreviews, setAdjustmentPreviews] = useState([]);
  const [adjustmentPercent, setAdjustmentPercent] = useState(0);
  const [activeAction, setActiveAction] = useState(null);

  const isBusy = loadingScopes.has('necklaces');
  const canRestoreAdjustment = Boolean(necklaceAdjustmentBackup?.products?.length);

  const handlePreview = () => {
    const results = previewNecklaces();
    setPreviews(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.previewEmpty', { scope: t('nav.necklaces') }));
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!preview?.variants) {
        return count;
      }
      return count + preview.variants.filter((variant) => variant.status === 'missing').length;
    }, 0);

    if (missingCount > 0) {
      toast.error(t('toast.previewMissing', { scope: t('nav.necklaces'), count: missingCount }));
      return;
    }

    toast.success(t('toast.previewReady', { scope: t('nav.necklaces') }));
  };

  const handleAdjustmentPreview = () => {
    const results = previewNecklaceAdjustment(adjustmentPercent);
    setAdjustmentPreviews(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(
        t('toast.previewEmpty', { scope: t('chainAdjustment.scope.necklaces') }),
      );
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!preview?.variants) {
        return count;
      }
      return count + preview.variants.filter((variant) => variant.status === 'missing').length;
    }, 0);

    if (missingCount > 0) {
      toast.error(
        t('toast.previewMissing', {
          scope: t('chainAdjustment.scope.necklaces'),
          count: missingCount,
        }),
      );
      return;
    }

    toast.success(
      t('toast.previewReady', { scope: t('chainAdjustment.scope.necklaces') }),
    );
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
      <Card title={t('necklaces.title')} subtitle={t('necklaces.subtitle')}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(supplements).map(([title, values]) => (
            <div
              key={title}
              className="rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
              <div className="mt-4 space-y-4">
                <Input
                  label="Supplement"
                  type="number"
                  value={values.supplement}
                  onChange={(event) =>
                    updateSupplement(title, 'supplement', Number(event.target.value))
                  }
                  adornment="dh"
                />
                <Input
                  label="Price per cm"
                  type="number"
                  value={values.perCm}
                  onChange={(event) => updateSupplement(title, 'perCm', Number(event.target.value))}
                  adornment="dh"
                />
              </div>
            </div>
          ))}
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
            onClick={() => runAction('metafields', alignNecklaceVariantsFromMetafields)}
          >
            {t('action.alignVariants')}
          </Button>
          <Button
            type="button"
            isLoading={isBusy && activeAction === 'apply'}
            loadingText={t('action.applying')}
            onClick={() => runAction('apply', applyNecklaces)}
          >
            {t('action.apply')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={isBusy && activeAction === 'backup'}
            loadingText={t('action.backingUp')}
            onClick={() => runAction('backup', () => backupScope('necklaces'))}
          >
            {t('action.backup')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            isLoading={isBusy && activeAction === 'restore'}
            loadingText={t('action.restoring')}
            onClick={() => runAction('restore', () => restoreScope('necklaces'))}
          >
            {t('action.restoreBackup')}
          </Button>
        </div>
      </Card>
      <Card
        title={t('necklaces.adjustmentTitle')}
        subtitle={t('necklaces.adjustmentSubtitle')}
      >
        <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
          <Input
            type="number"
            step="0.5"
            label={t('chainAdjustment.percentLabel')}
            helperText={t('chainAdjustment.percentHint')}
            value={adjustmentPercent}
            onChange={(event) => setAdjustmentPercent(Number(event.target.value))}
            adornment="%"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleAdjustmentPreview}
              disabled={isBusy}
            >
              {t('action.preview')}
            </Button>
            <Button
              type="button"
              isLoading={isBusy && activeAction === 'adjust-apply'}
              loadingText={t('chainAdjustment.applying')}
              onClick={() =>
                runAction('adjust-apply', () => applyNecklaceAdjustment(adjustmentPercent))
              }
            >
              {t('chainAdjustment.apply')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy || !canRestoreAdjustment}
              isLoading={isBusy && activeAction === 'adjust-restore'}
              loadingText={t('chainAdjustment.restoring')}
              onClick={() => runAction('adjust-restore', () => restoreNecklaceAdjustment())}
            >
              {t('chainAdjustment.restore')}
            </Button>
          </div>
        </form>
      </Card>
      <Card
        title={t('chainAdjustment.previewTitle')}
        subtitle={t('chainAdjustment.previewSubtitle')}
      >
        <PreviewTable previews={adjustmentPreviews} />
      </Card>
      <Card title={t('necklaces.previewTitle')} subtitle={t('necklaces.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
