import { useTranslation } from '../i18n/useTranslation';

const variantCardClasses = [
  'flex flex-col',
  'rounded-xl',
  'border border-platinum/70',
  'bg-white/80',
  'px-4 py-3',
  'text-xs',
  'shadow-inner',
].join(' ');

export function PreviewTable({ previews }) {
  const { t } = useTranslation();

  if (!previews?.length) {
    return (
      <div className="rounded-2xl border border-diamond bg-white/60 p-8 text-center text-sm text-slategray shadow-soft">
        {t('table.noPreviews')}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-diamond bg-gradient-to-br from-white via-pearl to-white p-6 shadow-soft">
      <div className="overflow-hidden rounded-2xl border border-platinum/70">
        <table className="min-w-full table-fixed border-separate border-spacing-0">
          <thead>
            <tr className="bg-pearl/80 text-left text-xs font-semibold uppercase tracking-[0.15em] text-slategray">
              <th className="px-6 py-4 text-slategray/90">{t('table.product')}</th>
              <th className="px-6 py-4 text-slategray/90">{t('table.basePrice')}</th>
              <th className="px-6 py-4 text-rosegold">{t('table.newBasePrice')}</th>
              <th className="px-6 py-4 text-slategray/90">{t('table.compareAt')}</th>
              <th className="px-6 py-4 text-rosegold">{t('table.newCompareAt')}</th>
              <th className="px-6 py-4 text-slategray/90">{t('table.variants')}</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {previews.map(({ product, updatedBasePrice, updatedCompareAtPrice, variants }, index) => (
              <tr
                key={product.id}
                className={`transition-colors duration-200 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-white/80'
                } hover:bg-blush/70`}
              >
                <td className="px-6 py-5 align-top">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-semibold text-charcoal">{product.title}</span>
                    <span className="text-xs uppercase tracking-wide text-slategray/70">#{product.handle}</span>
                  </div>
                </td>
                <td className="px-6 py-5 align-top text-slategray">{product.basePrice.toFixed(2)} dh</td>
                <td className="px-6 py-5 align-top text-lg font-semibold text-rosegold">
                  {updatedBasePrice.toFixed(2)} dh
                </td>
                <td className="px-6 py-5 align-top text-slategray">{product.baseCompareAtPrice.toFixed(2)} dh</td>
                <td className="px-6 py-5 align-top text-lg font-semibold text-rosegold">
                  {updatedCompareAtPrice.toFixed(2)} dh
                </td>
                <td className="px-6 py-5 align-top">
                  {variants.length === 0 ? (
                    <span className="inline-flex rounded-full bg-platinum/60 px-4 py-2 text-xs font-medium text-slategray">
                      {t('table.noVariants')}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {variants.map((variant) => (
                        <div key={variant.id} className={variantCardClasses}>
                          <span className="text-[0.7rem] uppercase tracking-wide text-slategray/70">
                            {variant.title}
                          </span>
                          <span className="text-sm font-semibold text-charcoal">
                            {variant.price.toFixed(2)} dh
                          </span>
                          <span className="text-[0.7rem] text-slategray">
                            {t('table.compareAt')} {variant.compareAtPrice.toFixed(2)} dh
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
