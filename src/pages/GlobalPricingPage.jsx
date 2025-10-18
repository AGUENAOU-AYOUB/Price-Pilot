import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PreviewTable } from '../components/PreviewTable';
import { useToast } from '../components/ToastProvider';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

const PRICING_SCOPES = [
  {
    scope: 'global',
    navKey: 'nav.globalPricing',
    titleKey: 'global.sections.global.title',
    subtitleKey: 'global.sections.global.subtitle',
  },
  {
    scope: 'bracelets',
    navKey: 'nav.bracelets',
    titleKey: 'global.sections.bracelets.title',
    subtitleKey: 'global.sections.bracelets.subtitle',
  },
  {
    scope: 'necklaces',
    navKey: 'nav.necklaces',
    titleKey: 'global.sections.necklaces.title',
    subtitleKey: 'global.sections.necklaces.subtitle',
  },
  {
    scope: 'rings',
    navKey: 'nav.rings',
    titleKey: 'global.sections.rings.title',
    subtitleKey: 'global.sections.rings.subtitle',
  },
  {
    scope: 'earrings',
    navKey: 'nav.earrings',
    titleKey: 'global.sections.earrings.title',
    subtitleKey: 'global.sections.earrings.subtitle',
  },
];

const buildInitialMap = (value) =>
  PRICING_SCOPES.reduce((accumulator, entry) => {
    accumulator[entry.scope] = value;
    return accumulator;
  }, {});

