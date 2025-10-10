import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { PreviewTable } from '../components/PreviewTable';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function BraceletsPage() {
  const supplements = usePricingStore((state) => state.supplements.bracelets);
  const updateSupplement = usePricingStore((state) => state.updateBraceletSupplement);
  const previewBracelets = usePricingStore((state) => state.previewBracelets);
  const applyBracelets = usePricingStore((state) => state.applyBracelets);
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();

  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);

  const isBusy = loadingScopes.has('bracelets');

  const handlePreview = () => {
    setPreviews(previewBracelets());
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
      <Card title={t('bracelets.title')} subtitle={t('bracelets.subtitle')}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={isBusy}>
            {t('action.preview')}
          </Button>
          <Button
            type="button"
            isLoading={isBusy && activeAction === 'apply'}
            loadingText={t('action.applying')}
            onClick={() => runAction('apply', applyBracelets)}
          >
            {t('action.apply')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            isLoading={isBusy && activeAction === 'backup'}
            loadingText={t('action.backingUp')}
            onClick={() => runAction('backup', () => backupScope('bracelets'))}
          >
            {t('action.backup')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            isLoading={isBusy && activeAction === 'restore'}
            loadingText={t('action.restoring')}
            onClick={() => runAction('restore', () => restoreScope('bracelets'))}
          >
            {t('action.restoreBackup')}
          </Button>
        </div>
      </Card>
      <Card title={t('bracelets.previewTitle')} subtitle={t('bracelets.previewSubtitle')}>
        <PreviewTable previews={previews} />
      </Card>
    </div>
  );
}
