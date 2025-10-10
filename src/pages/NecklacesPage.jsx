import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
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
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();

  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);

  const isBusy = loadingScopes.has('necklaces');

  const handlePreview = () => {
    setPreviews(previewNecklaces());
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
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={isBusy}>
            {t('action.preview')}
          </Button>
          <Button
            type="button"
            isLoading={isBusy && activeAction === 'apply'}
            loadingText={t('action.applying')}
            onClick={() => runAction('apply', applyNecklaces)}
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
      <Card title={t('necklaces.previewTitle')} subtitle={t('necklaces.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
