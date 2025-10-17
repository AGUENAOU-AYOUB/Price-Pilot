import { useMemo } from 'react';
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

const SuccessMarkIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16.25 5.75l-7.5 8-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ErrorMarkIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 6l8 8M6 14L14 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SectionIcon = ({ tone }) => (
  <span
    className={clsx('preview-table__section-icon', {
      'is-success': tone === 'success',
      'is-error': tone === 'error',
    })}
    aria-hidden="true"
  >
    {tone === 'success' ? <SuccessMarkIcon /> : <ErrorMarkIcon />}
  </span>
);

const VariantRow = ({ variant, changeLabels }) => {
  const status = variant.status ?? 'unchanged';
  const isMissing = status === 'missing';
  const changeType = variant.changeType;
  const changeBadgeLabel = changeType
    ? changeLabels[changeType] ?? changeLabels.defaultLabel
    : changeLabels.defaultLabel;

  return (
    <div
      className={clsx('preview-table__variant-row', {
        'is-missing': isMissing,
      })}
    >
      <div className="preview-table__variant-meta">
        <span className="preview-table__variant-title">{variant.title}</span>
        {status === 'changed' && (
          <span className="preview-table__badge is-muted">{changeBadgeLabel}</span>
        )}
        {isMissing && (
          <span className="preview-table__badge is-error">{changeLabels.missingLabel}</span>
        )}
      </div>
      <div className="preview-table__variant-prices">
        <span>{formatMoney(variant.previousPrice)}</span>
        <span aria-hidden="true">→</span>
        <span className="preview-table__price-new">{formatMoney(variant.price)}</span>
      </div>
      <div className="preview-table__variant-prices">
        <span>{formatMoney(variant.previousCompareAtPrice)}</span>
        <span aria-hidden="true">→</span>
        <span className="preview-table__price-new">{formatMoney(variant.compareAtPrice)}</span>
      </div>
      {isMissing && (
        <p className="preview-table__variant-note">{changeLabels.missingDetail}</p>
      )}
    </div>
  );
};

