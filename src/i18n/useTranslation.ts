import { useCallback } from 'react';

import { usePricingStore } from '../store/pricingStore';
import { Language, MessageKey, messages } from './messages';

export function useTranslation() {
  const language = usePricingStore((state) => state.language);

  const t = useCallback(
    (key: MessageKey): string => {
      const table = messages[language as Language];
      return table?.[key] ?? messages.en[key];
    },
    [language],
  );

  return { t, language };
}
