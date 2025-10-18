import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  braceletChainTypes,
  HAND_CHAIN_MULTIPLIER,
  necklaceChainTypes,
  necklaceSizes,
  ringBandSupplements,
  ringSizes,
} from '../data/supplements';
import { mockProducts } from '../data/products';
import { hasShopifyProxy } from '../config/shopify';
import { fetchActiveProducts, fetchProductsByCollections, pushVariantUpdates } from '../services/shopify';
import { syncSupplementsFile } from '../services/supplements';
import {
  captureScopeBackup,
  fetchScopeBackup,
  persistScopeBackup,
} from '../services/backups';
import {
  applyPercentage,
  applySupplementPercentage,
  buildBraceletVariants,
  buildHandChainVariants,
  buildNecklaceVariants,
  buildRingVariants,
  buildSetVariants,
  resolveNecklaceSupplement,
} from '../utils/pricing';
import {
  parseBandType,
  parseChainName,
  parseNecklaceSize,
  parseRingSize,
} from '../utils/variantParsers';
import { toast } from '../utils/toast';

const USERNAME_STORAGE_KEY = 'price-pilot.username';
const SUPPLEMENT_BACKUP_STORAGE_KEY = 'price-pilot.supplement-backups';
const SUPPLEMENTS_STORAGE_KEY = 'price-pilot.supplements';
const SECTION_BACKUP_STORAGE_KEY = 'price-pilot.section-backups';
const DEFAULT_NECKLACE_SIZE = necklaceSizes[0] ?? 41;

const SCOPE_COLLECTIONS = {
  global: [],
  bracelets: ['bracelet'],
  necklaces: ['collier'],
  rings: ['bague'],
  handchains: ['handchain'],
  sets: ['ensemble'],
  'azor-archive': [],
};

const BACKUP_SCOPES = Object.keys(SCOPE_COLLECTIONS);

const dispatchToastNotification = (level, message) => {
  switch (level) {
    case 'success':
      toast.success(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'warning':
      toast.warning(message);
      break;
    case 'info':
    default:
      toast.info(message);
      break;
  }
};

const loadStoredUsername = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(USERNAME_STORAGE_KEY);
    return stored ? stored : null;
  } catch (error) {
    console.warn('Failed to load stored username from sessionStorage:', error);
    return null;
  }
};

const persistUsername = (username) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (username) {
      window.sessionStorage.setItem(USERNAME_STORAGE_KEY, username);
    } else {
      window.sessionStorage.removeItem(USERNAME_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to persist username to sessionStorage:', error);
  }
};

const createEmptySupplementBackups = () => ({
  bracelets: null,
  necklaces: null,
});

const createDefaultSupplements = () => ({
  bracelets: { ...braceletChainTypes },
  necklaces: Object.fromEntries(
    Object.entries(necklaceChainTypes).map(([chainType, values]) => [
      chainType,
      {
        supplement: Number(values?.supplement) || 0,
        perCm: Number(values?.perCm) || 0,
        sizes: ensureBaseSizeOverride(
          sanitizeNecklaceSizeOverrides(values?.sizes),
          Number(values?.supplement) || 0,
        ),
      },
    ]),
  ),
  rings: Object.fromEntries(
    Object.entries(ringBandSupplements).map(([band, sizes]) => [
      band,
      { ...sizes },
    ]),
  ),
  handChains: Object.fromEntries(
    Object.entries(necklaceChainTypes).map(([title, data]) => [
      title,
      (Number(data?.supplement) || 0) * HAND_CHAIN_MULTIPLIER,
    ]),
  ),
});

const hasBackupProducts = (value) =>
  Array.isArray(value?.products) && value.products.length > 0;

const sanitizeBackupSnapshot = (value) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to sanitize supplement backup snapshot:', error);
    return null;
  }
};

const sanitizeBraceletSupplementMap = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([chainType]) =>
        Object.prototype.hasOwnProperty.call(braceletChainTypes, chainType),
      )
      .map(([chainType, supplement]) => {
        const numeric = Number(supplement);
        return Number.isFinite(numeric) ? [chainType, numeric] : null;
      })
      .filter(Boolean),
  );
};

const sanitizeNecklaceSizeOverrides = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const allowedSizes = new Set(necklaceSizes);

  return Object.fromEntries(
    Object.entries(value)
      .map(([rawSize, rawValue]) => {
        const size = Number(rawSize);
        if (!Number.isFinite(size) || !allowedSizes.has(size)) {
          return null;
        }

        const numeric = Number(rawValue);
        if (!Number.isFinite(numeric)) {
          return null;
        }

        return [size, numeric];
      })
      .filter(Boolean),
  );
};

const ensureBaseSizeOverride = (sizes, fallbackSupplement = 0) => {
  const normalized = { ...(sizes ?? {}) };
  const fallback = Number.isFinite(fallbackSupplement) ? fallbackSupplement : 0;

  const baseEntry = Number(normalized[DEFAULT_NECKLACE_SIZE]);
  if (Number.isFinite(baseEntry)) {
    normalized[DEFAULT_NECKLACE_SIZE] = baseEntry;
  } else {
    normalized[DEFAULT_NECKLACE_SIZE] = fallback;
  }

  return normalized;
};

