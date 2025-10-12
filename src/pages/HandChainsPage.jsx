import { useMemo, useState } from 'react';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { PreviewTable } from '../components/PreviewTable';
import { useToast } from '../components/ToastProvider';
import { usePageLayoutContext } from '../components/PageLayout';
import { usePricingStore } from '../store/pricingStore';
import { useTranslation } from '../i18n/useTranslation';

const COLLECTION_OPTIONS = [
  { label: 'Hand Chains', value: 'hand' },
  { label: 'Bracelets', value: 'bracelet' },
  { label: 'Necklaces', value: 'collier' },
  { label: 'Rings', value: 'bague' },
  { label: 'All Collections', value: 'all' },
];

const ACTIVITY_ICONS = {
  preview: PreviewIcon,
  metafields: SparkleIcon,
  apply: CheckIcon,
  backup: ShieldIcon,
  restore: RotateIcon,
};

const currencyFormatter = new Intl.NumberFormat('fr-MA', {
  style: 'currency',
  currency: 'MAD',
  minimumFractionDigits: 2,
});

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return currencyFormatter
    .format(typeof value === 'string' ? Number(value) : value)
    .replace('MAD', 'dh')
    .trim();
}

function summarizePreview(preview) {
  const basePrice = Number(preview?.product?.basePrice ?? 0);
  const updatedBase = Number(preview?.updatedBasePrice ?? preview?.product?.basePrice ?? 0);
  const compareAt = Number(preview?.product?.baseCompareAtPrice ?? 0);
  const updatedCompare = Number(preview?.updatedCompareAtPrice ?? preview?.product?.baseCompareAtPrice ?? 0);
  const variants = Array.isArray(preview?.variants) ? preview.variants : [];

  const missingCount = variants.filter((variant) => variant.status === 'missing').length;
  const changedVariants = variants.filter((variant) => variant.status === 'changed').length;
  const priceChanged = basePrice !== updatedBase;
  const compareChanged = compareAt !== updatedCompare;
  const hasChanges = priceChanged || compareChanged || changedVariants > 0;

  if (missingCount > 0) {
    return {
      tone: 'error',
      label: `${missingCount} missing`,
      changed: true,
    };
  }

  if (hasChanges) {
    return {
      tone: 'success',
      label: 'Ready to sync',
      changed: true,
    };
  }

  return {
    tone: 'warning',
    label: 'No changes detected',
    changed: false,
  };
}

function buildStats(previews) {
  return previews.reduce(
    (accumulator, preview) => {
      const summary = summarizePreview(preview);

      if (summary.changed) {
        accumulator.modified += 1;
      }
      if (summary.tone === 'success') {
        accumulator.success += 1;
      }
      if (summary.tone === 'error') {
        accumulator.failed += 1;
      }

      return accumulator;
    },
    { total: previews.length, modified: 0, success: 0, failed: 0 },
  );
}

