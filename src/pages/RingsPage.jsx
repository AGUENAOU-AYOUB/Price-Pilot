import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Loader } from '../components/Loader';
import { LogPanel } from '../components/LogPanel';
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
  const toggleLoading = usePricingStore((state) => state.toggleLoading);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();

  const [previews, setPreviews] = useState([]);

  const handlePreview = () => {
    setPreviews(previewRings());
  };

  const handleApply = () => {
    toggleLoading('rings', true);
    setTimeout(() => {
      applyRings();
      toggleLoading('rings', false);
    }, 450);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title={t('rings.title')} subtitle={t('rings.subtitle')}>
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(supplements).map(([band, values]) => (
              <div key={band} className="rounded-xl border border-platinum bg-white p-4">
                <h3 className="text-sm font-semibold text-charcoal">{band}</h3>
                <div className="mt-2 space-y-2">
                  {ringSizes.map((size) => (
                    <Input
                      key={size}
                      label={`${size}`}
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
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={handlePreview}>
              {t('action.preview')}
            </Button>
            <Button type="button" onClick={handleApply}>
              {t('action.apply')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => backupScope('rings')}>
              {t('action.backup')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => restoreScope('rings')}>
              {t('action.restoreBackup')}
            </Button>
          </div>
          {loadingScopes.has('rings') && <Loader />}
        </Card>
        <Card title={t('rings.previewTitle')} subtitle={t('rings.previewSubtitle')}>
          <PreviewTable previews={previews} />
        </Card>
      </div>
      <LogPanel scope="rings" />
    </div>
  );
}
