import { useTranslation } from '../i18n/useTranslation';

import './PreviewTable.css';

const formatMoney = (value) => {
  const amount = Number.isFinite(value) ? value : 0;
  return `${amount.toFixed(2)} dh`;
};

const renderPriceRow = (label, oldValue, newValue) => (
  <div className="preview-table__price-row">
    <span className="preview-table__price-label">{label}</span>
    <div className="preview-table__price-values">
      <span className="preview-table__price-old">{formatMoney(oldValue)}</span>
      <span className="preview-table__price-arrow" aria-hidden="true">
        →
      </span>
      <span className="preview-table__price-new">{formatMoney(newValue)}</span>
    </div>
  </div>
);

export function PreviewTable({ previews }) {
  const { t } = useTranslation();

  if (!previews?.length) {
    return (
      <div className="preview-table__wrapper">
        <div className="preview-table preview-table--empty">
          <div className="preview-table__empty">{t('table.noPreviews')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-table__wrapper">
      <div className="preview-table">
        {previews.map(({ product, updatedBasePrice, updatedCompareAtPrice, variants }) => (
          <article key={product.id} className="preview-table__card">
            <header className="preview-table__header">
              <div>
                <h3 className="preview-table__title">{product.title}</h3>
                <p className="preview-table__meta">#{product.handle ?? product.id}</p>
              </div>
              <div className="preview-table__price-summary">
                {renderPriceRow(t('table.basePrice'), product.basePrice, updatedBasePrice)}
                {renderPriceRow(t('table.compareAt'), product.baseCompareAtPrice, updatedCompareAtPrice)}
              </div>
            </header>

            <section className="preview-table__variants">
              <div className="preview-table__variants-header">{t('table.variants')}</div>
              {variants.length === 0 ? (
                <div className="preview-table__empty-variants">{t('table.noVariants')}</div>
              ) : (
                <div className="preview-table__variant-grid">
                  {variants.map((variant) => (
                    <div key={variant.id} className="preview-table__variant-card">
                      <span className="preview-table__variant-title">{variant.title}</span>
                      <span className="preview-table__variant-price">{formatMoney(variant.price)}</span>
                      <span className="preview-table__variant-compare">
                        {t('table.compareAt')}
                        <span className="preview-table__variant-compare-value">
                          {formatMoney(variant.compareAtPrice)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </article>
        ))}
      </div>
    </div>
  );
}
