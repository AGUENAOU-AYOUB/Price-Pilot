import { useMemo } from 'react';
import { PricingLogEntry, usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

interface LogPanelProps {
  scope?: PricingLogEntry['variantScope'];
}

export function LogPanel({ scope }: LogPanelProps) {
  const logs = usePricingStore((state) => state.logs);
  const { t } = useTranslation();

  const filteredLogs = useMemo(() => {
    if (!scope) return logs;
    return logs.filter((log) => log.variantScope === scope);
  }, [logs, scope]);

  return (
    <div className="max-h-64 overflow-y-auto rounded-xl border border-platinum bg-white p-4 text-sm">
      <h3 className="mb-2 text-sm font-semibold text-charcoal">{t('log.activity')}</h3>
      <ul className="space-y-2">
        {filteredLogs.length === 0 && <li className="text-slategray">{t('log.empty')}</li>}
        {filteredLogs.map((log) => (
          <li key={log.id} className="rounded-lg bg-pearl p-3">
            <p className="font-medium text-charcoal">{log.message}</p>
            <p className="text-xs text-slategray">
              {new Date(log.timestamp).toLocaleString()} · {log.variantScope}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