const loadStoredSectionBackups = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(SECTION_BACKUP_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const normalized = {};
    for (const [scope, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const snapshot = {
        timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : null,
        collections: Array.isArray(entry.collections)
          ? entry.collections.map((value) => String(value)).filter(Boolean)
          : [],
        products: Array.isArray(entry.products) ? entry.products : [],
        percent: Number.isFinite(Number(entry.percent)) ? Number(entry.percent) : null,
        rounding: typeof entry.rounding === 'string' ? entry.rounding : null,
      };

      normalized[scope] = snapshot;
    }

    return normalized;
  } catch (error) {
    console.warn('Failed to load section backups from localStorage:', error);
    return {};
  }
};

const persistSectionBackups = (backups) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload = JSON.stringify(backups ?? {});
    window.localStorage.setItem(SECTION_BACKUP_STORAGE_KEY, payload);
  } catch (error) {
    console.warn('Failed to persist section backups to localStorage:', error);
  }
};

const mergeNecklaceSizeOverrides = (baseSizes, overrideSizes, fallbackSupplement = 0) => {
  const merged = {
    ...(baseSizes ?? {}),
    ...(overrideSizes ?? {}),
  };

  return ensureBaseSizeOverride(merged, fallbackSupplement);
};

const resolveStoredNecklaceSupplement = (entry, size) => {
  if (!entry || typeof entry !== 'object') {
    return 0;
  }

  const normalizedSize = Number.isFinite(size) ? size : DEFAULT_NECKLACE_SIZE;
  const sizes = entry.sizes;
  if (sizes && typeof sizes === 'object') {
    const direct = sizes[normalizedSize] ?? sizes[String(normalizedSize)];
    const numeric = Number(direct);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  const baseSupplementRaw = Number(entry?.supplement);
  const perCmRaw = Number(entry?.perCm);
  const baseSupplement = Number.isFinite(baseSupplementRaw) ? baseSupplementRaw : 0;
  const perCm = Number.isFinite(perCmRaw) ? perCmRaw : 0;

  return baseSupplement + (normalizedSize - DEFAULT_NECKLACE_SIZE) * perCm;
};

const sanitizeNecklaceSupplementMap = (value) => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([chainType]) =>
        Object.prototype.hasOwnProperty.call(necklaceChainTypes, chainType),
      )
      .map(([chainType, values]) => {
        if (!values || typeof values !== 'object') {
          return null;
        }

        const supplement = Number(values.supplement);
        const perCm = Number(values.perCm);
        const sizes = sanitizeNecklaceSizeOverrides(values.sizes);
        const hasSupplement = Number.isFinite(supplement);
        const hasPerCm = Number.isFinite(perCm);

        if (!hasSupplement && !hasPerCm && Object.keys(sizes).length === 0) {
          return null;
        }

        const sanitized = {};
        if (hasSupplement) {
          sanitized.supplement = supplement;
        }
        if (hasPerCm) {
          sanitized.perCm = perCm;
        }
        if (Object.keys(sizes).length > 0) {
          sanitized.sizes = ensureBaseSizeOverride(
            sizes,
            hasSupplement ? supplement : 0,
          );
        }

        return [chainType, sanitized];
      })
      .filter(Boolean),
  );
};

const loadStoredSupplementBackups = () => {
  if (typeof window === 'undefined') {
    return createEmptySupplementBackups();
  }

  try {
    const stored = window.localStorage.getItem(SUPPLEMENT_BACKUP_STORAGE_KEY);
    if (!stored) {
      return createEmptySupplementBackups();
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return createEmptySupplementBackups();
    }

    return {
      bracelets: sanitizeBackupSnapshot(parsed.bracelets),
      necklaces: sanitizeBackupSnapshot(parsed.necklaces),
    };
  } catch (error) {
    console.warn('Failed to load stored supplement backups from localStorage:', error);
    return createEmptySupplementBackups();
  }
};

const persistSupplementBackups = (backups) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!backups) {
      window.localStorage.removeItem(SUPPLEMENT_BACKUP_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      SUPPLEMENT_BACKUP_STORAGE_KEY,
      JSON.stringify({
        bracelets: sanitizeBackupSnapshot(backups.bracelets),
        necklaces: sanitizeBackupSnapshot(backups.necklaces),
      }),
    );
  } catch (error) {
    console.warn('Failed to persist supplement backups to localStorage:', error);
  }
};

const persistSupplements = async (supplements) => {
  const bracelets = sanitizeBraceletSupplementMap(supplements?.bracelets);
  const necklaces = sanitizeNecklaceSupplementMap(supplements?.necklaces);

  let localSuccess = true;

  if (typeof window !== 'undefined') {
    try {
      if (Object.keys(bracelets).length === 0 && Object.keys(necklaces).length === 0) {
        window.localStorage.removeItem(SUPPLEMENTS_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SUPPLEMENTS_STORAGE_KEY,
          JSON.stringify({ bracelets, necklaces }),
        );
      }
    } catch (error) {
      localSuccess = false;
      console.warn('Failed to persist supplements to localStorage:', error);
    }
  }

  let remoteSuccess = true;
  if (hasShopifyProxy()) {
    const response = await syncSupplementsFile({ bracelets, necklaces });
    remoteSuccess = Boolean(response);

    if (!remoteSuccess) {
      console.warn('Failed to persist supplements via Shopify proxy.');
    }
  }

  return {
    bracelets,
    necklaces,
    success: localSuccess && remoteSuccess,
    localSuccess,
    remoteSuccess,
  };
};

