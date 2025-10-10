import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PreviewTable } from '../components/PreviewTable';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';
import { ringSizes } from '../data/supplements';

export function RingsPage() {
  const supplements = usePricingStore((state) => state.supplements.rings);
  const updateSupplement = usePricingStore((state) => state.updateRingSupplement);
  const previewRings = usePricingStore((state) => state.previewRings);
  const applyRings = usePricingStore((state) => state.applyRings);
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();

  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);

  const isBusy = loadingScopes.has('rings');

  const handlePreview = () => {
    setPreviews(previewRings());
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
              className="rounded-2xl border border-neutral-200 bg-white/80 p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-neutral-900">{band}</h3>
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
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={isBusy}>
            {t('action.preview')}
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
