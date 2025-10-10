import { useMemo, useState } from 'react';
import { clsx } from 'clsx';

import { useTranslation } from '../i18n/useTranslation';

import './PreviewTable.css';

const MAD = new Intl.NumberFormat('fr-MA', {
  style: 'currency',
  currency: 'MAD',
  minimumFractionDigits: 2,
});

const formatMoney = (value) => {
  const amount = Number.isFinite(value) ? value : 0;
  return MAD.format(amount).replace('MAD', 'dh').trim();
};

const buildSummaryRow = (label, previous, next) => ({
  label,
  previous,
  next,
  changed: Number(previous ?? 0) !== Number(next ?? 0),
});

export function PreviewTable({ previews }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(() => new Set());

  const hasPreviews = Array.isArray(previews) && previews.length > 0;

  const toggleCard = (productId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const renderedCards = useMemo(() => {
    if (!hasPreviews) {
      return null;
    }

    return previews.map(({ product, updatedBasePrice, updatedCompareAtPrice, variants = [] }) => {
      const summaryRows = [
        buildSummaryRow(t('table.basePrice'), product.basePrice, updatedBasePrice),
        buildSummaryRow(t('table.compareAt'), product.baseCompareAtPrice, updatedCompareAtPrice),
      ];

      const changedVariants = variants.filter((variant) => {
        const prevPrice = Number(variant.previousPrice ?? variant.price);
        const prevCompare = Number(variant.previousCompareAtPrice ?? variant.compareAtPrice);
        return prevPrice !== Number(variant.price) || prevCompare !== Number(variant.compareAtPrice);
      });

      const hasVariantChanges = changedVariants.length > 0;
      const hasSummaryChanges = summaryRows.some((row) => row.changed);
      const hasChanges = hasVariantChanges || hasSummaryChanges;
      const isExpanded = expanded.has(product.id) || hasChanges;

      const cardClassName = clsx('preview-gallery__card', isExpanded ? 'is-expanded' : 'is-collapsed');

      return (
        <article key={product.id} className={cardClassName} data-product-id={product.id}>
          <header
            className="preview-gallery__header"
            onClick={() => toggleCard(product.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleCard(product.id);
              }
            }}
          >
            <div className="preview-gallery__meta">
              <h3 className="preview-gallery__title">{product.title}</h3>
              <p className="preview-gallery__handle">#{product.handle ?? product.id}</p>
            </div>
            <div className="preview-gallery__summary">
              {summaryRows.map((row) => (
                <div key={row.label} className="preview-gallery__summary-item">
                  <span className="preview-gallery__summary-label">{row.label}</span>
                  <div className="preview-gallery__summary-values">
                    <span className="preview-gallery__summary-old">{formatMoney(row.previous)}</span>
                    <span aria-hidden="true">→</span>
                    <span
                      className={clsx('preview-gallery__summary-new', {
                        'text-success-600': row.changed,
                      })}
                    >
                      {formatMoney(row.next)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="preview-gallery__chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </header>

          <section className="preview-gallery__variants">
            {hasChanges && (
              <span className="preview-gallery__badge" role="status">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10 2a1 1 0 01.894.553l7 14A1 1 0 0117 18H3a1 1 0 01-.894-1.447l7-14A1 1 0 0110 2zm0 5a.75.75 0 00-.743.648L9.25 8v3.25a.75.75 0 001.493.102l.007-.102V8a.75.75 0 00-.75-.75zm0 6.5a1 1 0 100 2 1 1 0 000-2z" />
                </svg>
                {hasVariantChanges
                  ? t('table.pendingChanges', { count: changedVariants.length })
                  : t('table.pendingProductChanges')}
              </span>
            )}

            {variants.length === 0 ? (
              <div className="preview-gallery__empty-variants">{t('table.noVariants')}</div>
            ) : (
              <div className="preview-gallery__variant-list">
                {variants.map((variant) => {
                  const prevPrice = Number(variant.previousPrice ?? variant.price);
                  const prevCompare = Number(variant.previousCompareAtPrice ?? variant.compareAtPrice);
                  const pending =
                    prevPrice !== Number(variant.price) || prevCompare !== Number(variant.compareAtPrice);

                  return (
                    <div
                      key={variant.id}
                      className={clsx('preview-gallery__variant-row', {
                        'is-unchanged': !pending,
                      })}
                    >
                      <span className="preview-gallery__variant-title">{variant.title}</span>
                      <div className="preview-gallery__variant-prices">
                        <span className="preview-gallery__variant-old">{formatMoney(prevPrice)}</span>
                        <span aria-hidden="true">→</span>
                        <span className="preview-gallery__variant-new">{formatMoney(variant.price)}</span>
                        <span aria-hidden="true">/</span>
                        <span className="preview-gallery__variant-old">{formatMoney(prevCompare)}</span>
                        <span aria-hidden="true">→</span>
                        <span className="preview-gallery__variant-new">{formatMoney(variant.compareAtPrice)}</span>
                      </div>
                      {pending && (
                        <span className="preview-gallery__badge">{t('table.pendingBadge')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </article>
      );
    });
  }, [expanded, hasPreviews, previews, t]);

  if (!hasPreviews) {
    return <div className="preview-gallery__empty">{t('table.noPreviews')}</div>;
  }

  return <div className="preview-gallery">{renderedCards}</div>;
}
