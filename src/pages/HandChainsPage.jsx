import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Loader } from '../components/Loader';
import { LogPanel } from '../components/LogPanel';
import { PreviewTable } from '../components/PreviewTable';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function HandChainsPage() {
  const supplements = usePricingStore((state) => state.supplements.handChains);
  const updateSupplement = usePricingStore((state) => state.updateHandChainSupplement);
  const previewHandChains = usePricingStore((state) => state.previewHandChains);
  const applyHandChains = usePricingStore((state) => state.applyHandChains);
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const toggleLoading = usePricingStore((state) => state.toggleLoading);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();

  const [previews, setPreviews] = useState([]);

  const handlePreview = () => {
    setPreviews(previewHandChains());
  };

  const handleApply = async () => {
    toggleLoading('handchains', true);
    try {
      await applyHandChains();
    } finally {
      toggleLoading('handchains', false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title={t('handChains.title')} subtitle={t('handChains.subtitle')}>
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={handlePreview}>
              {t('action.preview')}
            </Button>
            <Button type="button" onClick={handleApply}>
              {t('action.apply')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => backupScope('handchains')}>
              {t('action.backup')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => restoreScope('handchains')}>
              {t('action.restoreBackup')}
            </Button>
          </div>
          {loadingScopes.has('handchains') && <Loader />}
        </Card>
        <Card title={t('handChains.previewTitle')} subtitle={t('handChains.previewSubtitle')}>
          <PreviewTable previews={previews} />
        </Card>
      </div>
      <LogPanel scope="handchains" />
    </div>
  );
}