const createSupplementChangeFlags = () => ({
  bracelets: false,
  necklaces: false,
});

const markSupplementScopeDirty = (flags, scope) => ({
  ...flags,
  [scope]: true,
});

const loadStoredSupplements = () => {
  const supplements = createDefaultSupplements();

  if (typeof window === 'undefined') {
    return supplements;
  }

  try {
    const stored = window.localStorage.getItem(SUPPLEMENTS_STORAGE_KEY);
    if (!stored) {
      return supplements;
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return supplements;
    }

    const bracelets = sanitizeBraceletSupplementMap(parsed.bracelets);
    for (const [chainType, supplement] of Object.entries(bracelets)) {
      supplements.bracelets[chainType] = supplement;
    }

    const necklaces = sanitizeNecklaceSupplementMap(parsed.necklaces);
    for (const [chainType, values] of Object.entries(necklaces)) {
      const fallbackSupplement = Number(supplements.necklaces?.[chainType]?.supplement) || 0;
      const fallbackPerCm = Number(supplements.necklaces?.[chainType]?.perCm) || 0;
      const fallbackSizes = ensureBaseSizeOverride(
        supplements.necklaces?.[chainType]?.sizes,
        fallbackSupplement,
      );
      const sanitizedSizes = sanitizeNecklaceSizeOverrides(values.sizes);
      const mergedSizes = mergeNecklaceSizeOverrides(
        fallbackSizes,
        sanitizedSizes,
        fallbackSupplement,
      );

      supplements.necklaces[chainType] = {
        supplement: Number.isFinite(values.supplement)
          ? values.supplement
          : fallbackSupplement,
        perCm: Number.isFinite(values.perCm) ? values.perCm : fallbackPerCm,
        sizes: mergedSizes,
      };
    }
  } catch (error) {
    console.warn('Failed to load stored supplements from localStorage:', error);
  }

  supplements.handChains = Object.fromEntries(
    Object.entries(supplements.necklaces).map(([chainType, values]) => [
      chainType,
      (Number(values?.supplement) || 0) * HAND_CHAIN_MULTIPLIER,
    ]),
  );

  return supplements;
};

const cloneVariant = (variant) => ({ ...variant });

const cloneProduct = (product) => ({
  ...product,
  variants: Array.isArray(product?.variants)
    ? product.variants.map((variant) => cloneVariant({ ...variant }))
    : [],
  metafields:
    product && typeof product.metafields === 'object'
      ? { ...product.metafields }
      : {},
});

const cloneProducts = (products = []) => products.map((product) => cloneProduct(product));

const buildCollectionSet = (scope) => {
  const collections = SCOPE_COLLECTIONS[scope] ?? [];
  return new Set(collections.map((collection) => collection.toLowerCase()));
};

const normalizeCollectionList = (collections) => {
  if (!collections) {
    return [];
  }

  const array = Array.isArray(collections) ? collections : [collections];
  return array
    .map((entry) => (entry === null || entry === undefined ? '' : String(entry).trim().toLowerCase()))
    .filter(Boolean);
};

const productMatchesCollections = (product, collectionSet) => {
  if (!(collectionSet instanceof Set) || collectionSet.size === 0) {
    return true;
  }

  const key = typeof product?.collection === 'string' ? product.collection.toLowerCase() : '';
  return collectionSet.has(key);
};

const captureProductsForCollections = (products, collections) => {
  const normalized = normalizeCollectionList(collections);
  if (normalized.length === 0) {
    return cloneProducts(products);
  }

  const collectionSet = new Set(normalized);
  return cloneProducts(
    (Array.isArray(products) ? products : []).filter((product) =>
      productMatchesCollections(product, collectionSet),
    ),
  );
};

const summarizeProductForPreview = (product) => ({
  id: product?.id ? String(product.id) : '',
  title: product?.title ?? '',
  handle: product?.handle ?? null,
  collection: product?.collection ?? null,
  basePrice: Number(product?.basePrice ?? 0),
  baseCompareAtPrice: Number(
    product?.baseCompareAtPrice ?? product?.basePrice ?? 0,
  ),
});

const deriveVariantChange = (variant, basePrice, baseCompare, adjustment, rounding) => {
  const currentPrice = Number(variant?.price ?? basePrice);
  const currentCompare = Number(variant?.compareAtPrice ?? baseCompare);
  const nextPrice = applyPercentage(currentPrice, adjustment, { rounding });
  const nextCompare = applyPercentage(currentCompare, adjustment, { rounding });

  const priceChanged = Number.isFinite(currentPrice) ? nextPrice !== currentPrice : false;
  const compareChanged = Number.isFinite(currentCompare)
    ? nextCompare !== currentCompare
    : false;

  let changeType = null;
  if (priceChanged && compareChanged) {
    changeType = 'price-compare';
  } else if (priceChanged) {
    changeType = 'price';
  } else if (compareChanged) {
    changeType = 'compare';
  }

  return {
    previousPrice: currentPrice,
    previousCompareAtPrice: currentCompare,
    nextPrice,
    nextCompare,
    changeType,
    changed: Boolean(changeType),
  };
};

