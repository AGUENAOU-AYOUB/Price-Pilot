import { useCallback } from 'react';

import { usePricingStore } from '../store/pricingStore';
import { messages } from './messages';

const replaceParams = (template, params = {}) =>
  typeof template === 'string'
    ? template.replace(/\{(\w+)\}/g, (_, token) =>
        Object.prototype.hasOwnProperty.call(params, token) ? params[token] : `{${token}}`,
      )
    : template;

export function useTranslation() {
  const language = usePricingStore((state) => state.language);

  const t = useCallback(
    (key, params) => {
      const table = messages[language] || messages.en;
      const template = table?.[key] ?? messages.en[key] ?? key;
      return replaceParams(template, params);
    },
    [language],
  );

  return { t, language };
}
