import { FormEvent, useMemo, useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Loader } from '../components/Loader';
import { LogPanel } from '../components/LogPanel';
import { PreviewTable } from '../components/PreviewTable';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function GlobalPricingPage() {
  const [percent, setPercent] = useState(0);
  const previewGlobalChange = usePricingStore((state) => state.previewGlobalChange);
  const applyGlobalChange = usePricingStore((state) => state.applyGlobalChange);
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const toggleLoading = usePricingStore((state) => state.toggleLoading);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const { t } = useTranslation();

  const previews = useMemo(() => previewGlobalChange(percent), [percent, previewGlobalChange]);

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toggleLoading('global', true);
    setTimeout(() => {
      applyGlobalChange(percent);
      toggleLoading('global', false);
    }, 450);
  };

  const handleBackup = () => {
    backupScope('global');
  };

  const handleRestore = () => {
    restoreScope('global');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title={t('global.title')} subtitle={t('global.subtitle')}>
          <form onSubmit={handleApply} className="flex flex-col gap-4">
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
              <Button type="submit">{t('action.apply')}</Button>
              <Button type="button" variant="secondary" onClick={handleBackup}>
                {t('action.backup')}
              </Button>
              <Button type="button" variant="ghost" onClick={handleRestore}>
                {t('action.restoreBackup')}
              </Button>
            </div>
            {loadingScopes.has('global') && <Loader />}
          </form>
        </Card>
        <Card title={t('global.previewTitle')} subtitle={t('global.previewSubtitle')}>
          <PreviewTable previews={previews} />
        </Card>
      </div>
      <LogPanel scope="global" />
    </div>
  );
}
