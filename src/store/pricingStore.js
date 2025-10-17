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

const SUPPLEMENT_BACKUP_STORAGE_KEY = 'price-pilot.supplement-backups';
const SUPPLEMENTS_STORAGE_KEY = 'price-pilot.supplements';
const DEFAULT_NECKLACE_SIZE = necklaceSizes[0] ?? 41;

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

  const sizes = entry.sizes;
  if (sizes && typeof sizes === 'object') {
    const direct = sizes[size] ?? sizes[String(size)];
    const numeric = Number(direct);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  const baseSupplement = Number(entry?.supplement) || 0;
  const perCm = Number(entry?.perCm) || 0;
  const delta = size - DEFAULT_NECKLACE_SIZE;
  const incremental = delta > 0 ? delta * perCm : 0;

  return baseSupplement + incremental;
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

const SCOPE_COLLECTIONS = {
  global: [],
  bracelets: ['bracelet'],
  necklaces: ['collier'],
  rings: ['bague'],
  handchains: ['handchain'],
  sets: ['ensemble'],
};

const BACKUP_SCOPES = Object.keys(SCOPE_COLLECTIONS);

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

const collectNecklaceGroupsFromProduct = (product, chainTypeSupplements = {}) => {
  const fallbackBasePrice = Number(product?.basePrice ?? 0);
  const fallbackCompare = Number(
    product?.baseCompareAtPrice ?? product?.basePrice ?? 0,
  );

  const entries = new Map();
  entries.set(null, {
    key: null,
    label: null,
    basePrice: fallbackBasePrice,
    baseCompareAtPrice: fallbackCompare,
    preference: Number.POSITIVE_INFINITY,
  });

  if (!Array.isArray(product?.variants)) {
    return Array.from(entries.values()).map(({ preference, ...rest }) => rest);
  }

  for (const variant of product.variants) {
    if (!variant) {
      continue;
    }

    const signature = deriveNecklaceSignature(variant);
    const chain = signature.chain;
    const size = signature.size;
    if (!chain || !Number.isFinite(size)) {
      continue;
    }

    const supplementData = chainTypeSupplements[chain];
    if (!supplementData) {
      continue;
    }

    const supplementValue = resolveNecklaceSupplement(supplementData, size);
    const variantPrice = resolveVariantPrice(variant, product);
    const variantCompare = resolveVariantCompareAt(variant, product);

    const basePrice = Number(variantPrice - supplementValue);
    const baseCompare = Number(variantCompare - supplementValue);

    if (!Number.isFinite(basePrice) && !Number.isFinite(baseCompare)) {
      continue;
    }

    const groupKey = signature.groupKey ?? null;
    const preference = Number.isFinite(size)
      ? Math.abs(size - DEFAULT_NECKLACE_SIZE)
      : Number.POSITIVE_INFINITY;

    const existing = entries.get(groupKey);
    const resolvedBasePrice = Number.isFinite(basePrice)
      ? basePrice
      : existing?.basePrice ?? fallbackBasePrice;
    const resolvedBaseCompare = Number.isFinite(baseCompare)
      ? baseCompare
      : existing?.baseCompareAtPrice ?? fallbackCompare;
    const label = signature.groupLabel ?? existing?.label ?? null;

    if (!existing || preference <= existing.preference) {
      entries.set(groupKey, {
        key: groupKey,
        label,
        basePrice: resolvedBasePrice,
        baseCompareAtPrice: resolvedBaseCompare,
        preference,
      });
    } else if (!existing.label && label) {
      entries.set(groupKey, {
        ...existing,
        label,
      });
    }
  }

  return Array.from(entries.values()).map(({ preference, ...rest }) => rest);
};

const SET_CHAIN_NECKLACE_KEYWORDS = [/collier/i, /necklace/i, /neck/i];
const SET_CHAIN_BRACELET_KEYWORDS = [/bracelet/i, /poignet/i, /hand\s*chain/i, /main/i];
const SET_CHAIN_NEUTRAL_KEYWORDS = [/ensemble/i, /set/i];

const rankSetChainFragment = (fragment) => {
  const normalized = String(fragment ?? '').toLowerCase();
  if (!normalized) {
    return 2;
  }

  const mentionsBracelet = SET_CHAIN_BRACELET_KEYWORDS.some((regex) => regex.test(normalized));
  const mentionsNecklace = SET_CHAIN_NECKLACE_KEYWORDS.some((regex) => regex.test(normalized));
  const mentionsNeutral = SET_CHAIN_NEUTRAL_KEYWORDS.some((regex) => regex.test(normalized));

  if (mentionsNecklace && !mentionsBracelet) {
    return 0;
  }

  if (mentionsNecklace && mentionsBracelet) {
    return 1;
  }

  if (mentionsNeutral && !mentionsBracelet) {
    return 1;
  }

  if (mentionsBracelet && !mentionsNecklace) {
    return 3;
  }

  return 2;
};

const deriveSetSignature = (variant) => {
  if (!variant || typeof variant !== 'object') {
    return { key: null, chain: null, size: null };
  }

  let size = null;
  const candidatePriorities = new Map();
  const registerCandidate = (fragment) => {
    const normalized = String(fragment ?? '').trim();
    if (!normalized) {
      return;
    }

    const canonical = canonicalChainName(normalized, 'set chain options');
    if (!canonical) {
      return;
    }

    const priority = rankSetChainFragment(normalized);
    const previousPriority = candidatePriorities.get(canonical);

    if (previousPriority === undefined || priority < previousPriority) {
      candidatePriorities.set(canonical, priority);
    }
  };

  if (Number.isFinite(variant.size)) {
    if (necklaceSizes.includes(variant.size)) {
      size = variant.size;
    } else {
      console.warn(
        `set size "${variant.size}" doesn't match expected format or values:`,
        necklaceSizes,
      );
    }
  } else if (variant.size) {
    size = canonicalNecklaceSize(variant.size, 'set') ?? size;
  }

  if (variant.chainType) {
    registerCandidate(variant.chainType);
  }

  if (variant.necklaceChain) {
    registerCandidate(variant.necklaceChain);
  }

  for (const part of collectVariantParts(variant)) {
    const fragment = String(part ?? '').trim();
    if (!fragment) {
      continue;
    }

    if (!size) {
      const parsedSize = canonicalNecklaceSize(fragment, 'set');
      if (Number.isFinite(parsedSize)) {
        size = parsedSize;
      }
    }

    registerCandidate(fragment);
  }

  let chain = null;
  let bestPriority = Infinity;

  for (const [canonical, priority] of candidatePriorities.entries()) {
    if (priority < bestPriority) {
      bestPriority = priority;
      chain = canonical;
    }
  }

  if (!chain && candidatePriorities.size > 0) {
    chain = candidatePriorities.keys().next().value;
  }

  return { key: buildChainSizeKey(chain, size), chain, size };
};

const alignVariantsFromMetafields = async ({ scope, collection, label, alignProduct }, set, get) => {
  const toggleLoading = get().toggleLoading;
  if (typeof toggleLoading === 'function') {
    toggleLoading(scope, true);
  }

  try {
    const products = Array.isArray(get().products) ? get().products : [];
    const nextProducts = [];
    let touched = 0;
    let changed = 0;
    let mutated = false;

    for (const product of products) {
      if (!product || product.collection !== collection) {
        nextProducts.push(product);
        continue;
      }

      const outcome = alignProduct(product);
      if (!outcome || !outcome.applied) {
        nextProducts.push(product);
        continue;
      }

      touched += 1;

      if (outcome.changed && Array.isArray(outcome.variants)) {
        changed += 1;
        mutated = true;
        nextProducts.push({ ...product, variants: outcome.variants });
      } else {
        nextProducts.push(product);
      }
    }

    if (mutated) {
      set({ products: nextProducts });
    }

    const pluralLabel = (count) => {
      const base = label ?? 'product';
      if (count === 1) {
        return base;
      }
      return base.endsWith('s') ? base : `${base}s`;
    };

    const log = get().log;
    if (typeof log === 'function') {
      if (touched === 0) {
        log(`No ${pluralLabel(2)} had complete metafields to update.`, scope, 'warning');
      } else if (changed === 0) {
        log(`Metafield options already aligned for ${touched} ${pluralLabel(touched)}.`, scope, 'info');
      } else {
        log(
          `Set variant options from metafields for ${touched} ${pluralLabel(touched)} (${changed} updated).`,
          scope,
          'success',
        );
      }
    }

    return { touchedCount: touched, changedCount: changed };
  } finally {
    const finalizeToggle = get().toggleLoading;
    if (typeof finalizeToggle === 'function') {
      finalizeToggle(scope, false);
    }
  }
};

const alignBraceletVariantOptions = (product) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  const chainMap = buildChainMetafieldMap(product, 'Chain Variants', 'bracelet metafield options');
  if (chainMap.size === 0) {
    return null;
  }

  let applied = false;
  let changed = false;

  const updatedVariants = product.variants.map((variant) => {
    const key = deriveBraceletKey(variant);
    if (!key) {
      return variant;
    }

    const display = chainMap.get(key);
    if (!display) {
      return variant;
    }

    applied = true;
    const nextOptions = [display];
    if (!arraysEqual(variant.options, nextOptions)) {
      changed = true;
      return { ...variant, options: nextOptions };
    }

    return variant;
  });

  if (!applied) {
    return null;
  }

  return {
    applied: true,
    changed,
    variants: changed ? updatedVariants : undefined,
  };
};

