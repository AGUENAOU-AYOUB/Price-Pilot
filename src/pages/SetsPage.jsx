import { useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Loader } from '../components/Loader';
import { LogPanel } from '../components/LogPanel';
import { PreviewTable } from '../components/PreviewTable';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

export function SetsPage() {
  const previewSets = usePricingStore((state) => state.previewSets);
  const applySets = usePricingStore((state) => state.applySets);
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const toggleLoading = usePricingStore((state) => state.toggleLoading);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const supplements = usePricingStore((state) => state.supplements);
  const { t } = useTranslation();

  const [previews, setPreviews] = useState([]);

  const handlePreview = () => {
    setPreviews(previewSets());
  };

  const handleApply = () => {
    toggleLoading('sets', true);
    setTimeout(() => {
      applySets();
      toggleLoading('sets', false);
    }, 450);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title={t('sets.title')} subtitle={t('sets.subtitle')}>
          <p className="text-sm text-slategray">{t('sets.helper')}</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-platinum">
            <table className="min-w-full divide-y divide-platinum text-sm">
              <thead className="bg-pearl text-xs uppercase tracking-wide text-slategray">
                <tr>
                  <th className="px-4 py-3 text-left">Chain type</th>
                  <th className="px-4 py-3 text-left">Bracelet supplement</th>
                  <th className="px-4 py-3 text-left">Necklace supplement</th>
                  <th className="px-4 py-3 text-left">Combined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-platinum">
                {Object.entries(supplements.necklaces).map(([title, data]) => {
                  const bracelet = supplements.bracelets[title] ?? 0;
                  const combined = bracelet + data.supplement;
                  return (
                    <tr key={title} className="bg-white">
                      <td className="px-4 py-3 font-medium text-charcoal">{title}</td>
                      <td className="px-4 py-3 text-slategray">{bracelet.toFixed(2)} dh</td>
                      <td className="px-4 py-3 text-slategray">{data.supplement.toFixed(2)} dh</td>
                      <td className="px-4 py-3 text-rosegold">{combined.toFixed(2)} dh</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" onClick={handlePreview}>
              {t('action.preview')}
            </Button>
            <Button type="button" onClick={handleApply}>
              {t('action.apply')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => backupScope('sets')}>
              {t('action.backup')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => restoreScope('sets')}>
              {t('action.restoreBackup')}
            </Button>
          </div>
          {loadingScopes.has('sets') && <Loader />}
        </Card>
        <Card title={t('sets.previewTitle')} subtitle={t('sets.previewSubtitle')}>
          <PreviewTable previews={previews} />
        </Card>
      </div>
      <LogPanel scope="sets" />
    </div>
  );
}