const buildPercentagePreviewEntry = (product, adjustment, rounding) => {
  const basePrice = Number(product?.basePrice ?? 0);
  const baseCompare = Number(product?.baseCompareAtPrice ?? product?.basePrice ?? 0);
  const updatedBasePrice = applyPercentage(basePrice, adjustment, { rounding });
  const updatedCompareAtPrice = applyPercentage(baseCompare, adjustment, { rounding });

  const variants = (Array.isArray(product?.variants) ? product.variants : []).map((variant) => {
    const variantId = variant?.id ? String(variant.id) : `${product?.id ?? 'product'}-${variant?.title ?? 'variant'}`;
    const change = deriveVariantChange(variant, basePrice, baseCompare, adjustment, rounding);

    return {
      id: variantId,
      title: variant?.title ?? 'Variant',
      price: change.nextPrice,
      compareAtPrice: change.nextCompare,
      previousPrice: change.previousPrice,
      previousCompareAtPrice: change.previousCompareAtPrice,
      status: change.changed ? 'changed' : 'unchanged',
      changeType: change.changeType,
    };
  });

  return {
    product: summarizeProductForPreview(product),
    updatedBasePrice,
    updatedCompareAtPrice,
    variants,
  };
};

const mergeProductsFromBackup = (currentProducts = [], snapshotProducts = []) => {
  const snapshotById = new Map(
    snapshotProducts.map((product) => [product?.id ? String(product.id) : null, cloneProduct(product)]),
  );
  snapshotById.delete(null);

  const restoredIds = new Set();

  const merged = currentProducts.map((product) => {
    const productId = product?.id ? String(product.id) : null;
    if (!productId || !snapshotById.has(productId)) {
      return product;
    }

    restoredIds.add(productId);
    return cloneProduct(snapshotById.get(productId));
  });

  for (const [productId, product] of snapshotById.entries()) {
    if (!restoredIds.has(productId)) {
      merged.push(cloneProduct(product));
    }
  }

  return merged;
};

const mergeProductsForScope = (currentProducts, remoteProducts, collectionSet) => {
  const remoteClones = cloneProducts(remoteProducts);

  if (!(collectionSet instanceof Set) || collectionSet.size === 0) {
    return remoteClones;
  }

  const remoteById = new Map(remoteClones.map((product) => [product.id, product]));
  const synchronizedIds = new Set();

  const merged = currentProducts.map((product) => {
    const collectionKey =
      typeof product.collection === 'string' ? product.collection.toLowerCase() : '';

    if (!collectionSet.has(collectionKey)) {
      return cloneProduct(product);
    }

    const remote = remoteById.get(product.id);
    if (remote) {
      synchronizedIds.add(product.id);
      return remote;
    }

    return cloneProduct(product);
  });

  for (const [productId, remote] of remoteById.entries()) {
    if (!synchronizedIds.has(productId)) {
      merged.push(remote);
    }
  }

  return merged;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveVariantPrice = (variant, product) => {
  const basePrice = toNumberOrNull(product?.basePrice) ?? 0;
  return toNumberOrNull(variant?.price) ?? basePrice;
};

const resolveVariantCompareAt = (variant, product) => {
  const fallbackPrice = resolveVariantPrice(variant, product);
  const variantCompare = toNumberOrNull(variant?.compareAtPrice);
  if (variantCompare !== null) {
    return variantCompare;
  }

  const productCompare = toNumberOrNull(product?.baseCompareAtPrice);
  if (productCompare !== null) {
    return productCompare;
  }

  return fallbackPrice;
};

const hasMeaningfulDelta = (previous, next, tolerance = 0.01) => {
  const prevNum = toNumberOrNull(previous);
  const nextNum = toNumberOrNull(next);

  if (prevNum === null && nextNum === null) {
    return false;
  }

  if (prevNum === null || nextNum === null) {
    return true;
  }

  return Math.abs(prevNum - nextNum) > tolerance;
};

const buildRingKey = (band, size) => {
  if (!band || !size) {
    return null;
  }

  return `${band.toLowerCase()}::${size.toUpperCase()}`;
};

const sanitizeVariantKey = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  return normalized ? normalized : null;
};

const hasDigits = (value) => /[0-9]/.test(String(value));

const UNIQUE_CHAIN_NAMES = Array.from(
  new Set([...Object.keys(braceletChainTypes), ...Object.keys(necklaceChainTypes)]),
);

const CHAIN_LOOKUP = new Map(
  UNIQUE_CHAIN_NAMES.map((name) => [sanitizeVariantKey(name), name]),
);

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildChainRemovalPatterns = (lookup) => {
  const patterns = [];
  const seen = new Set();

  for (const name of lookup.values()) {
    if (!name) {
      continue;
    }

    const basePattern = escapeRegExp(name);
    if (!seen.has(basePattern)) {
      patterns.push(new RegExp(basePattern, 'ig'));
      seen.add(basePattern);
    }

    const collapsed = name.replace(/\s+/g, '');
    if (collapsed && collapsed !== name) {
      const collapsedPattern = escapeRegExp(collapsed);
      if (!seen.has(collapsedPattern)) {
        patterns.push(new RegExp(collapsedPattern, 'ig'));
        seen.add(collapsedPattern);
      }
    }
  }

  return patterns;
};

const BRACELET_CHAIN_KEYS = Array.from(CHAIN_LOOKUP.keys());
const BRACELET_CHAIN_REMOVAL_PATTERNS = buildChainRemovalPatterns(CHAIN_LOOKUP);