function StatPill({ label, value, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'bg-slate-100 text-slate-600 border border-slate-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    error: 'bg-rose-50 text-rose-600 border border-rose-200',
  }[tone];

  return (
    <div className={`flex flex-col gap-1 rounded-xl px-4 py-3 text-sm font-medium ${toneClass}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-current/70">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  );
}

function ProductPreviewRow({ preview }) {
  const summary = summarizePreview(preview);
  const product = preview?.product ?? {};
  const statusClass = {
    success: 'text-emerald-600',
    error: 'text-rose-600',
    warning: 'text-amber-600',
  }[summary.tone];
  const dotClass = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    warning: 'bg-amber-500',
  }[summary.tone];

  const identifier = product.handle ?? product.id;
  const initials = product.title
    ? product.title
        .split(' ')
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join('')
        .toUpperCase()
    : 'PP';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 shadow-sm transition duration-200 hover:border-indigo-200 hover:bg-indigo-50/60 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-sm font-semibold text-slate-600">
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{product.title ?? 'Untitled product'}</p>
          <p className="text-xs text-slate-500">SKU #{identifier}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-start gap-2 text-sm sm:flex-row sm:items-center sm:justify-end sm:gap-6">
        <div className="text-left sm:text-right">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Price</span>
          <p className="text-sm font-medium text-slate-700">
            {formatCurrency(product.basePrice)}
            <span className="mx-2 text-slate-400" aria-hidden="true">
              →
            </span>
            <span className={summary.changed ? 'text-indigo-600' : 'text-slate-500'}>
              {formatCurrency(preview.updatedBasePrice)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
          <span className={`text-sm font-semibold ${statusClass}`}>{summary.label}</span>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ entry }) {
  const Icon = ACTIVITY_ICONS[entry.type] ?? ClockIcon;
  const toneClass = {
    preview: 'bg-indigo-500/10 text-indigo-600',
    metafields: 'bg-violet-500/10 text-violet-600',
    apply: 'bg-emerald-500/10 text-emerald-600',
    backup: 'bg-amber-500/10 text-amber-600',
    restore: 'bg-slate-500/10 text-slate-600',
    default: 'bg-slate-500/10 text-slate-600',
  }[entry.type ?? 'default'];

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{entry.description}</p>
          <span className="text-xs text-slate-400">{formatTimestamp(entry.timestamp)}</span>
        </div>
        <p className="text-xs text-slate-500">Triggered by {entry.user}</p>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return '';
  }

  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch (error) {
    return String(timestamp);
  }
}

function PreviewIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-5 w-5 ${props.className ?? ''}`}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SparkleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-5 w-5 ${props.className ?? ''}`}>
      <path d="M12 3l1.8 3.7L18 8.5l-3.2 2.7L15 15l-3-1.8L9 15l.2-3.8L6 8.5l4.2-.8L12 3z" strokeLinejoin="round" />
      <path d="M5 19l1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-5 w-5 ${props.className ?? ''}`}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-5 w-5 ${props.className ?? ''}`}>
      <path d="M12 3l8 4v5c0 5.25-3.438 9.984-8 11-4.562-1.016-8-5.75-8-11V7l8-4z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RotateIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-5 w-5 ${props.className ?? ''}`}>
      <path d="M4 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 10a8 8 0 00-14.9-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14a8 8 0 0014.9 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-5 w-5 ${props.className ?? ''}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HandChainsPage() {
  const supplements = usePricingStore((state) => state.supplements.handChains);
  const updateSupplement = usePricingStore((state) => state.updateHandChainSupplement);
  const previewHandChains = usePricingStore((state) => state.previewHandChains);
  const applyHandChains = usePricingStore((state) => state.applyHandChains);
  const alignHandChainVariantsFromMetafields = usePricingStore(
    (state) => state.alignHandChainVariantsFromMetafields,
  );
  const backupScope = usePricingStore((state) => state.backupScope);
  const restoreScope = usePricingStore((state) => state.restoreScope);
  const loadingScopes = usePricingStore((state) => state.loadingScopes);
  const username = usePricingStore((state) => state.username);
  const { searchQuery } = usePageLayoutContext();
  const { t } = useTranslation();
  const toast = useToast();

  const [previews, setPreviews] = useState([]);
  const [activeAction, setActiveAction] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [collectionFilter, setCollectionFilter] = useState('hand');
  const [productTag, setProductTag] = useState('hchn');
  const [basePrice, setBasePrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [activity, setActivity] = useState([]);
  const [timelineRange, setTimelineRange] = useState('7');
  const tabs = useMemo(
    () => [
      { key: 'overview', label: 'Overview' },
      { key: 'preview', label: 'Preview' },
      { key: 'apply', label: 'Apply Changes' },
      { key: 'history', label: 'History' },
    ],
    [],
  );

  const isBusy = loadingScopes.has('handchains');

  const filteredPreviews = useMemo(() => {
    if (!Array.isArray(previews)) {
      return [];
    }

    const normalizedTag = productTag.trim().toLowerCase();
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return previews.filter((preview) => {
      const product = preview?.product ?? {};
      const collection = String(product.collection ?? '').toLowerCase();
      const tags = Array.isArray(product.tags)
        ? product.tags.map((tag) => String(tag).toLowerCase())
        : [];
      const matchesCollection =
        collectionFilter === 'all' || collection.includes(collectionFilter);
      const matchesTag =
        normalizedTag.length === 0 || tags.some((tag) => tag.includes(normalizedTag));
      const matchesSearch =
        normalizedSearch.length === 0 ||
        String(product.title ?? '').toLowerCase().includes(normalizedSearch) ||
        String(product.handle ?? '').toLowerCase().includes(normalizedSearch);

      return matchesCollection && matchesTag && matchesSearch;
    });
  }, [collectionFilter, previews, productTag, searchQuery]);

  const previewStats = useMemo(() => buildStats(filteredPreviews), [filteredPreviews]);

  const appendActivity = (type, description) => {
    setActivity((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        description,
        timestamp: new Date().toISOString(),
        user: username ?? 'System',
      },
      ...current,
    ]);
  };

  const handlePreview = () => {
    const results = previewHandChains();
    setPreviews(results);

    if (!Array.isArray(results) || results.length === 0) {
      toast.error(t('toast.previewEmpty', { scope: t('nav.handChains') }));
      return;
    }

    const missingCount = results.reduce((count, preview) => {
      if (!preview?.variants) {
        return count;
      }
      return count + preview.variants.filter((variant) => variant.status === 'missing').length;
    }, 0);

    if (missingCount > 0) {
      toast.error(t('toast.previewMissing', { scope: t('nav.handChains'), count: missingCount }));
      appendActivity('preview', 'Preview completed with missing variants');
      return;
    }

    toast.success(t('toast.previewReady', { scope: t('nav.handChains') }));
    appendActivity('preview', 'Generated hand chains preview');
    setActiveTab('preview');
  };

  const runAction = async (action, handler, activityLabel) => {
    setActiveAction(action);
    try {
      await handler();
      if (activityLabel) {
        appendActivity(action, activityLabel);
      }
    } finally {
      setActiveAction(null);
    }
  };

  const timelineEntries = useMemo(() => {
    if (timelineRange === '7') {
      return activity;
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(timelineRange));
    return activity.filter((entry) => new Date(entry.timestamp) >= cutoff);
  }, [activity, timelineRange]);

  const overviewActivity = timelineEntries.slice(0, 4);

  const statPills = [
    { label: 'Total Products', value: previewStats.total ?? 0, tone: 'neutral' },
    { label: 'Modified', value: previewStats.modified ?? 0, tone: 'warning' },
    { label: 'Succeeded', value: previewStats.success ?? 0, tone: 'success' },
    { label: 'Failed', value: previewStats.failed ?? 0, tone: 'error' },
  ];

  const quickStats = [
    { label: 'Active chain styles', value: Object.keys(supplements ?? {}).length },
    { label: 'Current tag filter', value: productTag || '—' },
    { label: 'Search filter', value: searchQuery ? `“${searchQuery}”` : 'Not applied' },
  ];

  const recentChanges = activity.slice(0, 3);

  const configurationCard = (
    <Card
      title="Pricing Configuration"
      subtitle="Define the collection filters and price adjustments that govern hand chain products."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Select
          label="Collection"
          value={collectionFilter}
          onChange={(event) => setCollectionFilter(event.target.value)}
          options={COLLECTION_OPTIONS}
          helperText="Filter preview results by Shopify collection."
        />
        <Input
          label="Product Tag"
          value={productTag}
          onChange={(event) => setProductTag(event.target.value)}
          helperText="Only products containing this tag will appear in the preview."
        />
        <Input
          label="Base Price"
          type="number"
          value={basePrice}
          onChange={(event) => setBasePrice(event.target.value)}
          adornment="dh"
          helperText="Optional override for a baseline calculation."
        />
        <Input
          label="Discount Offered"
          type="number"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
          adornment="%"
          helperText="Applies on top of calculated supplements."
        />
        <Input
          label="Compare At Price"
          type="number"
          value={compareAtPrice}
          onChange={(event) => setCompareAtPrice(event.target.value)}
          adornment="dh"
        />
      </div>
      <div className="pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Supplement overrides</h3>
        <p className="text-xs text-slate-500">Adjust chain-specific supplements (dh) for hand chains.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(supplements).map(([title, value]) => (
            <Input
              key={title}
              label={title}
              type="number"
              value={value}
              onChange={(event) => updateSupplement(title, Number(event.target.value))}
              adornment="dh"
            />
          ))}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={handlePreview} disabled={isBusy}>
          {t('action.preview')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isBusy}
          isLoading={isBusy && activeAction === 'metafields'}
          loadingText={t('action.aligningVariants')}
          onClick={() =>
            runAction('metafields', alignHandChainVariantsFromMetafields, 'Aligned variants from metafields')
          }
        >
          {t('action.alignVariants')}
        </Button>
        <Button
          type="button"
          isLoading={isBusy && activeAction === 'apply'}
          loadingText={t('action.applying')}
          onClick={() => runAction('apply', applyHandChains, 'Applied hand chain pricing')}
        >
          {t('action.apply')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          isLoading={isBusy && activeAction === 'backup'}
          loadingText={t('action.backingUp')}
          onClick={() => runAction('backup', () => backupScope('handchains'), 'Created hand chains backup')}
        >
          {t('action.backup')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          isLoading={isBusy && activeAction === 'restore'}
          loadingText={t('action.restoring')}
          onClick={() => runAction('restore', () => restoreScope('handchains'), 'Restored hand chains backup')}
        >
          {t('action.restoreBackup')}
        </Button>
      </div>
    </Card>
  );

  const previewSummaryCard = (
    <Card
      title="Products Preview"
      subtitle="Preview shows products matching the current configuration"
      actions={
        <Button variant="ghost" onClick={() => setActiveTab('preview')}>
          View full preview
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statPills.map((stat) => (
          <StatPill key={stat.label} {...stat} />
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {filteredPreviews.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Run a preview to populate this list. Filters and search will update results in real time.
          </p>
        ) : (
          filteredPreviews.map((preview) => <ProductPreviewRow key={preview?.product?.id} preview={preview} />)
        )}
      </div>
    </Card>
  );

  const activityCard = (
    <Card
      title="Activity Timeline"
      subtitle="Track who ran previews, applied updates, or restored backups"
      actions={
        <Select
          value={timelineRange}
          onChange={(event) => setTimelineRange(event.target.value)}
          options={[
            { label: 'Last 7 days', value: '7' },
            { label: 'Last 30 days', value: '30' },
            { label: 'Last 90 days', value: '90' },
          ]}
        />
      }
    >
      <div className="space-y-3">
        {overviewActivity.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No activity yet. Run a preview or apply pricing changes to populate history.
          </p>
        ) : (
          overviewActivity.map((entry) => <TimelineItem key={entry.id} entry={entry} />)
        )}
      </div>
    </Card>
  );

  const previewTab = (
    <Card
      title="Preview Details"
      subtitle="Review every product and variant calculation before applying changes"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statPills.map((stat) => (
          <StatPill key={stat.label} {...stat} />
        ))}
      </div>
      <div className="mt-4">
        <PreviewTable previews={filteredPreviews} />
      </div>
    </Card>
  );

  const applyTab = (
    <Card
      title="Apply Changes"
      subtitle="Confirm exports, backups, and updates before synchronizing with Shopify"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={handlePreview}
          disabled={isBusy}
        >
          Re-run preview
        </Button>
        <Button
          type="button"
          onClick={() => runAction('apply', applyHandChains, 'Applied hand chain pricing')}
          isLoading={isBusy && activeAction === 'apply'}
          loadingText={t('action.applying')}
        >
          Apply changes
        </Button>
        {previewStats.modified > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {previewStats.modified} pending
          </span>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => runAction('backup', () => backupScope('handchains'), 'Created hand chains backup')}
          isLoading={isBusy && activeAction === 'backup'}
          loadingText={t('action.backingUp')}
        >
          Export backup
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => runAction('restore', () => restoreScope('handchains'), 'Restored hand chains backup')}
          isLoading={isBusy && activeAction === 'restore'}
          loadingText={t('action.restoring')}
        >
          Import backup
        </Button>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Applying changes will update Shopify products and compare-at prices. Ensure your preview is up to date and
        that you have captured a backup before proceeding.
      </p>
    </Card>
  );

  const historyTab = (
    <Card
      title="Historical Activity"
      subtitle="Full audit trail of pricing updates across the workspace"
    >
      <div className="space-y-3">
        {timelineEntries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No activity recorded for the selected range.
          </p>
        ) : (
          timelineEntries.map((entry) => <TimelineItem key={entry.id} entry={entry} />)
        )}
      </div>
    </Card>
  );

  let mainContent;
  switch (activeTab) {
    case 'preview':
      mainContent = (
        <>
          {configurationCard}
          {previewTab}
        </>
      );
      break;
    case 'apply':
      mainContent = (
        <>
          {configurationCard}
          {applyTab}
        </>
      );
      break;
    case 'history':
      mainContent = (
        <>
          {activityCard}
          {historyTab}
        </>
      );
      break;
    default:
      mainContent = (
        <>
          {configurationCard}
          {previewSummaryCard}
          {activityCard}
        </>
      );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 sm:hidden">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={
                  `rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition duration-200 ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-100 text-indigo-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                  }`
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="hidden gap-2 sm:flex">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'primary' : 'secondary'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">{mainContent}</div>
        <aside className="space-y-6">
          <Card title="Quick Stats">
            <dl className="space-y-3">
              {quickStats.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm text-slate-600">
                  <dt className="font-medium text-slate-500">{item.label}</dt>
                  <dd className="font-semibold text-slate-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="Recent Changes">
            <div className="space-y-3 text-sm text-slate-600">
              {recentChanges.length === 0 ? (
                <p className="text-slate-500">No recent changes captured yet.</p>
              ) : (
                recentChanges.map((entry) => (
                  <div key={entry.id} className="flex flex-col gap-1">
                    <span className="font-semibold text-slate-900">{entry.description}</span>
                    <span className="text-xs text-slate-400">{formatTimestamp(entry.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
            <Button variant="ghost" className="mt-4" onClick={() => setActiveTab('history')}>
              View full history
            </Button>
          </Card>
          <Card title="Help & Resources">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <a className="text-indigo-600 hover:text-indigo-500" href="#support">
                  Hand chain pricing guide
                </a>
              </li>
              <li>
                <a className="text-indigo-600 hover:text-indigo-500" href="#shortcuts">
                  Keyboard shortcuts
                </a>
              </li>
              <li>
                <a className="text-indigo-600 hover:text-indigo-500" href="#backups">
                  Backup & restore documentation
                </a>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
