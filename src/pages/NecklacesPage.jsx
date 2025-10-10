import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Loader } from '../components/Loader';
import { LogPanel } from '../components/LogPanel';
import { PreviewTable } from '../components/PreviewTable';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function NecklacesPage() {
  const supplements = usePricingStore((state) => state.supplements.necklaces);
  const updateSupplement = usePricingStore((state) => state.updateNecklaceSupplement);
  const previewNecklaces = usePricingStore((state) => state.previewNecklaces);
  const applyNecklaces = usePricingStore((state) => state.applyNecklaces);
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const toggleLoading = usePricingStore((state) => state.toggleLoading);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();

  const [previews, setPreviews] = useState([]);

  const handlePreview = () => {
    setPreviews(previewNecklaces());
  };

  const handleApply = () => {
    toggleLoading('necklaces', true);
    setTimeout(() => {
      applyNecklaces();
      toggleLoading('necklaces', false);
    }, 450);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title={t('necklaces.title')} subtitle={t('necklaces.subtitle')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(supplements).map(([title, values]) => (
              <div key={title} className="rounded-xl border border-platinum bg-white p-4">
                <h3 className="text-sm font-semibold text-charcoal">{title}</h3>
                <div className="mt-2 space-y-2">
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
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={handlePreview}>
              {t('action.preview')}
            </Button>
            <Button type="button" onClick={handleApply}>
              {t('action.apply')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => backupScope('necklaces')}>
              {t('action.backup')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => restoreScope('necklaces')}>
              {t('action.restoreBackup')}
            </Button>
          </div>
          {loadingScopes.has('necklaces') && <Loader />}
        </Card>
        <Card title={t('necklaces.previewTitle')} subtitle={t('necklaces.previewSubtitle')}>
          <PreviewTable previews={previews} />
        </Card>
      </div>
      <LogPanel scope="necklaces" />
    </div>
  );
}
