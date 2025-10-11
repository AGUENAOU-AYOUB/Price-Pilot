import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PreviewTable } from '../components/PreviewTable';
import { useToast } from '../components/ToastProvider';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { ringSizes } from '../data/supplements';

export function RingsPage() {
  const supplements = usePricingStore((state) => state.supplements.rings);
  const updateSupplement = usePricingStore((state) => state.updateRingSupplement);
  const previewRings = usePricingStore((state) => state.previewRings);
  const applyRings = usePricingStore((state) => state.applyRings);
  const alignRingVariantsFromMetafields = usePricingStore(
    (state) => state.alignRingVariantsFromMetafields,
  );
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();
  const toast = useToast();

  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);

  const isBusy = loadingScopes.has('rings');

  const handlePreview = () => {
    const results = previewRings();
    setPreviews(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.previewEmpty', { scope: t('nav.rings') }));
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!preview?.variants) {
        return count;
      }
      return count + preview.variants.filter((variant) => variant.status === 'missing').length;
    }, 0);

    if (missingCount > 0) {
      toast.error(t('toast.previewMissing', { scope: t('nav.rings'), count: missingCount }));
      return;
    }

    toast.success(t('toast.previewReady', { scope: t('nav.rings') }));
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
      <Card title={t('rings.title')} subtitle={t('rings.subtitle')}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(supplements).map(([band, values]) => (
            <div
              key={band}
              className="rounded-2xl border border-[#d7e0e8] bg-[#e8f2f7]/70 p-6 text-[#1e2835] shadow-[0_24px_60px_-32px_rgba(26,58,74,0.25)]"
            >
              <h3 className="text-lg font-semibold text-[#1e2835]">{band}</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {ringSizes.map((size) => (
                  <Input
                    key={size}
                    label={size}
                    type="number"
                    value={values[size]}
                    onChange={(event) => updateSupplement(band, size, Number(event.target.value))}
                    adornment="dh"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3 text-[#1e2835]">
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={isBusy}>
            {t('action.preview')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            isLoading={isBusy && activeAction === 'metafields'}
            loadingText={t('action.aligningVariants')}
            onClick={() => runAction('metafields', alignRingVariantsFromMetafields)}
          >
            {t('action.alignVariants')}
          </Button>
          <Button
            type="button"
            isLoading={isBusy && activeAction === 'apply'}
            loadingText={t('action.applying')}
            onClick={() => runAction('apply', applyRings)}
          >
            {t('action.apply')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={isBusy && activeAction === 'backup'}
            loadingText={t('action.backingUp')}
            onClick={() => runAction('backup', () => backupScope('rings'))}
          >
            {t('action.backup')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            isLoading={isBusy && activeAction === 'restore'}
            loadingText={t('action.restoring')}
            onClick={() => runAction('restore', () => restoreScope('rings'))}
          >
            {t('action.restoreBackup')}
          </Button>
        </div>
      </Card>
      <Card title={t('rings.previewTitle')} subtitle={t('rings.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
