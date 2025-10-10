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
  if (value === null || value === undefined) {
    return '—';
  }

  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) {
    return '—';
  }

  return MAD.format(parsed).replace('MAD', 'dh').trim();
};

const buildSummaryRow = (label, previous, next) => ({
  label,
  previous,
  next,
  changed: Number(previous ?? 0) !== Number(next ?? 0),
});

export function PreviewTable({ previews }) {
  const { t } = useTranslation();
  const [expansionState, setExpansionState] = useState(() => new Map());

  const hasPreviews = Array.isArray(previews) && previews.length > 0;

  const changeLabels = useMemo(
    () => ({
      price: t('table.changePrice'),
      compare: t('table.changeCompareAt'),
      'price-compare': t('table.changePriceAndCompare'),
    }),
    [t],
  );

  const toggleCard = (productId, defaultOpen) => {
    setExpansionState((current) => {
      const next = new Map(current);
      const existing = next.get(productId);
      const currentlyOpen = existing ?? Boolean(defaultOpen);
      next.set(productId, !currentlyOpen);
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

      const changedVariants = variants.filter((variant) => variant.status === 'changed');
      const missingVariants = variants.filter((variant) => variant.status === 'missing');

      const hasVariantChanges = changedVariants.length > 0;
      const hasSummaryChanges = summaryRows.some((row) => row.changed);
      const hasMissingVariants = missingVariants.length > 0;
      const hasChanges = hasVariantChanges || hasSummaryChanges || hasMissingVariants;
      const expansionPreference = expansionState.get(product.id);
      const isExpanded = expansionPreference ?? hasChanges;

      const summaryBadges = [];
      if (hasVariantChanges) {
        summaryBadges.push({
          key: 'pending',
          label: t('table.pendingChanges', { count: changedVariants.length }),
          tone: 'pending',
        });
      }
      if (hasMissingVariants) {
        summaryBadges.push({
          key: 'missing',
          label: t('table.missingVariants', { count: missingVariants.length }),
          tone: 'error',
        });
      }
      if (!hasVariantChanges && hasSummaryChanges) {
        summaryBadges.push({
          key: 'product',
          label: t('table.pendingProductChanges'),
          tone: 'info',
        });
      }

      const cardClassName = clsx('preview-gallery__card', isExpanded ? 'is-expanded' : 'is-collapsed');

      return (
        <article key={product.id} className={cardClassName} data-product-id={product.id}>
          <button
            type="button"
            className="preview-gallery__header"
            onClick={() => toggleCard(product.id, hasChanges)}
            aria-expanded={isExpanded}
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
          </button>

          <section className="preview-gallery__variants">
            {summaryBadges.length > 0 && (
              <div className="preview-gallery__flags" role="status">
                {summaryBadges.map((badge) => (
                  <span key={badge.key} className={clsx('preview-gallery__badge', `is-${badge.tone}`)}>
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {variants.length === 0 ? (
              <div className="preview-gallery__empty-variants">{t('table.noVariants')}</div>
            ) : (
              <div className="preview-gallery__variant-list">
                {variants.map((variant) => {
                  const status = variant.status ?? 'unchanged';
                  const isChanged = status === 'changed';
                  const isMissing = status === 'missing';
                  const changeType = variant.changeType;
                  const changeBadgeTone =
                    changeType === 'compare'
                      ? 'is-info'
                      : changeType === 'price-compare'
                        ? 'is-pending'
                        : 'is-pending';
                  const changeBadgeLabel = changeType
                    ? changeLabels[changeType] ?? t('table.pendingBadge')
                    : t('table.pendingBadge');

                  return (
                    <div
                      key={variant.id}
                      className={clsx('preview-gallery__variant-row', {
                        'is-unchanged': !isChanged && !isMissing,
                        'is-missing': isMissing,
                      })}
                    >
                      <span className="preview-gallery__variant-title">{variant.title}</span>
                      <div className="preview-gallery__variant-prices">
                        <span className="preview-gallery__variant-old">{formatMoney(variant.previousPrice)}</span>
                        <span aria-hidden="true">→</span>
                        <span className="preview-gallery__variant-new">{formatMoney(variant.price)}</span>
                        <span aria-hidden="true">/</span>
                        <span className="preview-gallery__variant-old">{formatMoney(variant.previousCompareAtPrice)}</span>
                        <span aria-hidden="true">→</span>
                        <span className="preview-gallery__variant-new">{formatMoney(variant.compareAtPrice)}</span>
                      </div>
                      {isChanged && (
                        <span className={clsx('preview-gallery__badge', changeBadgeTone)}>{changeBadgeLabel}</span>
                      )}
                      {isMissing && (
                        <span className={clsx('preview-gallery__badge', 'is-error')}>
                          {t('table.missingBadge')}
                        </span>
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
  }, [expansionState, hasPreviews, previews, t]);

  if (!hasPreviews) {
    return <div className="preview-gallery__empty">{t('table.noPreviews')}</div>;
  }

  return <div className="preview-gallery">{renderedCards}</div>;
}
