import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PreviewTable } from '../components/PreviewTable';
import { useToast } from '../components/ToastProvider';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function GlobalPricingPage() {
  const [percent, setPercent] = useState(0);
  const previewGlobalChange = usePricingStore((state) => state.previewGlobalChange);
  const applyGlobalChange = usePricingStore((state) => state.applyGlobalChange);
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();
  const toast = useToast();
  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);

  const isBusy = loadingScopes.has('global');

  const handlePreview = () => {
    const results = previewGlobalChange(percent);
    setPreviews(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.previewEmpty', { scope: t('nav.globalPricing') }));
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!preview?.variants) {
        return count;
      }
      return count + preview.variants.filter((variant) => variant.status === 'missing').length;
    }, 0);

    if (missingCount > 0) {
      toast.error(t('toast.previewMissing', { scope: t('nav.globalPricing'), count: missingCount }));
      return;
    }

    toast.success(t('toast.previewReady', { scope: t('nav.globalPricing') }));
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
      <Card title={t('global.title')} subtitle={t('global.subtitle')}>
        <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
          <Input
            type="number"
            step="0.5"
            label={t('global.percentLabel')}
            helperText={t('global.percentHint')}
            value={percent}
            onChange={(event) => setPercent(Number(event.target.value))}
            adornment="%"
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={handlePreview} disabled={isBusy}>
              {t('action.preview')}
            </Button>
            <Button
              type="button"
              isLoading={isBusy && activeAction === 'apply'}
              loadingText={t('action.applying')}
              onClick={() => runAction('apply', () => applyGlobalChange(percent))}
            >
              {t('action.apply')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              isLoading={isBusy && activeAction === 'backup'}
              loadingText={t('action.backingUp')}
              onClick={() => runAction('backup', () => backupScope('global'))}
            >
              {t('action.backup')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              isLoading={isBusy && activeAction === 'restore'}
              loadingText={t('action.restoring')}
              onClick={() => runAction('restore', () => restoreScope('global'))}
            >
              {t('action.restoreBackup')}
            </Button>
          </div>
        </form>
      </Card>
      <Card title={t('global.previewTitle')} subtitle={t('global.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