const stripBraceletChainFragments = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  let working = String(value);
  for (const pattern of BRACELET_CHAIN_REMOVAL_PATTERNS) {
    working = working.replace(pattern, ' ');
  }

  return working.replace(/[(){}\[\]]/g, ' ').replace(/[\-_/•]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const RING_BAND_NAMES = Object.keys(ringBandSupplements);

const RING_BAND_LOOKUP = new Map(
  RING_BAND_NAMES.map((name) => [sanitizeVariantKey(name), name]),
);

const CHAIN_NAME_CACHE = new Map();
const NECKLACE_SIZE_CACHE = new Map();
const RING_BAND_CACHE = new Map();
const RING_SIZE_CACHE = new Map();
const NECKLACE_GROUP_CACHE = new Map();

const canonicalChainName = (value, contextLabel = 'chain types') => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (CHAIN_NAME_CACHE.has(raw)) {
    return CHAIN_NAME_CACHE.get(raw);
  }

  const parsed = parseChainName(raw);
  const normalized = parsed ? sanitizeVariantKey(parsed) : null;
  let canonical = normalized ? CHAIN_LOOKUP.get(normalized) : null;

  if (!canonical && normalized) {
    for (const [candidateKey, candidateValue] of CHAIN_LOOKUP.entries()) {
      if (normalized.startsWith(candidateKey)) {
        canonical = candidateValue;
        break;
      }
    }
  }

  if (!canonical && normalized) {
    for (const [candidateKey, candidateValue] of CHAIN_LOOKUP.entries()) {
      if (candidateKey.length < 3) {
        continue;
      }

      if (normalized.includes(candidateKey)) {
        canonical = candidateValue;
        break;
      }
    }
  }

  if (!canonical) {
    console.warn(
      `Chain option "${raw}" doesn't match expected ${contextLabel}:`,
      UNIQUE_CHAIN_NAMES,
    );
  }

  CHAIN_NAME_CACHE.set(raw, canonical ?? null);
  return canonical ?? null;
};

const canonicalNecklaceSize = (value, contextLabel = 'necklace') => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (NECKLACE_SIZE_CACHE.has(raw)) {
    return NECKLACE_SIZE_CACHE.get(raw);
  }

  if (!/[0-9]/.test(raw)) {
    NECKLACE_SIZE_CACHE.set(raw, null);
    return null;
  }

  const parsed = parseNecklaceSize(raw);
  let canonical = Number.isFinite(parsed) && necklaceSizes.includes(parsed) ? parsed : null;

  if (!canonical) {
    const numericMatches = raw.match(/\d+/g);
    if (Array.isArray(numericMatches)) {
      for (const candidate of numericMatches) {
        const parsedCandidate = Number.parseInt(candidate, 10);
        if (Number.isFinite(parsedCandidate) && necklaceSizes.includes(parsedCandidate)) {
          canonical = parsedCandidate;
          break;
        }
      }
    }
  }

  if (!canonical) {
    console.warn(
      `${contextLabel} size "${raw}" doesn't match expected format or values:`,
      necklaceSizes,
    );
  }

  NECKLACE_SIZE_CACHE.set(raw, canonical ?? null);
  return canonical ?? null;
};

const canonicalRingBand = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (RING_BAND_CACHE.has(raw)) {
    return RING_BAND_CACHE.get(raw);
  }

  const parsed = parseBandType(raw);
  const normalized = parsed ? sanitizeVariantKey(parsed) : null;
  const canonical = normalized ? RING_BAND_LOOKUP.get(normalized) : null;

  if (!canonical) {
    console.warn(
      `Ring band "${raw}" doesn't match expected format or values:`,
      RING_BAND_NAMES,
    );
  }

  RING_BAND_CACHE.set(raw, canonical ?? null);
  return canonical ?? null;
};

const canonicalRingSize = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (RING_SIZE_CACHE.has(raw)) {
    return RING_SIZE_CACHE.get(raw);
  }

  const parsed = parseRingSize(raw);
  const canonical = parsed && ringSizes.includes(parsed) ? parsed : null;

  if (!canonical) {
    console.warn(
      `Ring size "${raw}" doesn't match expected format or values:`,
      ringSizes,
    );
  }

  RING_SIZE_CACHE.set(raw, canonical ?? null);
  return canonical ?? null;
};

