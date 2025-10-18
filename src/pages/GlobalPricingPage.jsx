import { useMemo, useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PreviewTable } from '../components/PreviewTable';
import { useToast } from '../components/ToastProvider';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

const DEFAULT_ROUNDING = 'luxury';

const SECTION_DEFINITIONS = [
  {
    key: 'global-bracelets',
    labelKey: 'global.section.bracelets.title',
    subtitleKey: 'global.section.bracelets.subtitle',
    collections: ['bracelet'],
  },
  {
    key: 'global-necklaces',
    labelKey: 'global.section.necklaces.title',
    subtitleKey: 'global.section.necklaces.subtitle',
    collections: ['collier'],
  },
  {
    key: 'global-rings',
    labelKey: 'global.section.rings.title',
    subtitleKey: 'global.section.rings.subtitle',
    collections: ['bague'],
  },
  {
    key: 'global-earrings',
    labelKey: 'global.section.earrings.title',
    subtitleKey: 'global.section.earrings.subtitle',
    collections: ['earring'],
  },
];

export function GlobalPricingPage() {
  const DEFAULT_ROUNDING = 'luxury';
  const SECTION_DEFINITIONS = useMemo(
    () => [
      {
        key: 'global-bracelets',
        labelKey: 'global.section.bracelets.title',
        subtitleKey: 'global.section.bracelets.subtitle',
        collections: ['bracelet'],
      },
      {
        key: 'global-necklaces',
        labelKey: 'global.section.necklaces.title',
        subtitleKey: 'global.section.necklaces.subtitle',
        collections: ['collier'],
      },
      {
        key: 'global-rings',
        labelKey: 'global.section.rings.title',
        subtitleKey: 'global.section.rings.subtitle',
        collections: ['bague'],
      },
      {
        key: 'global-earrings',
        labelKey: 'global.section.earrings.title',
        subtitleKey: 'global.section.earrings.subtitle',
        collections: ['earring'],
      },
    ],
    [],
  );

  const previewCollectionChange = usePricingStore((state) => state.previewCollectionChange);
  const applyCollectionChange = usePricingStore((state) => state.applyCollectionChange);
  const backupCollectionLocally = usePricingStore((state) => state.backupCollectionLocally);
  const restoreCollectionLocally = usePricingStore((state) => state.restoreCollectionLocally);
  const sectionBackups = usePricingStore((state) => state.sectionBackups);
  const loadingCounts = usePricingStore((state) => state.loadingCounts);
  const { t } = useTranslation();
  const toast = useToast();

  const roundingOptions = useMemo(
    () => [
      { value: 'luxury', label: t('global.rounding.luxury') },
      { value: 'nearest-ten', label: t('global.rounding.nearestTen') },
      { value: 'ceil-ten', label: t('global.rounding.ceilTen') },
      { value: 'floor-ten', label: t('global.rounding.floorTen') },
      { value: 'none', label: t('global.rounding.none') },
    ],
    [t],
  );

  const [sectionState, setSectionState] = useState(() =>
    Object.fromEntries(
      SECTION_DEFINITIONS.map((section) => [
        section.key,
        { percent: 0, rounding: DEFAULT_ROUNDING, previews: [] },
      ]),
    ),
  );
  const [activeActions, setActiveActions] = useState({});

  const getSectionSnapshot = (key) =>
    sectionState[key] ?? { percent: 0, rounding: DEFAULT_ROUNDING, previews: [] };

  const updateSectionState = (key, updater) => {
    setSectionState((previous) => {
      const current = previous[key] ?? {
        percent: 0,
        rounding: DEFAULT_ROUNDING,
        previews: [],
      };
      const update = typeof updater === 'function' ? updater(current) : updater;
      return {
        ...previous,
        [key]: { ...current, ...update },
      };
    });
  };

  const runAction = async (scope, action, handler, options = {}) => {
    setActiveActions((previous) => ({ ...previous, [scope]: action }));
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
      setActiveActions((previous) => {
        const next = { ...previous };
        delete next[scope];
        return next;
      });
    }
  };

  const handlePreview = (section) => {
    const snapshot = getSectionSnapshot(section.key);
    const results = previewCollectionChange(section.key, section.collections, snapshot.percent, {
      rounding: snapshot.rounding,
    });

    updateSectionState(section.key, { previews: results });

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('global.sectionPreviewEmpty', { section: t(section.labelKey) }));
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!preview?.variants) {
        return count;
      }

      return count + preview.variants.filter((variant) => variant.status === 'missing').length;
    }, 0);

    if (missingCount > 0) {
      toast.error(t('global.sectionPreviewMissing', { section: t(section.labelKey), count: missingCount }));
      return;
    }

    toast.success(t('global.sectionPreviewReady', { section: t(section.labelKey) }));
  };

  const handleApply = (section) => {
    const snapshot = getSectionSnapshot(section.key);
    const sectionName = t(section.labelKey);
    const successMessage = t('global.toast.applySuccess', { section: sectionName });
    const noChangeMessage = t('global.toast.applyNoChanges', { section: sectionName });
    const failureMessage = t('global.toast.applyFailure', { section: sectionName });
    const loadingMessage = t('global.loading', { section: sectionName });
    const updateLabel = t('global.updateLabel', { section: sectionName });

    return runAction(
      section.key,
      'apply',
      () =>
        applyCollectionChange(section.key, section.collections, snapshot.percent, {
          rounding: snapshot.rounding,
          label: sectionName,
          loadingMessage,
          successLogMessage: successMessage,
          failureLogMessage: failureMessage,
          noChangeMessage,
          updateLabel,
        }),
      {
        successMessage,
        noChangeMessage,
      },
    );
  };

  const handleBackup = (section) => {
    const snapshot = getSectionSnapshot(section.key);
    const sectionName = t(section.labelKey);

    return runAction(section.key, 'backup', async () => {
      backupCollectionLocally(section.key, section.collections, {
        label: sectionName,
        percent: snapshot.percent,
        rounding: snapshot.rounding,
        silent: true,
      });
      toast.success(t('global.toast.backupSaved', { section: sectionName }));
      return { success: true, updatedCount: 1 };
    });
  };

  const handleRestore = (section) => {
    const sectionName = t(section.labelKey);

    return runAction(section.key, 'restore', async () => {
      const result = restoreCollectionLocally(section.key, { label: sectionName, silent: true });
      if (result?.success) {
        toast.success(t('global.toast.restoreSuccess', { section: sectionName }));
        return { success: true, updatedCount: result.restoredCount ?? 1 };
      }

      toast.error(t('global.toast.restoreMissing', { section: sectionName }));
      return { success: false, updatedCount: 0 };
    });
  };

  const formatBackupTimestamp = (timestamp) => {
    if (!timestamp) {
      return t('global.backup.none');
    }

    try {
      return new Date(timestamp).toLocaleString();
    } catch (error) {
      return t('global.backup.none');
    }
  };

  return (
    <div className="space-y-10">
      {SECTION_DEFINITIONS.map((section) => {
        const snapshot = getSectionSnapshot(section.key);
        const isBusy = Boolean(loadingCounts?.[section.key]);
        const activeAction = activeActions[section.key];
        const backupMetadata = sectionBackups?.[section.key];

        return (
          <div key={section.key} className="space-y-6">
            <Card title={t(section.labelKey)} subtitle={t(section.subtitleKey)}>
              <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-6 lg:grid-cols-3">
                  <Input
                    type="number"
                    step="0.5"
                    label={t('global.percentLabel')}
                    helperText={t('global.percentHint')}
                    value={snapshot.percent}
                    onChange={(event) =>
                      updateSectionState(section.key, {
                        percent: Number(event.target.value),
                      })
                    }
                    adornment="%"
                  />
                  <div className="lg:col-span-1">
                    <label className="block text-sm font-semibold text-neutral-700">
                      {t('global.rounding.label')}
                    </label>
                    <div className="mt-2">
                      <div className="relative">
                        <select
                          value={snapshot.rounding}
                          onChange={(event) =>
                            updateSectionState(section.key, { rounding: event.target.value })
                          }
                          className="h-12 w-full appearance-none rounded-2xl border border-neutral-200/80 bg-white/85 px-4 text-sm font-medium text-brand-charcoal shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/20"
                        >
                          {roundingOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">
                          ▼
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-neutral-500">{t('global.rounding.helper')}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200/80 bg-white/70 p-4 text-sm text-neutral-600">
                    <p className="font-semibold text-neutral-700">{t('global.backup.label')}</p>
                    <p className="mt-1 text-sm font-medium text-neutral-800">
                      {formatBackupTimestamp(backupMetadata?.timestamp)}
                    </p>
                    {backupMetadata &&
                      backupMetadata.percent !== null &&
                      backupMetadata.percent !== undefined && (
                      <p className="mt-2 text-xs">
                        {t('global.backup.summary', {
                          percent: backupMetadata.percent,
                          rounding: backupMetadata.rounding
                            ? t(`global.rounding.summary.${backupMetadata.rounding}`)
                            : t('global.rounding.summary.unknown'),
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handlePreview(section)}
                    disabled={isBusy}
                  >
                    {t('action.preview')}
                  </Button>
                  <Button
                    type="button"
                    isLoading={isBusy && activeAction === 'apply'}
                    loadingText={t('action.applying')}
                    onClick={() => handleApply(section)}
                  >
                    {t('action.apply')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={isBusy && activeAction === 'backup'}
                    loadingText={t('action.backingUp')}
                    onClick={() => handleBackup(section)}
                  >
                    {t('action.backup')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    isLoading={isBusy && activeAction === 'restore'}
                    loadingText={t('action.restoring')}
                    onClick={() => handleRestore(section)}
                  >
                    {t('action.restoreBackup')}
                  </Button>
                </div>
              </form>
            </Card>
            <Card title={t('global.previewTitle')} subtitle={t('global.previewSubtitle')}>
              <PreviewTable previews={snapshot.previews} />
            </Card>
          </div>
        );
      })}
    </div>
  );
}
