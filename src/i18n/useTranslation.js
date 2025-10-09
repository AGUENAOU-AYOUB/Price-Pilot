import { useCallback } from 'react';

import { usePricingStore } from '../store/pricingStore';
import { messages } from './messages';

export function useTranslation() {
  const language = usePricingStore((state) => state.language);

  const t = useCallback(
    (key) => {
      const table = messages[language] || messages.en;
      return table?.[key] ?? messages.en[key] ?? key;
    },
    [language],
  );

  return { t, language };
}
