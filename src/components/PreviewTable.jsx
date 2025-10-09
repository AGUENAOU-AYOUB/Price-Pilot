import { useTranslation } from '../i18n/useTranslation';

export function PreviewTable({ previews }) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-xl border border-platinum">
      <table className="min-w-full divide-y divide-platinum">
        <thead className="bg-pearl text-left text-xs font-semibold uppercase tracking-wide text-slategray">
          <tr>
            <th className="px-4 py-3">{t('table.product')}</th>
            <th className="px-4 py-3">{t('table.basePrice')}</th>
            <th className="px-4 py-3">{t('table.newBasePrice')}</th>
            <th className="px-4 py-3">{t('table.compareAt')}</th>
            <th className="px-4 py-3">{t('table.newCompareAt')}</th>
            <th className="px-4 py-3">{t('table.variants')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-platinum text-sm">
          {previews.map(({ product, updatedBasePrice, updatedCompareAtPrice, variants }) => (
            <tr key={product.id} className="bg-white hover:bg-blush">
              <td className="px-4 py-3 font-medium text-charcoal">{product.title}</td>
              <td className="px-4 py-3 text-slategray">{product.basePrice.toFixed(2)} dh</td>
              <td className="px-4 py-3 text-rosegold">{updatedBasePrice.toFixed(2)} dh</td>
              <td className="px-4 py-3 text-slategray">{product.baseCompareAtPrice.toFixed(2)} dh</td>
              <td className="px-4 py-3 text-rosegold">{updatedCompareAtPrice.toFixed(2)} dh</td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1 text-xs text-slategray">
                  {variants.length === 0 && <span className="text-slategray">{t('table.noVariants')}</span>}
                  {variants.map((variant) => (
                    <span key={variant.id}>
                      {variant.title}: <span className="text-charcoal">{variant.price.toFixed(2)} dh</span>{' '}
                      <span className="text-slategray">(Compare at {variant.compareAtPrice.toFixed(2)} dh)</span>
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