const alignHandChainVariantOptions = (product) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  const chainMap = buildChainMetafieldMap(product, 'Chain Variants', 'hand chain metafield options');
  if (chainMap.size === 0) {
    return null;
  }

  let applied = false;
  let changed = false;

  const updatedVariants = product.variants.map((variant) => {
    const key = deriveHandChainKey(variant);
    if (!key) {
      return variant;
    }

    const display = chainMap.get(key);
    if (!display) {
      return variant;
    }

    applied = true;
    const nextOptions = [display];
    if (!arraysEqual(variant.options, nextOptions)) {
      changed = true;
      return { ...variant, options: nextOptions };
    }

    return variant;
  });

  if (!applied) {
    return null;
  }

  return {
    applied: true,
    changed,
    variants: changed ? updatedVariants : undefined,
  };
};

const alignNecklaceVariantOptions = (product) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  const chainMap = buildChainMetafieldMap(product, 'Chain Variants', 'necklace metafield options');
  const sizeMap = buildNecklaceSizeMetafieldMap(product, 'Taille de chaine', 'necklace metafield size');
  if (chainMap.size === 0 || sizeMap.size === 0) {
    return null;
  }

  let applied = false;
  let changed = false;

  const resolveGroupDisplay = (variant, chainDisplay, sizeDisplay, signature) => {
    if (signature?.groupLabel) {
      return signature.groupLabel;
    }

    if (!Array.isArray(variant?.options)) {
      return null;
    }

    for (const option of variant.options) {
      if (option === chainDisplay || option === sizeDisplay) {
        continue;
      }

      const candidate = canonicalNecklaceGroup(option);
      if (candidate) {
        return candidate.label;
      }
    }

    return null;
  };

  const updatedVariants = product.variants.map((variant) => {
    const signature = deriveNecklaceSignature(variant);
    const chain = signature.chain;
    const size = signature.size;
    if (!chain || size === null || size === undefined) {
      return variant;
    }

    const chainDisplay = chainMap.get(chain);
    const sizeDisplay = sizeMap.get(size);
    if (!chainDisplay || !sizeDisplay) {
      return variant;
    }

    applied = true;
    const groupDisplay = resolveGroupDisplay(variant, chainDisplay, sizeDisplay, signature);
    const nextOptions = groupDisplay
      ? [groupDisplay, chainDisplay, sizeDisplay]
      : [chainDisplay, sizeDisplay];
    if (!arraysEqual(variant.options, nextOptions)) {
      changed = true;
      return { ...variant, options: nextOptions };
    }

    return variant;
  });

  if (!applied) {
    return null;
  }

  return {
    applied: true,
    changed,
    variants: changed ? updatedVariants : undefined,
  };
};

const alignSetVariantOptions = (product) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  const chainMap = buildChainMetafieldMap(product, 'Chain Variants', 'set metafield options');
  const sizeMap = buildNecklaceSizeMetafieldMap(product, 'Taille de chaine', 'set metafield size');
  if (chainMap.size === 0 || sizeMap.size === 0) {
    return null;
  }

  let applied = false;
  let changed = false;

  const updatedVariants = product.variants.map((variant) => {
    const signature = deriveSetSignature(variant);
    const chain = signature.chain;
    const size = signature.size;
    if (!chain || size === null || size === undefined) {
      return variant;
    }

    const chainDisplay = chainMap.get(chain);
    const sizeDisplay = sizeMap.get(size);
    if (!chainDisplay || !sizeDisplay) {
      return variant;
    }

    applied = true;
    const nextOptions = [chainDisplay, sizeDisplay];
    if (!arraysEqual(variant.options, nextOptions)) {
      changed = true;
      return { ...variant, options: nextOptions };
    }

    return variant;
  });

  if (!applied) {
    return null;
  }

  return {
    applied: true,
    changed,
    variants: changed ? updatedVariants : undefined,
  };
};

const alignRingVariantOptions = (product) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  const bandMap = buildRingBandMetafieldMap(product, "Type D'anneau");
  const sizeMap = buildRingSizeMetafieldMap(product, 'Taille de bague');
  if (bandMap.size === 0 || sizeMap.size === 0) {
    return null;
  }

  let applied = false;
  let changed = false;

  const updatedVariants = product.variants.map((variant) => {
    const identity = deriveRingIdentity(variant);
    const band = identity.band;
    const size = identity.size;
    if (!band || !size) {
      return variant;
    }

    const bandDisplay = bandMap.get(band);
    const sizeDisplay = sizeMap.get(size);
    if (!bandDisplay || !sizeDisplay) {
      return variant;
    }

    applied = true;
    const nextOptions = [bandDisplay, sizeDisplay];
    if (!arraysEqual(variant.options, nextOptions)) {
      changed = true;
      return { ...variant, options: nextOptions };
    }

    return variant;
  });

  if (!applied) {
    return null;
  }

  return {
    applied: true,
    changed,
    variants: changed ? updatedVariants : undefined,
  };
};