const commitShopifyVariantUpdates = async ({
  scope,
  collection,
  updatedProducts,
  updatesByProduct,
  originalVariantLookup,
  noChangesMessage,
  successLogMessage,
  updateLabel,
  failureLogMessage,
  set,
  get,
}) => {
  const updatesPayload = Array.from(updatesByProduct.values());
  const proxyMissingMessage = `Shopify proxy missing; unable to push ${updateLabel} changes. Start the proxy server and try again.`;
  const normalizedCollections = Array.isArray(collection)
    ? collection.filter(Boolean)
    : collection
    ? [collection]
    : [];
  const collectionSet =
    normalizedCollections.length > 0
      ? new Set(normalizedCollections.map((entry) => entry.toLowerCase()))
      : null;

  if (!hasShopifyProxy()) {
    get().log(proxyMissingMessage, scope, 'error');
    return { success: false, reason: 'missing-proxy' };
  }

  if (updatesPayload.length === 0) {
    set({ products: updatedProducts });
    if (noChangesMessage) {
      get().log(noChangesMessage, scope, 'silent');
    }
    return { success: true, updatedCount: 0, failedCount: 0 };
  }

  try {
    const result = await pushVariantUpdates(updatesPayload);

    const failedVariantIds = new Set(
      Array.isArray(result?.failures)
        ? result.failures
            .map((failure) => (failure?.variantId ? String(failure.variantId) : ''))
            .filter(Boolean)
        : [],
    );

    const finalProducts = updatedProducts.map((product) => {
      if (!collectionSet || failedVariantIds.size === 0) {
        return product;
      }

      const productCollection =
        typeof product.collection === 'string' ? product.collection.toLowerCase() : '';
      if (!collectionSet.has(productCollection)) {
        return product;
      }

      const nextVariants = product.variants.map((variant) => {
        const variantId = String(variant?.id ?? '');
        if (!variantId || !failedVariantIds.has(variantId)) {
          return variant;
        }

        const original = originalVariantLookup.get(variantId);
        return original ? { ...original } : variant;
      });

      return { ...product, variants: nextVariants };
    });

    set({ products: finalProducts });

    const failedCount = Number.isFinite(result?.failedCount)
      ? result.failedCount
      : Array.isArray(result?.failures)
      ? result.failures.length
      : 0;
    const failures = Array.isArray(result?.failures) ? result.failures : [];
    const updatedCount = Number.isFinite(result?.updatedCount) ? result.updatedCount : 0;

    if (failedCount > 0) {
      get().log(
        `Updated ${updatedCount} Shopify ${updateLabel} variants with ${failedCount} failures.`,
        scope,
        'warning',
      );
      for (const failure of failures) {
        get().log(
          `Failed to update variant ${failure.variantId} for ${failure.productTitle}: ${failure.reason}`,
          scope,
          'silent',
        );
      }
    } else if (updatedCount > 0) {
      get().log(`Updated ${updatedCount} Shopify ${updateLabel} variants.`, scope, 'success');
    }

    if (updatedCount > 0 && failedCount === 0) {
      get().log(successLogMessage, scope, 'success');
    }

    return {
      success: failedCount === 0,
      updatedCount,
      failedCount,
      failures,
    };
  } catch (error) {
    console.error(failureLogMessage, error);
    get().log(failureLogMessage, scope, 'error');
    return { success: false, reason: 'request-failed', error };
  }
};

const splitVariantDescriptor = (value) => {
  if (!value) {
    return [];
  }

  return String(value)
    .split(/[\/•|\-–]/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const collectVariantParts = (variant) => {
  const parts = [];

  if (Array.isArray(variant?.options) && variant.options.length > 0) {
    parts.push(...variant.options);
  }

  if (typeof variant?.title === 'string' && variant.title.trim()) {
    parts.push(...splitVariantDescriptor(variant.title));
  }

  return parts;
};

const arraysEqual = (a, b) => {
  if (a === b) {
    return true;
  }

  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
};

const toCamelCase = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+([a-z0-9])/g, (_, group) => group.toUpperCase());

const buildMetafieldKeyVariants = (key) => {
  const base = String(key ?? '').trim();
  if (!base) {
    return [];
  }

  const lower = base.toLowerCase();
  const slug = lower.replace(/[^a-z0-9]+/g, '_');
  const hyphen = lower.replace(/[^a-z0-9]+/g, '-');
  const condensed = lower.replace(/[^a-z0-9]+/g, '');
  const camel = toCamelCase(base);
  const pascal = camel ? camel.charAt(0).toUpperCase() + camel.slice(1) : '';
  const preserveCaseSlug = base.replace(/[^a-zA-Z0-9]+/g, '_');
  const preserveCaseHyphen = base.replace(/[^a-zA-Z0-9]+/g, '-');
  const preserveCaseCondensed = base.replace(/[^a-zA-Z0-9]+/g, '');

  return Array.from(
    new Set([
      base,
      lower,
      slug,
      hyphen,
      condensed,
      camel,
      pascal,
      preserveCaseSlug,
      preserveCaseHyphen,
      preserveCaseCondensed,
    ]),
  ).filter(Boolean);
};

const readMetafieldValue = (product, key) => {
  if (!product || typeof product !== 'object') {
    return undefined;
  }

  const { metafields } = product;
  if (!metafields || typeof metafields !== 'object') {
    return undefined;
  }

  const candidates = buildMetafieldKeyVariants(key);
  for (const candidate of candidates) {
    if (
      candidate &&
      Object.prototype.hasOwnProperty.call(metafields, candidate) &&
      metafields[candidate] !== undefined
    ) {
      return metafields[candidate];
    }
  }

  return undefined;
};

const normalizeMetafieldValues = (raw) => {
  if (raw === null || raw === undefined) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => normalizeMetafieldValues(entry));
  }

  if (typeof raw === 'object') {
    if ('value' in raw) {
      return normalizeMetafieldValues(raw.value);
    }
    if (Array.isArray(raw.values)) {
      return normalizeMetafieldValues(raw.values);
    }
    if (Array.isArray(raw.nodes)) {
      return normalizeMetafieldValues(raw.nodes);
    }

    return [];
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeMetafieldValues(parsed);
        }
      } catch (error) {
        console.warn('Failed to parse metafield JSON value', error);
      }
    }

    return trimmed
      .split(/[\n,;|/]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const coerced = String(raw).trim();
  return coerced ? [coerced] : [];
};

