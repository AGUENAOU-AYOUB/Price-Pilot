import { Fragment, useMemo, useState } from 'react';

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
  const previewSupplementAdjustment = usePricingStore(
    (state) => state.previewNecklaceSupplementAdjustment,
  );
  const applySupplementAdjustment = usePricingStore(
    (state) => state.applyNecklaceSupplementAdjustment,
  );
  const backupSupplements = usePricingStore((state) => state.backupSupplements);
  const restoreSupplementBackup = usePricingStore((state) => state.restoreSupplementBackup);
  const saveSupplementChanges = usePricingStore((state) => state.saveSupplementChanges);
  const hasSupplementBackup = usePricingStore((state) =>
    state.hasSupplementBackup('necklaces'),
  );
  const hasPendingNecklaceChanges = usePricingStore(
    (state) => state.supplementChangesPending.necklaces,
  );
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();
  const toast = useToast();

  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);
  const [supplementPercent, setSupplementPercent] = useState('');
  const [perCmPercent, setPerCmPercent] = useState('');
  const [supplementPreview, setSupplementPreview] = useState([]);
  const [perCmPreview, setPerCmPreview] = useState([]);
  const [isMergedPreview, setIsMergedPreview] = useState(false);
  const [isSavingSupplements, setIsSavingSupplements] = useState(false);

  const isBusy = loadingScopes.has('necklaces');

  const supplementPercentValue = useMemo(() => {
    const parsed = Number.parseFloat(supplementPercent);
    return Number.isFinite(parsed) ? parsed : null;
  }, [supplementPercent]);

  const perCmPercentValue = useMemo(() => {
    const parsed = Number.parseFloat(perCmPercent);
    return Number.isFinite(parsed) ? parsed : null;
  }, [perCmPercent]);

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

  const hasAnyPreview = supplementPreview.length > 0 || perCmPreview.length > 0;

  const mergedPreview = useMemo(() => {
    if (!hasAnyPreview) {
      return [];
    }

    const byChain = new Map();

    supplementPreview.forEach((item) => {
      if (!item) {
        return;
      }

      byChain.set(item.chainType, {
        chainType: item.chainType,
        supplement: item.supplement,
        perCm: item.perCm,
      });
    });

    perCmPreview.forEach((item) => {
      if (!item) {
        return;
      }

      const existing = byChain.get(item.chainType) ?? {
        chainType: item.chainType,
        supplement: item.supplement,
      };

      byChain.set(item.chainType, {
        chainType: item.chainType,
        supplement: existing.supplement ?? item.supplement,
        perCm: item.perCm ?? existing.perCm,
      });
    });

    return Array.from(byChain.values());
  }, [hasAnyPreview, supplementPreview, perCmPreview]);

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

  const handleSupplementPreview = () => {
    if (supplementPercentValue === null) {
      toast.error(t('supplements.invalidPercent'));
      return;
    }

    const results = previewSupplementAdjustment({
      supplementPercent: supplementPercentValue,
      perCmPercent: 0,
    });
    setSupplementPreview(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.supplementPreviewEmpty', { scope: t('nav.necklaces') }));
      return;
    }

    toast.success(t('toast.necklaceSupplementsPreviewReady'));
  };

  const handleSupplementApply = () => {
    if (supplementPercentValue === null) {
      toast.error(t('supplements.invalidPercent'));
      return;
    }

    applySupplementAdjustment({ supplementPercent: supplementPercentValue, perCmPercent: 0 });
    const preview = previewSupplementAdjustment({
      supplementPercent: supplementPercentValue,
      perCmPercent: 0,
    });
    setSupplementPreview(preview);
    toast.success(
      t('toast.necklaceSupplementsApplied', {
        percent: supplementPercentValue,
      }),
    );
  };

  const handlePerCmPreview = () => {
    if (perCmPercentValue === null) {
      toast.error(t('supplements.invalidPercent'));
      return;
    }

    const results = previewSupplementAdjustment({
      supplementPercent: 0,
      perCmPercent: perCmPercentValue,
    });
    setPerCmPreview(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.supplementPreviewEmpty', { scope: t('nav.necklaces') }));
      return;
    }

    toast.success(t('toast.necklacePerCmPreviewReady'));
  };

  const handlePerCmApply = () => {
    if (perCmPercentValue === null) {
      toast.error(t('supplements.invalidPercent'));
      return;
    }

    applySupplementAdjustment({ supplementPercent: 0, perCmPercent: perCmPercentValue });
    const preview = previewSupplementAdjustment({
      supplementPercent: 0,
      perCmPercent: perCmPercentValue,
    });
    setPerCmPreview(preview);
    toast.success(
      t('toast.necklacePerCmApplied', {
        percent: perCmPercentValue,
      }),
    );
  };

  const handleSupplementSave = async () => {
    setIsSavingSupplements(true);
    try {
      const result = await saveSupplementChanges();

      if (!result?.localSuccess) {
        toast.error(t('toast.supplementSaveLocalFailed', { scope: t('nav.necklaces') }));
        return;
      }

      if (!result.remoteSuccess) {
        toast.error(t('toast.supplementSaveRemoteFailed', { scope: t('nav.necklaces') }));
        return;
      }

      toast.success(t('toast.supplementSaveSuccess', { scope: t('nav.necklaces') }));
    } finally {
      setIsSavingSupplements(false);
    }
  };

  const handleSupplementBackup = () => {
    const success = backupSupplements('necklaces');
    if (success) {
      toast.success(t('toast.supplementBackupSaved', { scope: t('nav.necklaces') }));
    } else {
      toast.error(t('toast.supplementBackupFailed', { scope: t('nav.necklaces') }));
    }
  };

  const handleSupplementRestore = () => {
    const restored = restoreSupplementBackup('necklaces');
    if (!restored) {
      toast.warning(t('toast.supplementBackupMissing', { scope: t('nav.necklaces') }));
      return;
    }

    const preview = previewSupplementAdjustment({
      supplementPercent: supplementPercentValue ?? 0,
      perCmPercent: perCmPercentValue ?? 0,
    });
    setSupplementPreview(preview);
    setPerCmPreview(preview);
    toast.success(t('toast.supplementRestoreSuccess', { scope: t('nav.necklaces') }));
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
          <Button
            type="button"
            onClick={handleSupplementSave}
            disabled={!hasPendingNecklaceChanges || isBusy}
            isLoading={isSavingSupplements}
            loadingText={t('supplements.saving')}
          >
            {t('supplements.saveButton')}
          </Button>
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
            onClick={() =>
              runAction('apply', applyNecklaces, {
                successMessage: t('toast.applySuccess', { scope: t('nav.necklaces') }),
                noChangeMessage: t('toast.applyNoChanges', { scope: t('nav.necklaces') }),
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
      <Card title={t('supplements.adjustmentTitle')} subtitle={t('supplements.adjustmentSubtitleNecklaces')}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-900">
              {t('supplements.sectionSupplementTitle')}
            </h3>
            <div className="mt-4 grid gap-4 sm:flex sm:items-end">
              <div className="sm:w-48">
                <Input
                  label={t('supplements.percentLabel')}
                  type="number"
                  step="0.1"
                  value={supplementPercent}
                  onChange={(event) => setSupplementPercent(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={handleSupplementPreview}>
                  {t('supplements.previewSupplementsButton')}
                </Button>
                <Button type="button" onClick={handleSupplementApply}>
                  {t('supplements.applySupplementsButton')}
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-900">
              {t('supplements.sectionPerCmTitle')}
            </h3>
            <div className="mt-4 grid gap-4 sm:flex sm:items-end">
              <div className="sm:w-48">
                <Input
                  label={t('supplements.percentLabel')}
                  type="number"
                  step="0.1"
                  value={perCmPercent}
                  onChange={(event) => setPerCmPercent(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={handlePerCmPreview}>
                  {t('supplements.previewPerCmButton')}
                </Button>
                <Button type="button" onClick={handlePerCmApply}>
                  {t('supplements.applyPerCmButton')}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
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
        {hasAnyPreview && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsMergedPreview((value) => !value)}
              >
                {isMergedPreview
                  ? t('supplements.separateTables')
                  : t('supplements.mergeTables')}
              </Button>
            </div>
            {isMergedPreview ? (
              mergedPreview.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-neutral-200">
                  <table className="min-w-full divide-y divide-neutral-200 text-sm">
                    <thead className="bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-4 py-3">{t('supplements.chainType')}</th>
                        <th className="px-4 py-3">{t('supplements.fieldLabel')}</th>
                        <th className="px-4 py-3 text-right">{t('supplements.currentValue')}</th>
                        <th className="px-4 py-3 text-right">{t('supplements.previewValue')}</th>
                        <th className="px-4 py-3 text-right">{t('supplements.changeValue')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 bg-white/80">
                      {mergedPreview.map((item) => (
                        <Fragment key={item.chainType}>
                          <tr>
                            <td className="px-4 py-3 font-medium text-neutral-900" rowSpan={2}>
                              {item.chainType}
                            </td>
                            <td className="px-4 py-3 text-neutral-600">{t('supplements.fieldSupplement')}</td>
                            <td className="px-4 py-3 text-right text-neutral-700">
                              {formatCurrency(item.supplement?.current)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-primary-600">
                              {formatCurrency(item.supplement?.next)}
                            </td>
                            <td
                              className={
                                item.supplement?.delta > 0
                                  ? 'px-4 py-3 text-right font-semibold text-emerald-600'
                                  : item.supplement?.delta < 0
                                    ? 'px-4 py-3 text-right font-semibold text-rose-500'
                                    : 'px-4 py-3 text-right font-semibold text-neutral-500'
                              }
                            >
                              {formatDelta(item.supplement?.delta)}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 text-neutral-600">{t('supplements.fieldPerCm')}</td>
                            <td className="px-4 py-3 text-right text-neutral-700">
                              {formatCurrency(item.perCm?.current)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-primary-600">
                              {formatCurrency(item.perCm?.next)}
                            </td>
                            <td
                              className={
                                item.perCm?.delta > 0
                                  ? 'px-4 py-3 text-right font-semibold text-emerald-600'
                                  : item.perCm?.delta < 0
                                    ? 'px-4 py-3 text-right font-semibold text-rose-500'
                                    : 'px-4 py-3 text-right font-semibold text-neutral-500'
                              }
                            >
                              {formatDelta(item.perCm?.delta)}
                            </td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="space-y-6">
                {supplementPreview.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-neutral-200">
                    <div className="bg-neutral-50/70 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      {t('supplements.supplementTableTitle')}
                    </div>
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
                            <td className="px-4 py-3 text-right text-neutral-700">
                              {formatCurrency(item.supplement.current)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-primary-600">
                              {formatCurrency(item.supplement.next)}
                            </td>
                            <td
                              className={
                                item.supplement.delta > 0
                                  ? 'px-4 py-3 text-right font-semibold text-emerald-600'
                                  : item.supplement.delta < 0
                                    ? 'px-4 py-3 text-right font-semibold text-rose-500'
                                    : 'px-4 py-3 text-right font-semibold text-neutral-500'
                              }
                            >
                              {formatDelta(item.supplement.delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {perCmPreview.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-neutral-200">
                    <div className="bg-neutral-50/70 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                      {t('supplements.perCmTableTitle')}
                    </div>
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
                        {perCmPreview.map((item) => (
                          <tr key={item.chainType}>
                            <td className="px-4 py-3 font-medium text-neutral-900">{item.chainType}</td>
                            <td className="px-4 py-3 text-right text-neutral-700">
                              {formatCurrency(item.perCm.current)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-primary-600">
                              {formatCurrency(item.perCm.next)}
                            </td>
                            <td
                              className={
                                item.perCm.delta > 0
                                  ? 'px-4 py-3 text-right font-semibold text-emerald-600'
                                  : item.perCm.delta < 0
                                    ? 'px-4 py-3 text-right font-semibold text-rose-500'
                                    : 'px-4 py-3 text-right font-semibold text-neutral-500'
                              }
                            >
                              {formatDelta(item.perCm.delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
      <Card title={t('necklaces.previewTitle')} subtitle={t('necklaces.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
