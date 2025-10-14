import { useMemo, useState } from 'react';

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
  const previewSupplementAdjustment = usePricingStore(
    (state) => state.previewBraceletSupplementAdjustment,
  );
  const applySupplementAdjustment = usePricingStore(
    (state) => state.applyBraceletSupplementAdjustment,
  );
  const backupSupplements = usePricingStore((state) => state.backupSupplements);
  const restoreSupplementBackup = usePricingStore((state) => state.restoreSupplementBackup);
  const hasSupplementBackup = usePricingStore((state) =>
    state.hasSupplementBackup('bracelets'),
  );
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();
  const toast = useToast();

  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);
  const [adjustmentPercent, setAdjustmentPercent] = useState('');
  const [supplementPreview, setSupplementPreview] = useState([]);

  const isBusy = loadingScopes.has('bracelets');

  const percentValue = useMemo(() => {
    const parsed = Number.parseFloat(adjustmentPercent);
    return Number.isFinite(parsed) ? parsed : null;
  }, [adjustmentPercent]);

  const formatCurrency = (value) => {
    if (!Number.isFinite(value)) {
      return '—';
    }
    return `${Math.round(value).toLocaleString()} dh`;
  };

  const formatDelta = (value) => {
    if (!Number.isFinite(value) || value === 0) {
      return t('supplements.deltaNone');
    }
    const prefix = value > 0 ? '+' : '−';
    return `${prefix}${Math.abs(Math.round(value)).toLocaleString()} dh`;
  };

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

  const handleSupplementPreview = () => {
    if (percentValue === null) {
      toast.error(t('supplements.invalidPercent'));
      return;
    }

    const results = previewSupplementAdjustment(percentValue);
    setSupplementPreview(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.supplementPreviewEmpty', { scope: t('nav.bracelets') }));
      return;
    }

    toast.success(t('toast.supplementPreviewReady', { scope: t('nav.bracelets') }));
  };

  const handleSupplementApply = () => {
    if (percentValue === null) {
      toast.error(t('supplements.invalidPercent'));
      return;
    }

    applySupplementAdjustment(percentValue);
    const preview = previewSupplementAdjustment(percentValue);
    setSupplementPreview(preview);
    toast.success(
      t('toast.supplementApplied', {
        scope: t('nav.bracelets'),
        percent: percentValue,
      }),
    );
  };

  const handleSupplementBackup = () => {
    const success = backupSupplements('bracelets');
    if (success) {
      toast.success(t('toast.supplementBackupSaved', { scope: t('nav.bracelets') }));
    } else {
      toast.error(t('toast.supplementBackupFailed', { scope: t('nav.bracelets') }));
    }
  };

  const handleSupplementRestore = () => {
    const restored = restoreSupplementBackup('bracelets');
    if (!restored) {
      toast.warning(t('toast.supplementBackupMissing', { scope: t('nav.bracelets') }));
      return;
    }

    const preview = percentValue === null
      ? previewSupplementAdjustment(0)
      : previewSupplementAdjustment(percentValue);
    setSupplementPreview(preview);
    toast.success(t('toast.supplementRestoreSuccess', { scope: t('nav.bracelets') }));
  };

  const runAction = async (action, handler, options = {}) => {
    setActiveAction(action);
    try {
      const result = await handler();

      if (result && result.success) {
        const updatedCount = Number.isFinite(result.updatedCount) ? result.updatedCount : null;
        if (updatedCount === 0 && options.noChangeMessage) {
          toast.info(options.noChangeMessage);
        } else if ((updatedCount === null || updatedCount > 0) && options.successMessage) {
          toast.success(options.successMessage);
        }
      }

      return result;
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
            onClick={() =>
              runAction('apply', applyBracelets, {
                successMessage: t('toast.applySuccess', { scope: t('nav.bracelets') }),
                noChangeMessage: t('toast.applyNoChanges', { scope: t('nav.bracelets') }),
              })
            }
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
      <Card title={t('supplements.adjustmentTitle')} subtitle={t('supplements.adjustmentSubtitleBracelets')}>
        <div className="grid gap-4 sm:flex sm:items-end">
          <div className="sm:w-48">
            <Input
              label={t('supplements.percentLabel')}
              type="number"
              step="0.1"
              value={adjustmentPercent}
              onChange={(event) => setAdjustmentPercent(event.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={handleSupplementPreview}>
              {t('supplements.previewButton')}
            </Button>
            <Button type="button" onClick={handleSupplementApply}>
              {t('supplements.applyButton')}
            </Button>
            <Button type="button" variant="secondary" onClick={handleSupplementBackup}>
              {t('supplements.backupButton')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleSupplementRestore}
              disabled={!hasSupplementBackup}
            >
              {t('supplements.restoreButton')}
            </Button>
          </div>
        </div>
        {supplementPreview.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">{t('supplements.chainType')}</th>
                  <th className="px-4 py-3 text-right">{t('supplements.currentValue')}</th>
                  <th className="px-4 py-3 text-right">{t('supplements.previewValue')}</th>
                  <th className="px-4 py-3 text-right">{t('supplements.changeValue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white/80">
                {supplementPreview.map((item) => (
                  <tr key={item.chainType}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{item.chainType}</td>
                    <td className="px-4 py-3 text-right text-neutral-700">{formatCurrency(item.current)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary-600">
                      {formatCurrency(item.next)}
                    </td>
                    <td
                      className={
                        item.delta > 0
                          ? 'px-4 py-3 text-right font-semibold text-emerald-600'
                          : item.delta < 0
                            ? 'px-4 py-3 text-right font-semibold text-rose-500'
                            : 'px-4 py-3 text-right font-semibold text-neutral-500'
                      }
                    >
                      {formatDelta(item.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title={t('bracelets.previewTitle')} subtitle={t('bracelets.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