const buildMetafieldDisplayMap = (product, key, canonicalize, formatDisplay) => {
  const rawValue = readMetafieldValue(product, key);
  if (rawValue === undefined) {
    return new Map();
  }

  const values = normalizeMetafieldValues(rawValue);
  const displayMap = new Map();

  for (const value of values) {
    const canonical = canonicalize(value);
    if (!canonical) {
      continue;
    }

    const displayCandidate = formatDisplay ? formatDisplay(value, canonical) : value;
    const display = String(displayCandidate ?? '').trim() || String(canonical);

    if (!displayMap.has(canonical)) {
      displayMap.set(canonical, display);
    }
  }

  return displayMap;
};

const formatNecklaceSizeDisplay = (raw, canonical) => {
  const normalized = String(raw ?? '').trim();
  if (!normalized) {
    return `${canonical}cm`;
  }

  if (/cm$/i.test(normalized)) {
    return normalized;
  }

  if (/^[0-9]+$/.test(normalized)) {
    return `${normalized}cm`;
  }

  return normalized;
};

const formatRingSizeDisplay = (raw, canonical) => {
  const normalized = String(raw ?? '').trim();
  if (!normalized) {
    return canonical;
  }

  return normalized.toUpperCase();
};

const buildChainMetafieldMap = (product, key, contextLabel) =>
  buildMetafieldDisplayMap(
    product,
    key,
    (value) => canonicalChainName(value, contextLabel ?? 'metafield chain options'),
    (raw, canonical) => {
      const normalized = String(raw ?? '').trim();
      return normalized || canonical;
    },
  );

const buildNecklaceSizeMetafieldMap = (product, key, contextLabel) =>
  buildMetafieldDisplayMap(
    product,
    key,
    (value) => canonicalNecklaceSize(value, contextLabel ?? 'metafield necklace size'),
    (raw, canonical) => formatNecklaceSizeDisplay(raw, canonical),
  );

const buildRingBandMetafieldMap = (product, key) =>
  buildMetafieldDisplayMap(
    product,
    key,
    (value) => canonicalRingBand(value),
    (raw, canonical) => {
      const normalized = String(raw ?? '').trim();
      return normalized || canonical;
    },
  );

const buildRingSizeMetafieldMap = (product, key) =>
  buildMetafieldDisplayMap(
    product,
    key,
    (value) => canonicalRingSize(value),
    (raw, canonical) => formatRingSizeDisplay(raw, canonical),
  );

const deriveRingIdentity = (variant) => {
  if (!variant || typeof variant !== 'object') {
    return { key: null, band: null, size: null };
  }

  let band = null;
  let size = null;

  if (variant.band) {
    band = canonicalRingBand(variant.band) ?? band;
  }

  if (variant.size) {
    size = canonicalRingSize(variant.size) ?? size;
  }

  const candidateGroups = [];

  if (Array.isArray(variant.options) && variant.options.length > 0) {
    candidateGroups.push(variant.options);
  }

  if (typeof variant.title === 'string' && variant.title.trim()) {
    candidateGroups.push(splitVariantDescriptor(variant.title));
  }

  for (const parts of candidateGroups) {
    if (!Array.isArray(parts) || parts.length === 0) {
      continue;
    }

    for (const part of parts) {
      const fragment = String(part).trim();
      if (!fragment) {
        continue;
      }

      if (!band && !hasDigits(fragment)) {
        const parsedBand = canonicalRingBand(fragment);
        if (parsedBand) {
          band = parsedBand;
          continue;
        }
      }

      if (!size) {
        const parsedSize = canonicalRingSize(fragment);
        if (parsedSize) {
          size = parsedSize;
          if (band) {
            break;
          }
          continue;
        }
      }

      if (!band && !hasDigits(fragment)) {
        const parsedBand = canonicalRingBand(fragment);
        if (parsedBand) {
          band = parsedBand;
        }
      }
    }

    if (band && size) {
      break;
    }
  }

  if (band && size) {
    return { key: buildRingKey(band, size), band, size };
  }

  return { key: null, band, size };
};

const buildChainSizeKey = (chain, size, groupKey = null) => {
  if (!chain || !Number.isFinite(size)) {
    return null;
  }

  if (!groupKey) {
    return `${chain}::${size}`;
  }

  return `${groupKey}::${chain}::${size}`;
};

const canonicalNecklaceGroup = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (NECKLACE_GROUP_CACHE.has(raw)) {
    return NECKLACE_GROUP_CACHE.get(raw);
  }

  const normalized = sanitizeVariantKey(raw);
  if (!normalized) {
    NECKLACE_GROUP_CACHE.set(raw, null);
    return null;
  }

  if (CHAIN_LOOKUP.has(normalized)) {
    NECKLACE_GROUP_CACHE.set(raw, null);
    return null;
  }

  const parsedSize = parseNecklaceSize(raw);
  if (Number.isFinite(parsedSize) && necklaceSizes.includes(parsedSize)) {
    NECKLACE_GROUP_CACHE.set(raw, null);
    return null;
  }

  const result = { key: normalized, label: raw };
  NECKLACE_GROUP_CACHE.set(raw, result);
  return result;
};