export const usePricingStore = create(
  devtools((set, get) => ({
    username: loadStoredUsername(),
    language: 'en',
    products: mockProducts,
    productsInitialized: false,
    productsSyncing: false,
    supplements: loadStoredSupplements(),
    supplementBackups: loadStoredSupplementBackups(),
    supplementChangesPending: createSupplementChangeFlags(),
    backups: {},
    logs: [],
    loadingCounts: {},
    loadingScopes: new Set(),

    setUsername: (username) =>
      set(() => {
        persistUsername(username);
        return { username };
      }),
    setLanguage: (language) => set({ language }),

    log: (message, scope, level = 'info') => {
      const entry = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)),
        message,
        variantScope: scope,
        timestamp: new Date().toISOString(),
        level,
      };
      set((state) => ({ logs: [entry, ...state.logs].slice(0, 200) }));

      if (level === 'silent') {
        return;
      }

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
    },

    toggleLoading: (scope, loading) => {
      set((state) => {
        const key = typeof scope === 'string' ? scope.trim() : '';
        if (!key) {
          return {};
        }

        const currentCounts = state.loadingCounts || {};
        const nextCounts = { ...currentCounts };
        const previousValue = Number(nextCounts[key]);
        const previous = Number.isFinite(previousValue) && previousValue > 0 ? previousValue : 0;
        const nextValue = loading ? previous + 1 : Math.max(0, previous - 1);

        if (nextValue <= 0) {
          delete nextCounts[key];
        } else {
          nextCounts[key] = nextValue;
        }

        return {
          loadingCounts: nextCounts,
          loadingScopes: new Set(Object.keys(nextCounts)),
        };
      });
    },

    isScopeLoading: (scope) => {
      const key = typeof scope === 'string' ? scope.trim() : '';
      if (!key) {
        return false;
      }

      const counts = get().loadingCounts || {};
      const currentValue = Number(counts[key]);
      return Number.isFinite(currentValue) && currentValue > 0;
    },

    alignBraceletVariantsFromMetafields: () =>
      alignVariantsFromMetafields(
        {
          scope: 'bracelets',
          collection: 'bracelet',
          label: 'bracelet',
          alignProduct: alignBraceletVariantOptions,
        },
        set,
        get,
      ),

    alignHandChainVariantsFromMetafields: () =>
      alignVariantsFromMetafields(
        {
          scope: 'handchains',
          collection: 'handchain',
          label: 'hand chain',
          alignProduct: alignHandChainVariantOptions,
        },
        set,
        get,
      ),

    alignNecklaceVariantsFromMetafields: () =>
      alignVariantsFromMetafields(
        {
          scope: 'necklaces',
          collection: 'collier',
          label: 'necklace',
          alignProduct: alignNecklaceVariantOptions,
        },
        set,
        get,
      ),

    alignRingVariantsFromMetafields: () =>
      alignVariantsFromMetafields(
        {
          scope: 'rings',
          collection: 'bague',
          label: 'ring',
          alignProduct: alignRingVariantOptions,
        },
        set,
        get,
      ),

    alignSetVariantsFromMetafields: () =>
      alignVariantsFromMetafields(
        {
          scope: 'sets',
          collection: 'ensemble',
          label: 'set',
          alignProduct: alignSetVariantOptions,
        },
        set,
        get,
      ),

    syncProductsFromShopify: async () => {
      if (get().productsSyncing || get().productsInitialized) {
        return;
      }

      if (!hasShopifyProxy()) {
        get().log('Shopify proxy missing; using local mock catalog.', 'catalog', 'warning');
        set({ productsInitialized: true });
        return;
      }

      set({ productsSyncing: true });
      get().toggleLoading('catalog', true);

      try {
        const products = await fetchActiveProducts();
        set({ products });
        if (products.length === 0) {
          get().log('No active Shopify products found for this store.', 'catalog', 'warning');
        } else {
          get().log(`Loaded ${products.length} Shopify products.`, 'catalog', 'success');
        }
      } catch (error) {
        console.error('Failed to synchronize Shopify products', error);
        get().log('Failed to load Shopify products. Using mock catalog.', 'catalog', 'error');
        set({ products: mockProducts });
      } finally {
        get().toggleLoading('catalog', false);
        set({ productsInitialized: true, productsSyncing: false });
      }
    },

    refreshBackupsFromProxy: async () => {
      if (!hasShopifyProxy()) {
        return;
      }

      try {
        const entries = await Promise.all(
          BACKUP_SCOPES.map(async (scope) => [scope, await fetchScopeBackup(scope)]),
        );

        set((state) => {
          const nextBackups = { ...state.backups };
          for (const [scope, backup] of entries) {
            if (backup) {
              nextBackups[scope] = backup;
            } else {
              delete nextBackups[scope];
            }
          }

          return { backups: nextBackups };
        });
      } catch (error) {
        console.error('Failed to refresh stored Shopify backups', error);
      }
    },

    backupScope: async (scope) => {
      if (!(scope in SCOPE_COLLECTIONS)) {
        get().log('Unknown backup scope requested.', scope, 'error');
        return;
      }

      if (!hasShopifyProxy()) {
        get().log('Shopify proxy missing; unable to capture live backup.', scope, 'error');
        return;
      }

      get().toggleLoading(scope, true);
      const loadingToastId = toast.loading('Creating backup...');

      try {
        const collections = SCOPE_COLLECTIONS[scope] ?? [];
        console.log('[PricingStore] Starting backup', {
          scope,
          collections,
        });

        let remoteProducts = [];
        let persistedBackup = null;

        persistedBackup = await captureScopeBackup(scope);
        if (persistedBackup) {
          console.log('[PricingStore] Received persisted backup from proxy', {
            scope,
            productCount: persistedBackup.products?.length ?? 0,
            timestamp: persistedBackup.timestamp,
          });
          remoteProducts = cloneProducts(persistedBackup.products ?? []);
        } else {
          console.warn('[PricingStore] Proxy capture unavailable, falling back to client fetch', {
            scope,
          });
          remoteProducts = await fetchProductsByCollections(collections);
          console.log('[PricingStore] Loaded remote products for backup', {
            scope,
            productCount: remoteProducts.length,
          });
        }

        const collectionSet = buildCollectionSet(scope);
        const currentProducts = get().products;
        const mergedProducts = mergeProductsForScope(currentProducts, remoteProducts, collectionSet);

        let backupPayload = persistedBackup;
        if (!backupPayload) {
          backupPayload = {
            timestamp: new Date().toISOString(),
            products: cloneProducts(remoteProducts),
          };
        }

        set((state) => ({
          products: mergedProducts,
          backups: {
            ...state.backups,
            [scope]: backupPayload,
          },
        }));

        if (!persistedBackup) {
          console.log('[PricingStore] Persisting backup payload via fallback flow', {
            scope,
            productCount: backupPayload.products?.length ?? 0,
            timestamp: backupPayload.timestamp,
          });

          const persisted = await persistScopeBackup(scope, backupPayload);
          if (persisted) {
            console.log('[PricingStore] Backup persisted via proxy', {
              scope,
              productCount: persisted.products?.length ?? 0,
              timestamp: persisted.timestamp,
            });
            set((state) => ({
              backups: {
                ...state.backups,
                [scope]: persisted,
              },
            }));
          } else {
            console.warn('[PricingStore] Proxy persistence failed; using in-memory backup only', {
              scope,
            });
            get().log(
              'Failed to persist backup to disk. Restore may be unavailable after reload.',
              scope,
              'warning',
            );
          }
        }

        const count = remoteProducts.length;
        const plural = count === 1 ? '' : 's';
        get().log(
          `Captured Shopify backup with ${count} product${plural} for ${scope}.`,
          scope,
          'success',
        );
      } catch (error) {
        console.error('Failed to capture Shopify backup', error);
        get().log('Failed to capture Shopify backup. Verify proxy connection.', scope, 'error');
      } finally {
        get().toggleLoading(scope, false);
        toast.dismiss(loadingToastId);
      }
    },

    restoreScope: async (scope) => {
      if (!(scope in SCOPE_COLLECTIONS)) {
        get().log('Unknown restore scope requested.', scope, 'error');
        return;
      }

      let backupEntry = get().backups[scope];
      console.log('[PricingStore] Restore requested', {
        scope,
        hasLocalBackup: hasBackupProducts(backupEntry),
      });
      if (!hasBackupProducts(backupEntry)) {
        if (!hasShopifyProxy()) {
          get().log('No backup available to restore.', scope, 'warning');
          return;
        }

        try {
          const latestBackup = await fetchScopeBackup(scope);
          console.log('[PricingStore] Loaded backup from proxy for restore', {
            scope,
            productCount: latestBackup?.products?.length ?? 0,
          });
          if (hasBackupProducts(latestBackup)) {
            set((state) => ({
              backups: {
                ...state.backups,
                [scope]: latestBackup,
              },
            }));
            backupEntry = latestBackup;
          }
        } catch (error) {
          console.error('Failed to load stored backup before restore', error);
          get().log('Failed to load stored backup. Verify proxy connection.', scope, 'error');
          return;
        }
      }

      if (!hasBackupProducts(backupEntry)) {
        console.warn('[PricingStore] Restore aborted; no backup products available', { scope });
        get().log('No backup available to restore.', scope, 'warning');
        return;
      }

      if (!hasShopifyProxy()) {
        get().log('Shopify proxy missing; unable to restore backup to Shopify.', scope, 'error');
        return;
      }

      const restoreToastId = toast.loading('Restoring backup...');
      const backupProducts = cloneProducts(backupEntry.products);
      const backupById = new Map(backupProducts.map((product) => [product.id, product]));
      const collectionSet = buildCollectionSet(scope);
      const includeAllCollections = collectionSet.size === 0;
      const currentProducts = get().products;
      const updatesByProduct = new Map();
      const originalVariantLookup = new Map();
      const updatedProducts = [];

      for (const product of currentProducts) {
        const productCollection =
          typeof product.collection === 'string' ? product.collection.toLowerCase() : '';
        const collectionMatches = includeAllCollections || collectionSet.has(productCollection);

        if (!collectionMatches) {
          updatedProducts.push(product);
          continue;
        }

        const backupProduct = backupById.get(product.id);
        if (!backupProduct) {
          updatedProducts.push(product);
          continue;
        }

        const clonedBackup = cloneProduct(backupProduct);
        const currentVariants = Array.isArray(product.variants) ? product.variants : [];

        for (const variant of currentVariants) {
          if (variant?.id) {
            originalVariantLookup.set(String(variant.id), { ...variant });
          }
        }

        const currentVariantLookup = new Map(
          currentVariants.map((variant) => [String(variant?.id ?? ''), variant]),
        );

        for (const variant of clonedBackup.variants) {
          const variantId = String(variant?.id ?? '');
          if (!variantId) {
            continue;
          }

          const currentVariant = currentVariantLookup.get(variantId);
          if (!currentVariant) {
            continue;
          }

          if (
            currentVariant.price !== variant.price ||
            currentVariant.compareAtPrice !== variant.compareAtPrice
          ) {
            if (!updatesByProduct.has(clonedBackup.id)) {
              updatesByProduct.set(clonedBackup.id, {
                productId: clonedBackup.id,
                productTitle: clonedBackup.title,
                variants: [],
              });
            }

            updatesByProduct.get(clonedBackup.id).variants.push({
              id: variantId,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice,
            });
          }
        }

        updatedProducts.push(clonedBackup);
        backupById.delete(product.id);
      }

      for (const backupProduct of backupById.values()) {
        const clonedBackup = cloneProduct(backupProduct);
        updatedProducts.push(clonedBackup);

        if (!updatesByProduct.has(clonedBackup.id)) {
          updatesByProduct.set(clonedBackup.id, {
            productId: clonedBackup.id,
            productTitle: clonedBackup.title,
            variants: [],
          });
        }

        const entry = updatesByProduct.get(clonedBackup.id);
        for (const variant of clonedBackup.variants) {
          const variantId = String(variant?.id ?? '');
          if (!variantId) {
            continue;
          }

          entry.variants.push({
            id: variantId,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice,
          });
        }
      }

      for (const [productId, entry] of updatesByProduct.entries()) {
        entry.variants = entry.variants
          .map((variant) => ({
            id: variant?.id ? String(variant.id) : '',
            price: variant?.price,
            compareAtPrice: variant?.compareAtPrice,
          }))
          .filter((variant) => variant.id);

        if (entry.variants.length === 0) {
          updatesByProduct.delete(productId);
        }
      }

      get().toggleLoading(scope, true);

      try {
        const result = await commitShopifyVariantUpdates({
          scope,
          collection: SCOPE_COLLECTIONS[scope],
          updatedProducts,
          updatesByProduct,
          originalVariantLookup,
          noChangesMessage: 'Shopify already matches the stored backup.',
          successLogMessage: 'Shopify variants aligned with backup values.',
          updateLabel: 'product',
          failureLogMessage: 'Failed to push backup restore to Shopify.',
          set,
          get,
        });

        if (result.success) {
          get().log('Backup restored successfully.', scope, 'success');
        } else if (result.failedCount > 0) {
          get().log(
            'Backup restore completed with Shopify errors. Review logs for details.',
            scope,
            'warning',
          );
        }
      } finally {
        get().toggleLoading(scope, false);
        toast.dismiss(restoreToastId);
      }
    },

    previewGlobalChange: (percent = 0) => {
      const adjustment = Number.isFinite(Number(percent)) ? Number(percent) : 0;
      const { products } = get();

      return products
        .filter((product) => product.status === 'active')
        .map((product) => {
          const basePrice = Number(product.basePrice ?? 0);
          const baseCompare = Number(product.baseCompareAtPrice ?? product.basePrice ?? 0);
          const updatedBasePrice = applyPercentage(basePrice, adjustment);
          const updatedCompareAtPrice = applyPercentage(baseCompare, adjustment);

          const variants = (Array.isArray(product.variants) ? product.variants : []).map(
            (variant) => {
              const currentPrice = Number(variant?.price ?? basePrice);
              const currentCompare = Number(variant?.compareAtPrice ?? baseCompare);
              const nextPrice = applyPercentage(currentPrice, adjustment);
              const nextCompare = applyPercentage(currentCompare, adjustment);
              const changed = currentPrice !== nextPrice || currentCompare !== nextCompare;

              return {
                ...variant,
                id: variant?.id ? String(variant.id) : `${product.id}-${variant?.title ?? 'variant'}`,
                title: variant?.title ?? 'Variant',
                price: nextPrice,
                compareAtPrice: nextCompare,
                previousPrice: currentPrice,
                previousCompareAtPrice: currentCompare,
                status: changed ? 'changed' : 'unchanged',
              };
            },
          );

          return {
            product,
            updatedBasePrice,
            updatedCompareAtPrice,
            variants,
          };
        });
    },

    applyGlobalChange: async (percent = 0) => {
      const adjustment = Number.isFinite(Number(percent)) ? Number(percent) : 0;

      get().toggleLoading('global', true);
      const loadingToastId = toast.loading('Applying global pricing...');

      try {
        if (!hasShopifyProxy()) {
          get().log('Shopify proxy missing; unable to push global pricing updates.', 'global', 'error');
          return { success: false, reason: 'missing-proxy' };
        }

        const products = get().products;
        const updatedProducts = [];
        const updatesByProduct = new Map();
        const originalVariantLookup = new Map();

        for (const product of products) {
          if (product.status !== 'active') {
            updatedProducts.push(product);
            continue;
          }

          const basePrice = Number(product.basePrice ?? 0);
          const baseCompare = Number(product.baseCompareAtPrice ?? product.basePrice ?? 0);
          const updatedBasePrice = applyPercentage(basePrice, adjustment);
          const updatedCompareAtPrice = applyPercentage(baseCompare, adjustment);

          const currentVariants = Array.isArray(product.variants) ? product.variants : [];
          const nextVariants = currentVariants.map((variant) => {
            const variantId = variant?.id ? String(variant.id) : null;
            if (variantId) {
              originalVariantLookup.set(variantId, variant);
            }

            const currentPrice = Number(variant?.price ?? basePrice);
            const currentCompare = Number(variant?.compareAtPrice ?? baseCompare);
            const updatedPrice = applyPercentage(currentPrice, adjustment);
            const updatedCompare = applyPercentage(currentCompare, adjustment);

            if (
              variantId &&
              (updatedPrice !== currentPrice || updatedCompare !== currentCompare)
            ) {
              if (!updatesByProduct.has(product.id)) {
                updatesByProduct.set(product.id, {
                  productId: product.id,
                  productTitle: product.title,
                  variants: [],
                });
              }

              updatesByProduct.get(product.id).variants.push({
                id: variantId,
                price: updatedPrice,
                compareAtPrice: updatedCompare,
              });
            }

            return {
              ...variant,
              price: updatedPrice,
              compareAtPrice: updatedCompare,
            };
          });

          updatedProducts.push({
            ...product,
            basePrice: updatedBasePrice,
            baseCompareAtPrice: updatedCompareAtPrice,
            variants: nextVariants,
          });
        }

        return await commitShopifyVariantUpdates({
          scope: 'global',
          collection: [],
          updatedProducts,
          updatesByProduct,
          originalVariantLookup,
          noChangesMessage:
            'No Shopify changes required; all variant prices already reflect this adjustment.',
          successLogMessage: 'Global pricing update completed.',
          updateLabel: 'global pricing',
          failureLogMessage: 'Failed to apply global pricing update to Shopify.',
          set,
          get,
        });
      } finally {
        get().toggleLoading('global', false);
        toast.dismiss(loadingToastId);
      }
    },
    previewBracelets: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'bracelet' && product.status === 'active')
        .map((product) => {
          const lookup = new Map();
          for (const existingVariant of product.variants) {
            const signature = deriveBraceletVariantSignature(existingVariant);
            if (signature.key) {
              lookup.set(signature.key, existingVariant);
            }
          }

          return {
            product,
            updatedBasePrice: product.basePrice,
            updatedCompareAtPrice: product.baseCompareAtPrice,
            variants: buildBraceletVariants(product, supplements.bracelets).map((variant) => {
              const signature = deriveBraceletVariantSignature(variant);
              const currentVariant = signature.key ? lookup.get(signature.key) : null;
              const matched = Boolean(currentVariant);
              const targetPrice = toNumberOrNull(variant.price);
              const targetCompare = toNumberOrNull(variant.compareAtPrice);
              const previousPrice = matched ? resolveVariantPrice(currentVariant, product) : null;
              const previousCompare = matched ? resolveVariantCompareAt(currentVariant, product) : null;
              const priceChanged = matched && hasMeaningfulDelta(previousPrice, targetPrice);
              const compareChanged =
                matched &&
                targetCompare !== null &&
                (previousCompare === null || hasMeaningfulDelta(previousCompare, targetCompare));

              const changeType = !matched
                ? null
                : priceChanged && compareChanged
                  ? 'price-compare'
                  : priceChanged
                    ? 'price'
                    : compareChanged
                      ? 'compare'
                      : null;

              return {
                ...variant,
                previousPrice,
                previousCompareAtPrice: previousCompare,
                status: matched ? (changeType ? 'changed' : 'unchanged') : 'missing',
                changeType,
              };
            }),
          };
        });
    },

    applyBracelets: async () => {
      get().toggleLoading('bracelets', true);
      const loadingToastId = toast.loading('Applying bracelet pricing...');

      try {
        const { products, supplements } = get();

        const updatedProducts = [];
        const updatesByProduct = new Map();
        const originalVariantLookup = new Map();
        const missingSummaries = [];

        for (const product of products) {
          if (product.collection !== 'bracelet') {
            updatedProducts.push(product);
            continue;
          }

          const targetVariants = buildBraceletVariants(product, supplements.bracelets);
          const targetByKey = new Map();

          for (const target of targetVariants) {
            const signature = deriveBraceletVariantSignature(target);
            if (signature.key) {
              targetByKey.set(signature.key, target);
            }
          }

          const availableKeys = new Set();
          const variantKeyLookup = new Map();

          for (const variant of product.variants) {
            if (variant?.id) {
              originalVariantLookup.set(String(variant.id), variant);
            }

            const signature = deriveBraceletVariantSignature(variant);
            if (signature.key && targetByKey.has(signature.key)) {
              availableKeys.add(signature.key);
              variantKeyLookup.set(variant, signature.key);
            }
          }

          const nextVariants = product.variants.map((variant) => {
            const key = variantKeyLookup.get(variant);
            if (!key) {
              return variant;
            }

            const target = targetByKey.get(key);
            if (!target) {
              return variant;
            }

            if (
              variant.id &&
              (variant.price !== target.price || variant.compareAtPrice !== target.compareAtPrice)
            ) {
              if (!updatesByProduct.has(product.id)) {
                updatesByProduct.set(product.id, {
                  productId: product.id,
                  productTitle: product.title,
                  variants: [],
                });
              }

              updatesByProduct.get(product.id).variants.push({
                id: variant.id,
                price: target.price,
                compareAtPrice: target.compareAtPrice,
              });
            }

            return {
              ...variant,
              price: target.price,
              compareAtPrice: target.compareAtPrice,
            };
          });

          const missingVariants = targetVariants.filter((variant) => {
            const signature = deriveBraceletVariantSignature(variant);
            return signature.key ? !availableKeys.has(signature.key) : true;
          });

          if (missingVariants.length > 0) {
            missingSummaries.push({
              product,
              titles: missingVariants.map((variant) => variant.title),
            });
          }

          updatedProducts.push({ ...product, variants: nextVariants });
        }

        for (const { product, titles } of missingSummaries) {
          const plural = titles.length === 1 ? '' : 's';
          const combinationSummary = titles.join(', ');
          get().log(
            `Skipped ${titles.length} bracelet variant${plural} for ${product.title} because Shopify is missing: ${combinationSummary}.`,
            'bracelets',
            'warning',
          );
        }

        return await commitShopifyVariantUpdates({
          scope: 'bracelets',
          collection: 'bracelet',
          updatedProducts,
          updatesByProduct,
          originalVariantLookup,
          noChangesMessage:
            'Bracelet variants already aligned with supplements; no Shopify update sent.',
          successLogMessage: 'Bracelet variants updated.',
          updateLabel: 'bracelet',
          failureLogMessage: 'Failed to push bracelet variant updates to Shopify.',
          set,
          get,
        });
      } finally {
        get().toggleLoading('bracelets', false);
        toast.dismiss(loadingToastId);
      }
    },

    previewNecklaces: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'collier' && product.status === 'active')
        .map((product) => {
          const groups = collectNecklaceGroupsFromProduct(product, supplements.necklaces);
          const lookup = new Map();
          for (const existingVariant of product.variants) {
            const signature = deriveNecklaceSignature(existingVariant);
            if (signature.key) {
              lookup.set(signature.key, existingVariant);
            }
          }

          return {
            product,
            updatedBasePrice: product.basePrice,
            updatedCompareAtPrice: product.baseCompareAtPrice,
            variants: buildNecklaceVariants(product, supplements.necklaces, { groups }).map((variant) => {
              const signature = deriveNecklaceSignature(variant);
              const currentVariant = signature.key ? lookup.get(signature.key) : null;
              const matched = Boolean(currentVariant);
              const targetPrice = toNumberOrNull(variant.price);
              const targetCompare = toNumberOrNull(variant.compareAtPrice);
              const previousPrice = matched ? resolveVariantPrice(currentVariant, product) : null;
              const previousCompare = matched ? resolveVariantCompareAt(currentVariant, product) : null;
              const priceChanged = matched && hasMeaningfulDelta(previousPrice, targetPrice);
              const compareChanged =
                matched &&
                targetCompare !== null &&
                (previousCompare === null || hasMeaningfulDelta(previousCompare, targetCompare));

              const changeType = !matched
                ? null
                : priceChanged && compareChanged
                  ? 'price-compare'
                  : priceChanged
                    ? 'price'
                    : compareChanged
                      ? 'compare'
                      : null;

              return {
                ...variant,
                previousPrice,
                previousCompareAtPrice: previousCompare,
                status: matched ? (changeType ? 'changed' : 'unchanged') : 'missing',
                changeType,
              };
            }),
          };
        });
    },

    applyNecklaces: async () => {
      get().toggleLoading('necklaces', true);
      const loadingToastId = toast.loading('Applying necklace pricing...');

      try {
        const { products, supplements } = get();

        const updatedProducts = [];
        const updatesByProduct = new Map();
        const originalVariantLookup = new Map();
        const missingSummaries = [];

        for (const product of products) {
          if (product.collection !== 'collier') {
            updatedProducts.push(product);
            continue;
          }

          const groups = collectNecklaceGroupsFromProduct(product, supplements.necklaces);
          const targetVariants = buildNecklaceVariants(product, supplements.necklaces, { groups });
          const targetEntries = targetVariants.map((variant) => ({
            variant,
            signature: deriveNecklaceSignature(variant),
          }));

          const targetByKey = new Map();
          for (const { variant, signature } of targetEntries) {
            if (signature.key) {
              targetByKey.set(signature.key, { variant, signature });
            }
          }

          const availableKeys = new Set();
          const variantKeyLookup = new Map();

          const productVariantEntries = product.variants.map((variant) => ({
            variant,
            signature: deriveNecklaceSignature(variant),
          }));

          for (const { variant, signature } of productVariantEntries) {
            if (variant?.id) {
              originalVariantLookup.set(String(variant.id), variant);
            }

            if (signature.key && targetByKey.has(signature.key)) {
              availableKeys.add(signature.key);
              variantKeyLookup.set(variant, signature.key);
            }
          }

          const nextVariants = productVariantEntries.map(({ variant }) => {
            const key = variantKeyLookup.get(variant);
            if (!key) {
              return variant;
            }

            const targetEntry = targetByKey.get(key);
            if (!targetEntry) {
              return variant;
            }

            const { variant: target } = targetEntry;

            if (
              variant.id &&
              (variant.price !== target.price || variant.compareAtPrice !== target.compareAtPrice)
            ) {
              if (!updatesByProduct.has(product.id)) {
                updatesByProduct.set(product.id, {
                  productId: product.id,
                  productTitle: product.title,
                  variants: [],
                });
              }

              updatesByProduct.get(product.id).variants.push({
                id: variant.id,
                price: target.price,
                compareAtPrice: target.compareAtPrice,
              });
            }

            return {
              ...variant,
              price: target.price,
              compareAtPrice: target.compareAtPrice,
            };
          });

          const missingVariants = targetEntries
            .filter(({ signature }) => (signature.key ? !availableKeys.has(signature.key) : true))
            .map(({ variant }) => variant);

          if (missingVariants.length > 0) {
            missingSummaries.push({
              product,
              titles: missingVariants.map((variant) => variant.title),
            });
          }

          updatedProducts.push({ ...product, variants: nextVariants });
        }

        for (const { product, titles } of missingSummaries) {
          const plural = titles.length === 1 ? '' : 's';
          const combinationSummary = titles.join(', ');
          get().log(
            `Skipped ${titles.length} necklace variant${plural} for ${product.title} because Shopify is missing: ${combinationSummary}.`,
            'necklaces',
            'warning',
          );
        }

        return await commitShopifyVariantUpdates({
          scope: 'necklaces',
          collection: 'collier',
          updatedProducts,
          updatesByProduct,
          originalVariantLookup,
          noChangesMessage:
            'Necklace variants already aligned with supplements; no Shopify update sent.',
          successLogMessage: 'Necklace variants updated.',
          updateLabel: 'necklace',
          failureLogMessage: 'Failed to push necklace variant updates to Shopify.',
          set,
          get,
        });
      } finally {
        get().toggleLoading('necklaces', false);
        toast.dismiss(loadingToastId);
      }
    },

    previewRings: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'bague' && product.status === 'active')
        .map((product) => {
          const lookup = new Map();
          for (const existingVariant of product.variants) {
            const identity = deriveRingIdentity(existingVariant);
            if (identity.key) {
              lookup.set(identity.key, existingVariant);
            }
          }

          return {
            product,
            updatedBasePrice: product.basePrice,
            updatedCompareAtPrice: product.baseCompareAtPrice,
            variants: buildRingVariants(product, supplements.rings).map((variant) => {
              const key = buildRingKey(variant.band, variant.size);
              const currentVariant = key ? lookup.get(key) : null;
              const matched = Boolean(currentVariant);
              const targetPrice = toNumberOrNull(variant.price);
              const targetCompare = toNumberOrNull(variant.compareAtPrice);
              const previousPrice = matched ? resolveVariantPrice(currentVariant, product) : null;
              const previousCompare = matched ? resolveVariantCompareAt(currentVariant, product) : null;
              const priceChanged = matched && hasMeaningfulDelta(previousPrice, targetPrice);
              const compareChanged =
                matched &&
                targetCompare !== null &&
                (previousCompare === null || hasMeaningfulDelta(previousCompare, targetCompare));

              const changeType = !matched
                ? null
                : priceChanged && compareChanged
                  ? 'price-compare'
                  : priceChanged
                    ? 'price'
                    : compareChanged
                      ? 'compare'
                      : null;

              return {
                ...variant,
                previousPrice,
                previousCompareAtPrice: previousCompare,
                status: matched ? (changeType ? 'changed' : 'unchanged') : 'missing',
                changeType,
              };
            }),
          };
        });
    },

    applyRings: async () => {
      get().toggleLoading('rings', true);
      const loadingToastId = toast.loading('Applying ring pricing...');

      try {
        const { products, supplements } = get();

        const updatedProducts = [];
        const updatesByProduct = new Map();
        const missingMappings = [];
        const originalVariantLookup = new Map();

        for (const product of products) {
          if (product.collection !== 'bague') {
            updatedProducts.push(product);
            continue;
          }

          const targetVariants = buildRingVariants(product, supplements.rings);
          const targetByKey = new Map();
          for (const target of targetVariants) {
            const key = buildRingKey(target.band, target.size);
            if (key) {
              targetByKey.set(key, target);
            }
          }

          const availableRingKeys = new Set();
          const variantIdentityLookup = new Map();

          for (const variant of product.variants) {
            if (variant?.id) {
              const variantId = String(variant.id);
              originalVariantLookup.set(variantId, variant);
            }

            const identity = deriveRingIdentity(variant);
            if (identity.key) {
              availableRingKeys.add(identity.key);
            }
            variantIdentityLookup.set(variant, identity);
          }

          const nextVariants = product.variants.map((variant) => {
            const identity = variantIdentityLookup.get(variant) ?? deriveRingIdentity(variant);
            if (!identity.key) {
              return variant;
            }

            const target = targetByKey.get(identity.key);
            if (!target) {
              return variant;
            }

            if (
              variant.id &&
              (variant.price !== target.price || variant.compareAtPrice !== target.compareAtPrice)
            ) {
              if (!updatesByProduct.has(product.id)) {
                updatesByProduct.set(product.id, {
                  productId: product.id,
                  productTitle: product.title,
                  variants: [],
                });
              }

              updatesByProduct.get(product.id).variants.push({
                id: variant.id,
                price: target.price,
                compareAtPrice: target.compareAtPrice,
              });
            }

            return {
              ...variant,
              price: target.price,
              compareAtPrice: target.compareAtPrice,
              band: identity.band ?? target.band,
              size: identity.size ?? target.size,
            };
          });

          const missingVariants = targetVariants.filter((variant) => {
            const key = buildRingKey(variant.band, variant.size);
            return key ? !availableRingKeys.has(key) : false;
          });

          const missingTitles = missingVariants.map((variant) => `${variant.band} • ${variant.size}`);

          if (missingTitles.length > 0) {
            missingMappings.push({ product, titles: missingTitles });
          }

          updatedProducts.push({ ...product, variants: nextVariants });
        }

        if (missingMappings.length > 0) {
          for (const { product, titles } of missingMappings) {
            const combinationSummary = titles.join(', ');
            const plural = titles.length === 1 ? '' : 's';
            get().log(
              `Skipped ${titles.length} ring variant${plural} for ${product.title} because Shopify is missing: ${combinationSummary}.`,
              'rings',
              'warning',
            );
          }
        }

        return await commitShopifyVariantUpdates({
          scope: 'rings',
          collection: 'bague',
          updatedProducts,
          updatesByProduct,
          originalVariantLookup,
          noChangesMessage:
            'Ring variants already aligned with supplements; no Shopify update sent.',
          successLogMessage: 'Ring variants updated.',
          updateLabel: 'ring',
          failureLogMessage: 'Failed to push ring variant updates to Shopify.',
          set,
          get,
        });
      } finally {
        get().toggleLoading('rings', false);
        toast.dismiss(loadingToastId);
      }

    },

    previewHandChains: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'handchain' && product.status === 'active')
        .map((product) => {
          const lookup = new Map();
          for (const existingVariant of product.variants) {
            const key = deriveHandChainKey(existingVariant);
            if (key) {
              lookup.set(key, existingVariant);
            }
          }

          return {
            product,
            updatedBasePrice: product.basePrice,
            updatedCompareAtPrice: product.baseCompareAtPrice,
            variants: buildHandChainVariants(product, supplements.handChains).map((variant) => {
              const key = deriveHandChainKey(variant);
              const currentVariant = key ? lookup.get(key) : null;
              const matched = Boolean(currentVariant);
              const targetPrice = toNumberOrNull(variant.price);
              const targetCompare = toNumberOrNull(variant.compareAtPrice);
              const previousPrice = matched ? resolveVariantPrice(currentVariant, product) : null;
              const previousCompare = matched ? resolveVariantCompareAt(currentVariant, product) : null;
              const priceChanged = matched && hasMeaningfulDelta(previousPrice, targetPrice);
              const compareChanged =
                matched &&
                targetCompare !== null &&
                (previousCompare === null || hasMeaningfulDelta(previousCompare, targetCompare));

              const changeType = !matched
                ? null
                : priceChanged && compareChanged
                  ? 'price-compare'
                  : priceChanged
                    ? 'price'
                    : compareChanged
                      ? 'compare'
                      : null;

              return {
                ...variant,
                previousPrice,
                previousCompareAtPrice: previousCompare,
                status: matched ? (changeType ? 'changed' : 'unchanged') : 'missing',
                changeType,
              };
            }),
          };
        });
    },

    applyHandChains: async () => {
      get().toggleLoading('handchains', true);
      const loadingToastId = toast.loading('Applying hand chain pricing...');

      try {
        const { products, supplements } = get();

        const updatedProducts = [];
        const updatesByProduct = new Map();
        const originalVariantLookup = new Map();
        const missingSummaries = [];

        for (const product of products) {
          if (product.collection !== 'handchain') {
            updatedProducts.push(product);
            continue;
          }

          const targetVariants = buildHandChainVariants(product, supplements.handChains);
          const targetByKey = new Map();

          for (const target of targetVariants) {
            const key = deriveHandChainKey(target);
            if (key) {
              targetByKey.set(key, target);
            }
          }

          const availableKeys = new Set();
          const variantKeyLookup = new Map();

          for (const variant of product.variants) {
            if (variant?.id) {
              originalVariantLookup.set(String(variant.id), variant);
            }

            const key = deriveHandChainKey(variant);
            if (key && targetByKey.has(key)) {
              availableKeys.add(key);
              variantKeyLookup.set(variant, key);
            }
          }

          const nextVariants = product.variants.map((variant) => {
            const key = variantKeyLookup.get(variant);
            if (!key) {
              return variant;
            }

            const target = targetByKey.get(key);
            if (!target) {
              return variant;
            }

            if (
              variant.id &&
              (variant.price !== target.price || variant.compareAtPrice !== target.compareAtPrice)
            ) {
              if (!updatesByProduct.has(product.id)) {
                updatesByProduct.set(product.id, {
                  productId: product.id,
                  productTitle: product.title,
                  variants: [],
                });
              }

              updatesByProduct.get(product.id).variants.push({
                id: variant.id,
                price: target.price,
                compareAtPrice: target.compareAtPrice,
              });
            }

            return {
              ...variant,
              price: target.price,
              compareAtPrice: target.compareAtPrice,
            };
          });

          const missingVariants = targetVariants.filter((variant) => {
            const key = deriveHandChainKey(variant);
            return key ? !availableKeys.has(key) : true;
          });

          if (missingVariants.length > 0) {
            missingSummaries.push({
              product,
              titles: missingVariants.map((variant) => variant.title),
            });
          }

          updatedProducts.push({ ...product, variants: nextVariants });
        }

        for (const { product, titles } of missingSummaries) {
          const plural = titles.length === 1 ? '' : 's';
          const combinationSummary = titles.join(', ');
          get().log(
            `Skipped ${titles.length} hand chain variant${plural} for ${product.title} because Shopify is missing: ${combinationSummary}.`,
            'handchains',
            'warning',
          );
        }

        return await commitShopifyVariantUpdates({
          scope: 'handchains',
          collection: 'handchain',
          updatedProducts,
          updatesByProduct,
          originalVariantLookup,
          noChangesMessage:
            'Hand chain variants already aligned with supplements; no Shopify update sent.',
          successLogMessage: 'Hand chain variants updated.',
          updateLabel: 'hand chain',
          failureLogMessage: 'Failed to push hand chain variant updates to Shopify.',
          set,
          get,
        });
      } finally {
        get().toggleLoading('handchains', false);
        toast.dismiss(loadingToastId);
      }

    },

    previewSets: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'ensemble' && product.status === 'active')
        .map((product) => {
          const lookup = new Map();
          for (const existingVariant of product.variants) {
            const signature = deriveSetSignature(existingVariant);
            if (signature.key) {
              lookup.set(signature.key, existingVariant);
            }
          }

          return {
            product,
            updatedBasePrice: product.basePrice,
            updatedCompareAtPrice: product.baseCompareAtPrice,
            variants: buildSetVariants(
              product,
              supplements.bracelets,
              supplements.necklaces,
            ).map((variant) => {
              const signature = deriveSetSignature(variant);
              const currentVariant = signature.key ? lookup.get(signature.key) : null;
              const matched = Boolean(currentVariant);
              const targetPrice = toNumberOrNull(variant.price);
              const targetCompare = toNumberOrNull(variant.compareAtPrice);
              const previousPrice = matched ? resolveVariantPrice(currentVariant, product) : null;
              const previousCompare = matched ? resolveVariantCompareAt(currentVariant, product) : null;
              const priceChanged = matched && hasMeaningfulDelta(previousPrice, targetPrice);
              const compareChanged =
                matched &&
                targetCompare !== null &&
                (previousCompare === null || hasMeaningfulDelta(previousCompare, targetCompare));

              const changeType = !matched
                ? null
                : priceChanged && compareChanged
                  ? 'price-compare'
                  : priceChanged
                    ? 'price'
                    : compareChanged
                      ? 'compare'
                      : null;

              return {
                ...variant,
                previousPrice,
                previousCompareAtPrice: previousCompare,
                status: matched ? (changeType ? 'changed' : 'unchanged') : 'missing',
                changeType,
              };
            }),
          };
        });
    },

    applySets: async () => {
      get().toggleLoading('sets', true);
      const loadingToastId = toast.loading('Applying set pricing...');

      try {
        const { products, supplements } = get();

        const updatedProducts = [];
        const updatesByProduct = new Map();
        const originalVariantLookup = new Map();
        const missingSummaries = [];

        for (const product of products) {
          if (product.collection !== 'ensemble') {
            updatedProducts.push(product);
            continue;
          }

          const targetVariants = buildSetVariants(
            product,
            supplements.bracelets,
            supplements.necklaces,
          );
          const targetByKey = new Map();

          for (const target of targetVariants) {
            const signature = deriveSetSignature(target);
            if (signature.key) {
              targetByKey.set(signature.key, target);
            }
          }

          const availableKeys = new Set();
          const variantKeyLookup = new Map();

          for (const variant of product.variants) {
            if (variant?.id) {
              originalVariantLookup.set(String(variant.id), variant);
            }

            const signature = deriveSetSignature(variant);
            if (signature.key && targetByKey.has(signature.key)) {
              availableKeys.add(signature.key);
              variantKeyLookup.set(variant, signature.key);
            }
          }

          const nextVariants = product.variants.map((variant) => {
            const key = variantKeyLookup.get(variant);
            if (!key) {
              return variant;
            }

            const target = targetByKey.get(key);
            if (!target) {
              return variant;
            }

            if (
              variant.id &&
              (variant.price !== target.price || variant.compareAtPrice !== target.compareAtPrice)
            ) {
              if (!updatesByProduct.has(product.id)) {
                updatesByProduct.set(product.id, {
                  productId: product.id,
                  productTitle: product.title,
                  variants: [],
                });
              }

              updatesByProduct.get(product.id).variants.push({
                id: variant.id,
                price: target.price,
                compareAtPrice: target.compareAtPrice,
              });
            }

            return {
              ...variant,
              price: target.price,
              compareAtPrice: target.compareAtPrice,
            };
          });

          const missingVariants = targetVariants.filter((variant) => {
            const signature = deriveSetSignature(variant);
            return signature.key ? !availableKeys.has(signature.key) : true;
          });

          if (missingVariants.length > 0) {
            missingSummaries.push({
              product,
              titles: missingVariants.map((variant) => variant.title),
            });
          }

          updatedProducts.push({ ...product, variants: nextVariants });
        }

        for (const { product, titles } of missingSummaries) {
          const plural = titles.length === 1 ? '' : 's';
          const combinationSummary = titles.join(', ');
          get().log(
            `Skipped ${titles.length} set variant${plural} for ${product.title} because Shopify is missing: ${combinationSummary}.`,
            'sets',
            'warning',
          );
        }

        return await commitShopifyVariantUpdates({
          scope: 'sets',
          collection: 'ensemble',
          updatedProducts,
          updatesByProduct,
          originalVariantLookup,
          noChangesMessage: 'Set variants already aligned with supplements; no Shopify update sent.',
          successLogMessage: 'Set variants updated.',
          updateLabel: 'set',
          failureLogMessage: 'Failed to push set variant updates to Shopify.',
          set,
          get,
        });
      } finally {
        get().toggleLoading('sets', false);
        toast.dismiss(loadingToastId);
      }

    },

    previewBraceletSupplementAdjustment: (percent = 0) => {
      const adjustment = Number(percent);
      const safePercent = Number.isFinite(adjustment) ? adjustment : 0;
      const { supplements } = get();

      return Object.entries(supplements.bracelets).map(([chainType, currentValue]) => {
        const current = Number(currentValue) || 0;
        const next = applySupplementPercentage(current, safePercent, { minimum: 0 });
        return {
          chainType,
          current,
          next,
          delta: next - current,
        };
      });
    },

    applyBraceletSupplementAdjustment: (percent = 0) => {
      const adjustment = Number(percent);
      const safePercent = Number.isFinite(adjustment) ? adjustment : 0;

      set((state) => {
        const updatedBracelets = Object.fromEntries(
          Object.entries(state.supplements.bracelets).map(([chainType, value]) => [
            chainType,
            applySupplementPercentage(value, safePercent, { minimum: 0 }),
          ]),
        );

        const nextSupplements = {
          ...state.supplements,
          bracelets: updatedBracelets,
        };

        return {
          supplements: nextSupplements,
          supplementChangesPending: markSupplementScopeDirty(
            state.supplementChangesPending,
            'bracelets',
          ),
        };
      });
    },

    previewNecklaceSupplementAdjustment: (options = {}) => {
      const rawSupplementPercent = Number(options?.supplementPercent);
      const rawPerCmPercent = Number(options?.perCmPercent);
      const safeSupplementPercent = Number.isFinite(rawSupplementPercent)
        ? rawSupplementPercent
        : 0;
      const safePerCmPercent = Number.isFinite(rawPerCmPercent) ? rawPerCmPercent : 0;
      const { supplements } = get();

      return Object.entries(supplements.necklaces).map(([chainType, values]) => {
        const currentSupplement = Number(values?.supplement) || 0;
        const currentPerCm = Number(values?.perCm) || 0;
        const nextSupplement = applySupplementPercentage(currentSupplement, safeSupplementPercent, {
          minimum: 0,
        });
        const nextPerCm = applySupplementPercentage(currentPerCm, safePerCmPercent, {
          strategy: 'step',
          step: 5,
          minimum: 0,
        });

        return {
          chainType,
          supplement: {
            current: currentSupplement,
            next: nextSupplement,
            delta: nextSupplement - currentSupplement,
          },
          perCm: {
            current: currentPerCm,
            next: nextPerCm,
            delta: nextPerCm - currentPerCm,
          },
        };
      });
    },

    applyNecklaceSupplementAdjustment: (options = {}) => {
      const rawSupplementPercent = Number(options?.supplementPercent);
      const rawPerCmPercent = Number(options?.perCmPercent);
      const safeSupplementPercent = Number.isFinite(rawSupplementPercent)
        ? rawSupplementPercent
        : 0;
      const safePerCmPercent = Number.isFinite(rawPerCmPercent) ? rawPerCmPercent : 0;

      set((state) => {
        const updatedNecklaces = Object.fromEntries(
          Object.entries(state.supplements.necklaces).map(([chainType, values]) => {
            const currentSupplement = Number(values?.supplement) || 0;
            const currentPerCm = Number(values?.perCm) || 0;
            const currentSizes = ensureBaseSizeOverride(values?.sizes, currentSupplement);

            const nextSupplement = applySupplementPercentage(currentSupplement, safeSupplementPercent, {
              minimum: 0,
            });
            const nextPerCm = applySupplementPercentage(currentPerCm, safePerCmPercent, {
              strategy: 'step',
              step: 5,
              minimum: 0,
            });

            const baseBefore = Number(currentSizes[DEFAULT_NECKLACE_SIZE]) || currentSupplement;

            const adjustedSizes = Object.fromEntries(
              necklaceSizes.map((size) => {
                if (size === DEFAULT_NECKLACE_SIZE) {
                  return [size, nextSupplement];
                }

                const currentSizeValue = Number(currentSizes[size]);
                const fallbackValue =
                  Number.isFinite(currentSizeValue)
                    ? currentSizeValue
                    : resolveStoredNecklaceSupplement(values, size);
                const baseDiff = fallbackValue - baseBefore;
                const adjustedDiff = applySupplementPercentage(baseDiff, safePerCmPercent, {
                  strategy: 'step',
                  step: 5,
                  minimum: 0,
                });
                const normalized = nextSupplement + adjustedDiff;
                return [size, normalized];
              }),
            );

            return [
              chainType,
              {
                supplement: nextSupplement,
                perCm: nextPerCm,
                sizes: ensureBaseSizeOverride(adjustedSizes, nextSupplement),
              },
            ];
          }),
        );

        const updatedHandChains = Object.fromEntries(
          Object.entries(updatedNecklaces).map(([chainType, values]) => [
            chainType,
            (Number(values?.supplement) || 0) * HAND_CHAIN_MULTIPLIER,
          ]),
        );

        const nextSupplements = {
          ...state.supplements,
          necklaces: updatedNecklaces,
          handChains: updatedHandChains,
        };

        return {
          supplements: nextSupplements,
          supplementChangesPending: markSupplementScopeDirty(
            state.supplementChangesPending,
            'necklaces',
          ),
        };
      });
    },

    backupSupplements: (scope) => {
      if (!['bracelets', 'necklaces'].includes(scope)) {
        return false;
      }

      const snapshot = JSON.parse(JSON.stringify(get().supplements[scope] ?? {}));

      set((state) => {
        const nextBackups = {
          ...state.supplementBackups,
          [scope]: snapshot,
        };

        persistSupplementBackups(nextBackups);

        return {
          supplementBackups: nextBackups,
        };
      });

      return true;
    },

    hasSupplementBackup: (scope) => {
      if (!['bracelets', 'necklaces'].includes(scope)) {
        return false;
      }

      const backup = get().supplementBackups?.[scope];
      return Boolean(backup);
    },

    restoreSupplementBackup: (scope) => {
      if (!['bracelets', 'necklaces'].includes(scope)) {
        return false;
      }

      const backup = get().supplementBackups?.[scope];
      if (!backup) {
        return false;
      }

      const restored = JSON.parse(JSON.stringify(backup));

      if (scope === 'bracelets') {
        set((state) => {
          const nextSupplements = {
            ...state.supplements,
            bracelets: restored,
          };

          return {
            supplements: nextSupplements,
            supplementChangesPending: markSupplementScopeDirty(
              state.supplementChangesPending,
              'bracelets',
            ),
          };
        });
        return true;
      }

      set((state) => {
        const normalizedRestored = Object.fromEntries(
          Object.entries(restored).map(([chainType, values]) => {
            const supplement = Number(values?.supplement) || 0;
            const perCm = Number(values?.perCm) || 0;
            const sizes = ensureBaseSizeOverride(
              sanitizeNecklaceSizeOverrides(values?.sizes),
              supplement,
            );

            return [
              chainType,
              {
                supplement,
                perCm,
                sizes,
              },
            ];
          }),
        );

        const updatedHandChains = Object.fromEntries(
          Object.entries(normalizedRestored).map(([chainType, values]) => [
            chainType,
            (Number(values?.supplement) || 0) * HAND_CHAIN_MULTIPLIER,
          ]),
        );

        const nextSupplements = {
          ...state.supplements,
          necklaces: normalizedRestored,
          handChains: updatedHandChains,
        };

        return {
          supplements: nextSupplements,
          supplementChangesPending: markSupplementScopeDirty(
            state.supplementChangesPending,
            'necklaces',
          ),
        };
      });

      return true;
    },

    saveSupplementChanges: async () => {
      const supplements = get().supplements;
      const result = await persistSupplements(supplements);

      if (result.success) {
        set(() => ({
          supplementChangesPending: createSupplementChangeFlags(),
        }));
      }

      return result;
    },

    updateBraceletSupplement: (title, value) => {
      set((state) => {
        const nextSupplements = {
          ...state.supplements,
          bracelets: {
            ...state.supplements.bracelets,
            [title]: value,
          },
        };

        return {
          supplements: nextSupplements,
          supplementChangesPending: markSupplementScopeDirty(
            state.supplementChangesPending,
            'bracelets',
          ),
        };
      });
    },

    updateNecklaceSupplement: (title, field, value) => {
      set((state) => {
        const currentEntry = state.supplements.necklaces[title] ?? {};
        const previousSupplement = Number(currentEntry?.supplement) || 0;
        const previousSizes = ensureBaseSizeOverride(currentEntry?.sizes, previousSupplement);

        let nextEntry = {
          ...currentEntry,
          [field]: value,
        };

        if (field === 'supplement') {
          const nextSupplement = Number(value) || 0;
          const delta = nextSupplement - previousSupplement;
          const adjustedSizes = Object.fromEntries(
            necklaceSizes.map((size) => {
              if (size === DEFAULT_NECKLACE_SIZE) {
                return [size, nextSupplement];
              }

              const currentSizeValue = Number(previousSizes[size]);
              const fallbackValue =
                Number.isFinite(currentSizeValue)
                  ? currentSizeValue
                  : resolveStoredNecklaceSupplement(currentEntry, size);

              return [size, fallbackValue + delta];
            }),
          );

          nextEntry = {
            ...nextEntry,
            supplement: nextSupplement,
            sizes: ensureBaseSizeOverride(adjustedSizes, nextSupplement),
          };
        } else if (field === 'perCm') {
          const nextPerCm = Number(value) || 0;
          const baseSupplement = Number(nextEntry?.supplement) || previousSupplement;
          const recalculatedSizes = Object.fromEntries(
            necklaceSizes.map((size) => {
              if (size === DEFAULT_NECKLACE_SIZE) {
                return [size, baseSupplement];
              }

              const delta = size - DEFAULT_NECKLACE_SIZE;
              const incremental = delta > 0 ? delta * nextPerCm : 0;
              return [size, baseSupplement + incremental];
            }),
          );

          nextEntry = {
            ...nextEntry,
            perCm: nextPerCm,
            sizes: ensureBaseSizeOverride(recalculatedSizes, baseSupplement),
          };
        } else {
          nextEntry = {
            ...nextEntry,
            sizes: ensureBaseSizeOverride(nextEntry?.sizes, Number(nextEntry?.supplement) || 0),
          };
        }

        const nextNecklaces = {
          ...state.supplements.necklaces,
          [title]: nextEntry,
        };

        const nextHandChains = {
          ...state.supplements.handChains,
          [title]: (Number(nextEntry?.supplement) || 0) * HAND_CHAIN_MULTIPLIER,
        };

        const nextSupplements = {
          ...state.supplements,
          necklaces: nextNecklaces,
          handChains: nextHandChains,
        };

        return {
          supplements: nextSupplements,
          supplementChangesPending: markSupplementScopeDirty(
            state.supplementChangesPending,
            'necklaces',
          ),
        };
      });
    },

    updateRingSupplement: (band, size, value) => {
      set((state) => ({
        supplements: {
          ...state.supplements,
          rings: {
            ...state.supplements.rings,
            [band]: {
              ...state.supplements.rings[band],
              [size]: value,
            },
          },
        },
      }));
    },

    updateHandChainSupplement: (title, value) => {
      set((state) => ({
        supplements: {
          ...state.supplements,
          handChains: {
            ...state.supplements.handChains,
            [title]: value,
          },
        },
      }));
    },
  })),
);
