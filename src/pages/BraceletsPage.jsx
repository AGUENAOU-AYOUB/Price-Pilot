import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PreviewTable } from '../components/PreviewTable';
import { useToast } from '../components/ToastProvider';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function BraceletsPage() {
  const supplements = usePricingStore((state) => state.supplements.bracelets);
  const updateSupplement = usePricingStore((state) => state.updateBraceletSupplement);
  const previewBracelets = usePricingStore((state) => state.previewBracelets);
  const applyBracelets = usePricingStore((state) => state.applyBracelets);
  const alignBraceletVariantsFromMetafields = usePricingStore(
    (state) => state.alignBraceletVariantsFromMetafields,
  );
  const previewBraceletAdjustment = usePricingStore(
    (state) => state.previewBraceletChainAdjustment,
  );
  const applyBraceletAdjustment = usePricingStore(
    (state) => state.applyBraceletChainAdjustment,
  );
  const restoreBraceletAdjustment = usePricingStore(
    (state) => state.restoreBraceletChainAdjustment,
  );
  const braceletAdjustmentBackup = usePricingStore(
    (state) => state.chainAdjustmentBackups?.bracelets,
  );
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();
  const toast = useToast();

  const [previews, setPreviews] = useState([]);
  const [adjustmentPreviews, setAdjustmentPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);
  const [adjustmentPercent, setAdjustmentPercent] = useState(0);

  const isBusy = loadingScopes.has('bracelets');
  const canRestoreAdjustment = Boolean(braceletAdjustmentBackup?.products?.length);

  const handlePreview = () => {
    const results = previewBracelets();
    setPreviews(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.previewEmpty', { scope: t('nav.bracelets') }));
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!preview?.variants) {
        return count;
      }
      return count + preview.variants.filter((variant) => variant.status === 'missing').length;
    }, 0);

    if (missingCount > 0) {
      toast.error(t('toast.previewMissing', { scope: t('nav.bracelets'), count: missingCount }));
      return;
    }

    toast.success(t('toast.previewReady', { scope: t('nav.bracelets') }));
  };

  const handleAdjustmentPreview = () => {
    const results = previewBraceletAdjustment(adjustmentPercent);
    setAdjustmentPreviews(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(
        t('toast.previewEmpty', { scope: t('chainAdjustment.scope.bracelets') }),
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
          scope: t('chainAdjustment.scope.bracelets'),
          count: missingCount,
        }),
      );
      return;
    }

    toast.success(
      t('toast.previewReady', { scope: t('chainAdjustment.scope.bracelets') }),
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
      <Card title={t('bracelets.title')} subtitle={t('bracelets.subtitle')}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(supplements).map(([title, value]) => (
            <Input
              key={title}
              label={title}
              type="number"
              value={value}
              onChange={(event) => updateSupplement(title, Number(event.target.value))}
              adornment="dh"
            />
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
            onClick={() => runAction('metafields', alignBraceletVariantsFromMetafields)}
          >
            {t('action.alignVariants')}
          </Button>
          <Button
            type="button"
            isLoading={isBusy && activeAction === 'apply'}
            loadingText={t('action.applying')}
            onClick={() => runAction('apply', applyBracelets)}
          >
            {t('action.apply')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={isBusy && activeAction === 'backup'}
            loadingText={t('action.backingUp')}
            onClick={() => runAction('backup', () => backupScope('bracelets'))}
          >
            {t('action.backup')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            isLoading={isBusy && activeAction === 'restore'}
            loadingText={t('action.restoring')}
            onClick={() => runAction('restore', () => restoreScope('bracelets'))}
          >
            {t('action.restoreBackup')}
          </Button>
        </div>
      </Card>
      <Card
        title={t('bracelets.adjustmentTitle')}
        subtitle={t('bracelets.adjustmentSubtitle')}
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
                runAction('adjust-apply', () => applyBraceletAdjustment(adjustmentPercent))
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
              onClick={() => runAction('adjust-restore', () => restoreBraceletAdjustment())}
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
      <Card title={t('bracelets.previewTitle')} subtitle={t('bracelets.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