export function GlobalPricingPage() {
  const previewScopeChange = usePricingStore((state) => state.previewScopeChange);
  const applyScopedChange = usePricingStore((state) => state.applyScopedChange);
  const captureLocalScopeBackup = usePricingStore((state) => state.captureLocalScopeBackup);
  const restoreLocalScopeBackup = usePricingStore((state) => state.restoreLocalScopeBackup);
  const loadingCounts = usePricingStore((state) => state.loadingCounts);
  const { t } = useTranslation();
  const toast = useToast();

  const [percentages, setPercentages] = useState(() => buildInitialMap(0));
  const [previews, setPreviews] = useState(() => buildInitialMap([]));
  const [activeAction, setActiveAction] = useState(null);

  const getScopeLabel = (config) => t(config.navKey);

  const isScopeBusy = (scope) => {
    const rawValue = loadingCounts?.[scope];
    if (typeof rawValue === 'number') {
      return rawValue > 0;
    }
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0;
  };

  const actionKey = (scope, action) => `${scope}:${action}`;

  const isActionLoading = (scope, action) => {
    if (action === 'apply') {
      return isScopeBusy(scope) || activeAction === actionKey(scope, action);
    }
    return activeAction === actionKey(scope, action);
  };

  const runAction = async (scope, action, handler, options = {}) => {
    const key = actionKey(scope, action);
    setActiveAction(key);
    try {
      const result = await handler();

      if (result && result.success) {
        const updatedCount = Number.isFinite(result.updatedCount) ? result.updatedCount : null;
        if (updatedCount === 0 && options.noChangeMessage) {
          toast.info(options.noChangeMessage);
        } else if ((updatedCount === null || updatedCount > 0) && options.successMessage) {
          toast.success(options.successMessage);
        }
      } else if (result && result.success === false && options.errorMessage) {
        toast.error(options.errorMessage);
      }

      return result;
    } finally {
      setActiveAction(null);
    }
  };

  const handlePreview = (config) => {
    const scope = config.scope;
    const scopeLabel = getScopeLabel(config);
    const percentValue = Number(percentages[scope]) || 0;

    const results = previewScopeChange(scope, percentValue);
    setPreviews((previous) => ({ ...previous, [scope]: results }));

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.previewEmpty', { scope: scopeLabel }));
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!Array.isArray(preview?.variants)) {
        return count;
      }
      return (
        count + preview.variants.filter((variant) => variant?.status === 'missing').length
      );
    }, 0);

    if (missingCount > 0) {
      toast.error(t('toast.previewMissing', { scope: scopeLabel, count: missingCount }));
      return;
    }

    toast.success(t('toast.previewReady', { scope: scopeLabel }));
  };

  const handleApply = (config) => {
    const scope = config.scope;
    const scopeLabel = getScopeLabel(config);
    const percentValue = Number(percentages[scope]) || 0;

    return runAction(
      scope,
      'apply',
      async () => {
        const backupResult = captureLocalScopeBackup(scope, { silent: true });
        if (!backupResult?.success) {
          const failureKey =
            backupResult?.reason === 'empty'
              ? 'toast.localBackupEmpty'
              : 'toast.localBackupFailed';
          toast.error(t(failureKey, { scope: scopeLabel }));
          return { success: false };
        }

        toast.success(t('toast.localBackupCreated', { scope: scopeLabel }));
        return await applyScopedChange(scope, percentValue, { skipLocalBackup: true });
      },
      {
        successMessage: t('toast.applySuccess', { scope: scopeLabel }),
        noChangeMessage: t('toast.applyNoChanges', { scope: scopeLabel }),
      },
    );
  };

  const handleBackup = (config) => {
    const scope = config.scope;
    const scopeLabel = getScopeLabel(config);

    return runAction(scope, 'backup', async () => {
      const result = captureLocalScopeBackup(scope);
      if (!result?.success) {
        const failureKey =
          result?.reason === 'empty' ? 'toast.localBackupEmpty' : 'toast.localBackupFailed';
        toast.error(t(failureKey, { scope: scopeLabel }));
        return result;
      }

      toast.success(t('toast.localBackupCreated', { scope: scopeLabel }));
      return result;
    });
  };

  const handleRestore = (config) => {
    const scope = config.scope;
    const scopeLabel = getScopeLabel(config);

    return runAction(
      scope,
      'restore',
      async () => {
        const result = restoreLocalScopeBackup(scope);
        if (!result?.success) {
          const failureKey =
            result?.reason === 'missing-backup'
              ? 'toast.localBackupMissing'
              : 'toast.localBackupFailed';
          toast.error(t(failureKey, { scope: scopeLabel }));
          return result;
        }

        toast.success(t('toast.localBackupRestored', { scope: scopeLabel }));
        setPreviews((previous) => ({ ...previous, [scope]: [] }));
        return result;
      },
    );
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2 text-brand-charcoal">
        <h1 className="text-3xl font-semibold tracking-tight">{t('global.title')}</h1>
        <p className="text-neutral-500">{t('global.subtitle')}</p>
      </div>

      {PRICING_SCOPES.map((config) => {
        const scope = config.scope;
        const percentValue = Number(percentages[scope]) || 0;
        const scopePreviews = previews[scope] ?? [];
        const scopeBusy = isScopeBusy(scope);

        return (
          <Card
            key={scope}
            title={t(config.titleKey)}
            subtitle={t(config.subtitleKey)}
            className="space-y-6"
          >
            <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
              <Input
                type="number"
                step="0.5"
                label={t('global.percentLabel')}
                helperText={t('global.percentHint')}
                value={percentValue}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setPercentages((previous) => ({
                    ...previous,
                    [scope]: Number.isFinite(nextValue) ? nextValue : 0,
                  }));
                }}
                adornment="%"
              />
              <p className="text-sm text-neutral-500">{t('global.roundingHint')}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handlePreview(config)}
                  disabled={scopeBusy}
                >
                  {t('action.preview')}
                </Button>
                <Button
                  type="button"
                  isLoading={isActionLoading(scope, 'apply')}
                  loadingText={t('action.applying')}
                  onClick={() => handleApply(config)}
                >
                  {t('action.apply')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={isActionLoading(scope, 'backup')}
                  loadingText={t('action.backingUp')}
                  onClick={() => handleBackup(config)}
                  disabled={scopeBusy}
                >
                  {t('action.backup')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  isLoading={isActionLoading(scope, 'restore')}
                  loadingText={t('action.restoring')}
                  onClick={() => handleRestore(config)}
                  disabled={scopeBusy}
                >
                  {t('action.restoreBackup')}
                </Button>
              </div>
            </form>

            <div className="mt-8">
              <div className="max-h-[32rem] overflow-y-auto pr-1">
                <PreviewTable previews={scopePreviews} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