const deriveBraceletKey = (variant, contextLabel = 'bracelet chain options') => {
  if (!variant || typeof variant !== 'object') {
    return null;
  }

  if (variant.chainType) {
    const canonical = canonicalChainName(variant.chainType, contextLabel);
    if (canonical) {
      return canonical;
    }
  }

  for (const part of collectVariantParts(variant)) {
    const fragment = String(part).trim();
    if (!fragment || hasDigits(fragment)) {
      continue;
    }

    const canonical = canonicalChainName(fragment, contextLabel);
    if (canonical) {
      return canonical;
    }
  }

  return null;
};

const normalizeBraceletParentCandidate = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const cleaned = stripBraceletChainFragments(raw);
  if (!cleaned) {
    return null;
  }

  const lower = cleaned.toLowerCase();
  if (lower === 'default' || lower === 'default title' || lower === 'defaulttitle') {
    return null;
  }

  if (/\b(cm|centim|millim|mm)\b/.test(lower)) {
    return null;
  }

  const sanitized = sanitizeVariantKey(cleaned);
  if (!sanitized) {
    return null;
  }

  let remainder = sanitized;
  for (const chainKey of BRACELET_CHAIN_KEYS) {
    if (!chainKey) {
      continue;
    }
    remainder = remainder.split(chainKey).join('');
  }

  if (!remainder) {
    return null;
  }

  return { label: cleaned, key: remainder };
};

const deriveBraceletVariantSignature = (variant, contextLabel = 'bracelet chain options') => {
  if (!variant || typeof variant !== 'object') {
    return {
      key: null,
      chain: null,
      chainKey: null,
      parentKey: null,
      parentLabel: null,
      parentValues: [],
    };
  }

  let chain = null;
  const parentValues = [];
  const parentKeyParts = [];

  for (const part of collectVariantParts(variant)) {
    const canonical = canonicalChainName(part, contextLabel);
    if (canonical && !chain) {
      chain = canonical;
    }

    const normalizedParent = normalizeBraceletParentCandidate(part);
    if (!normalizedParent) {
      continue;
    }

    if (parentKeyParts.includes(normalizedParent.key)) {
      continue;
    }

    parentKeyParts.push(normalizedParent.key);
    parentValues.push(normalizedParent.label);
  }

  const chainKey = chain ? sanitizeVariantKey(chain) : null;
  const parentKey = parentKeyParts.length > 0 ? parentKeyParts.join('::') : null;
  const key = chainKey ? (parentKey ? `${parentKey}::${chainKey}` : chainKey) : null;

  return {
    key,
    chain,
    chainKey,
    parentKey,
    parentLabel: parentValues.length > 0 ? parentValues.join(' • ') : null,
    parentValues,
  };
};

const deriveHandChainKey = (variant) =>
  deriveBraceletKey(variant, 'hand chain options');

const deriveNecklaceSignature = (variant, contextLabel = 'necklace') => {
  if (!variant || typeof variant !== 'object') {
    return { key: null, chain: null, size: null, groupKey: null, groupLabel: null };
  }

  let chain = null;
  let size = null;
  let groupKey = null;
  let groupLabel = null;

  const registerGroupCandidate = (value) => {
    const candidate = canonicalNecklaceGroup(value);
    if (!candidate) {
      return;
    }

    if (!groupKey) {
      groupKey = candidate.key;
    }

    if (!groupLabel) {
      groupLabel = candidate.label;
    }
  };

  if (variant.groupKey) {
    const sanitized = sanitizeVariantKey(variant.groupKey);
    if (sanitized) {
      groupKey = sanitized;
    }
  }

  if (variant.groupLabel) {
    registerGroupCandidate(variant.groupLabel);
  }

  if (!groupLabel && typeof variant.group === 'string') {
    registerGroupCandidate(variant.group);
  }

  if (Array.isArray(variant.options)) {
    for (const option of variant.options) {
      registerGroupCandidate(option);
      if (groupKey && groupLabel) {
        break;
      }
    }
  }

  if (variant.chainType) {
    chain = canonicalChainName(variant.chainType, `${contextLabel} chain options`) ?? chain;
  }

  if (Number.isFinite(variant.size)) {
    if (necklaceSizes.includes(variant.size)) {
      size = variant.size;
    } else {
      console.warn(
        `${contextLabel} size "${variant.size}" doesn't match expected format or values:`,
        necklaceSizes,
      );
    }
  } else if (variant.size) {
    size = canonicalNecklaceSize(variant.size, contextLabel) ?? size;
  }

  for (const part of collectVariantParts(variant)) {
    const fragment = String(part).trim();
    if (!fragment) {
      continue;
    }

    if (!size) {
      const parsedSize = canonicalNecklaceSize(fragment, contextLabel);
      if (Number.isFinite(parsedSize)) {
        size = parsedSize;
        continue;
      }
    }

    if (!chain && !hasDigits(fragment)) {
      const parsedChain = canonicalChainName(fragment, `${contextLabel} chain options`);
      if (parsedChain) {
        chain = parsedChain;
        continue;
      }
    }

    registerGroupCandidate(fragment);
  }

  if (groupKey && !groupLabel && typeof variant.groupLabel === 'string') {
    groupLabel = variant.groupLabel;
  }

  return {
    key: buildChainSizeKey(chain, size, groupKey),
    chain,
    size,
    groupKey,
    groupLabel,
  };
};