const PreviewSection = ({
  tone,
  title,
  count,
  emptyMessage,
  entries,
  changeLabels,
}) => (
  <section className={clsx('preview-table__section', `is-${tone}`)}>
    <header className="preview-table__section-header">
      <div className="preview-table__section-title">
        <SectionIcon tone={tone} />
        <h3>{title}</h3>
      </div>
      <span className="preview-table__section-count">{count}</span>
    </header>

    {entries.length === 0 ? (
      <p className="preview-table__section-empty">{emptyMessage}</p>
    ) : (
      <div className="preview-table__products" role="list">
        {entries.map((entry) => (
          <article
            key={entry.product.id}
            className="preview-table__product"
            role="listitem"
          >
            <header className="preview-table__product-header">
              <div>
                <h4>{entry.product.title}</h4>
                <p>#{entry.product.handle ?? entry.product.id}</p>
              </div>
              {entry.summaryBadges.length > 0 && (
                <div className="preview-table__badges">
                  {entry.summaryBadges.map((badge) => (
                    <span key={badge.key} className={clsx('preview-table__badge', `is-${badge.tone}`)}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              )}
            </header>

            <dl className="preview-table__product-summary">
              {entry.summaryRows.map((row) => (
                <div key={row.label} className="preview-table__product-summary-item">
                  <dt>{row.label}</dt>
                  <dd>
                    <span>{formatMoney(row.previous)}</span>
                    <span aria-hidden="true">→</span>
                    <span className={clsx({ 'is-changed': row.changed })}>
                      {formatMoney(row.next)}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            {entry.changedVariants.length > 0 && (
              <div className="preview-table__variants-block">
                <h5>{entry.changedHeading}</h5>
                <div className="preview-table__variant-list">
                  {entry.changedVariants.map((variant) => (
                    <VariantRow key={variant.id} variant={variant} changeLabels={changeLabels} />
                  ))}
                </div>
              </div>
            )}

            {entry.missingVariants.length > 0 && (
              <div className="preview-table__variants-block is-error">
                <h5>{entry.missingHeading}</h5>
                <div className="preview-table__variant-list">
                  {entry.missingVariants.map((variant) => (
                    <VariantRow key={variant.id} variant={variant} changeLabels={changeLabels} />
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    )}
  </section>
);

export function PreviewTable({ previews }) {
  const { t } = useTranslation();

  const hasPreviews = Array.isArray(previews) && previews.length > 0;

  const changeLabels = useMemo(
    () => ({
      price: t('table.changePrice'),
      compare: t('table.changeCompareAt'),
      'price-compare': t('table.changePriceAndCompare'),
      defaultLabel: t('table.pendingBadge'),
      missingLabel: t('table.missingBadge'),
      missingDetail: t('table.missingVariantDetail'),
    }),
    [t],
  );

  const summary = useMemo(() => {
    if (!hasPreviews) {
      return {
        stats: { total: 0, modified: 0, success: 0, failed: 0 },
        success: [],
        failed: [],
      };
    }

    let modifiedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    const successEntries = [];
    const failedEntries = [];

    previews.forEach(({ product, updatedBasePrice, updatedCompareAtPrice, variants = [] }) => {
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

      if (hasChanges) {
        modifiedCount += 1;
      }

      const summaryBadges = [];
      if (hasVariantChanges) {
        summaryBadges.push({
          key: 'pending',
          label: t('table.pendingChanges', { count: changedVariants.length }),
          tone: 'muted',
        });
      }
      if (!hasVariantChanges && hasSummaryChanges) {
        summaryBadges.push({
          key: 'product',
          label: t('table.pendingProductChanges'),
          tone: 'muted',
        });
      }
      if (hasMissingVariants) {
        summaryBadges.push({
          key: 'missing',
          label: t('table.missingVariants', { count: missingVariants.length }),
          tone: 'error',
        });
      }

      const entry = {
        product,
        summaryRows,
        summaryBadges,
        changedVariants,
        missingVariants,
        changedHeading: t('table.variantChangesHeading', { count: changedVariants.length }),
        missingHeading: t('table.missingVariantsHeading', { count: missingVariants.length }),
      };

      if (hasMissingVariants) {
        failedEntries.push(entry);
        failedCount += 1;
      } else {
        successEntries.push(entry);
        successCount += 1;
      }
    });

    return {
      stats: {
        total: previews.length,
        modified: modifiedCount,
        success: successCount,
        failed: failedCount,
      },
      success: successEntries,
      failed: failedEntries,
    };
  }, [hasPreviews, previews, t]);

  if (!hasPreviews) {
    return <div className="preview-table__empty">{t('table.noPreviews')}</div>;
  }

  return (
    <div className="preview-table">
      <div className="preview-table__summary" role="status" aria-live="polite">
        <div className="preview-table__summary-item">
          <span className="preview-table__summary-label">{t('table.summaryTotal')}</span>
          <span className="preview-table__summary-value">{summary.stats.total}</span>
        </div>
        <div className="preview-table__summary-item">
          <span className="preview-table__summary-label">{t('table.summaryModified')}</span>
          <span className="preview-table__summary-value">{summary.stats.modified}</span>
        </div>
        <div className="preview-table__summary-item is-success">
          <span className="preview-table__summary-label">{t('table.summarySuccess')}</span>
          <span className="preview-table__summary-value">{summary.stats.success}</span>
        </div>
        <div className="preview-table__summary-item is-error">
          <span className="preview-table__summary-label">{t('table.summaryFailed')}</span>
          <span className="preview-table__summary-value">{summary.stats.failed}</span>
        </div>
      </div>

      <div className="preview-table__sections">
        <PreviewSection
          tone="success"
          title={t('table.sectionSuccessTitle')}
          count={summary.success.length}
          emptyMessage={t('table.sectionSuccessEmpty')}
          entries={summary.success}
          changeLabels={changeLabels}
        />
        <PreviewSection
          tone="error"
          title={t('table.sectionFailedTitle')}
          count={summary.failed.length}
          emptyMessage={t('table.sectionFailedEmpty')}
          entries={summary.failed}
          changeLabels={changeLabels}
        />
      </div>
    </div>
  );
}
