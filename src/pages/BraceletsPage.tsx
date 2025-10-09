import { useMemo } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Loader } from '../components/Loader';
import { LogPanel } from '../components/LogPanel';
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
  const toggleLoading = usePricingStore((state) => state.toggleLoading);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();

  const previews = useMemo(() => previewBracelets(), [previewBracelets, supplements]);

  const handleApply = () => {
    toggleLoading('bracelets', true);
    setTimeout(() => {
      applyBracelets();
      toggleLoading('bracelets', false);
    }, 450);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title={t('bracelets.title')} subtitle={t('bracelets.subtitle')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(supplements).map(([title, value]) => (
              <Input
                key={title}
                label={`${title}`}
                type="number"
                value={value}
                onChange={(event) => updateSupplement(title, Number(event.target.value))}
                adornment="dh"
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleApply}>{t('action.apply')}</Button>
            <Button variant="secondary" onClick={() => backupScope('bracelets')}>
              {t('action.backup')}
            </Button>
            <Button variant="ghost" onClick={() => restoreScope('bracelets')}>
              {t('action.restoreBackup')}
            </Button>
          </div>
          {loadingScopes.has('bracelets') && <Loader />}
        </Card>
        <Card title={t('bracelets.previewTitle')} subtitle={t('bracelets.previewSubtitle')}>
          <PreviewTable previews={previews} />
        </Card>
      </div>
      <LogPanel scope="bracelets" />
    </div>
  );
}
