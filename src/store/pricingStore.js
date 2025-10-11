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
import {
  applyPercentage,
  buildBraceletVariants,
  buildHandChainVariants,
  buildNecklaceVariants,
  buildRingVariants,
  buildSetVariants,
  buildSpecSetVariants,
} from '../utils/pricing';
import {
  parseBandType,
  parseChainName,
  parseNecklaceSize,
  parseRingSize,
} from '../utils/variantParsers';
import { toast } from '../utils/toast';

const defaultSupplements = {
  bracelets: { ...braceletChainTypes },
  necklaces: { ...necklaceChainTypes },
  rings: JSON.parse(JSON.stringify(ringBandSupplements)),
  handChains: Object.fromEntries(
    Object.entries(necklaceChainTypes).map(([title, data]) => [
      title,
      data.supplement * HAND_CHAIN_MULTIPLIER,
    ]),
  ),
};

const cloneSupplements = () => JSON.parse(JSON.stringify(defaultSupplements));

const SCOPE_COLLECTIONS = {
  global: [],
  bracelets: ['bracelet'],
  necklaces: ['collier'],
  rings: ['bague'],
  handchains: ['handchain'],
  sets: ['ensemble'],
  specSets: ['ensemble'],
};

const SCOPE_FILTERS = {
  sets: (product) => !isSpecTaggedEnsemble(product),
  specSets: (product) => isSpecTaggedEnsemble(product),
};

const shouldIncludeProductInScope = (scope, product) => {
  const predicate = SCOPE_FILTERS[scope];
  if (!predicate) {
    return true;
  }

  try {
    return predicate(product);
  } catch (error) {
    console.warn('Failed to evaluate scope predicate', { scope, productId: product?.id, error });
    return false;
  }
};

const filterProductsForScope = (scope, products = []) => {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  return products.filter((product) => shouldIncludeProductInScope(scope, product));
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

const RING_BAND_NAMES = Object.keys(ringBandSupplements);

const RING_BAND_LOOKUP = new Map(
  RING_BAND_NAMES.map((name) => [sanitizeVariantKey(name), name]),
);

const CHAIN_NAME_CACHE = new Map();
const NECKLACE_SIZE_CACHE = new Map();
const RING_BAND_CACHE = new Map();
const RING_SIZE_CACHE = new Map();

const SPEC_MODE_CANONICALS = new Map([
  ['gourmette', 'gourmette'],
  ['bracelet', 'gourmette'],
  ['bracelets', 'gourmette'],
  ['collier', 'collier'],
  ['necklace', 'collier'],
  ['necklaces', 'collier'],
  ['ensemble', 'ensemble'],
  ['set', 'ensemble'],
  ['sets', 'ensemble'],
]);

const SPEC_MODE_FALLBACK_LABELS = new Map([
  ['gourmette', 'Gourmette'],
  ['collier', 'Collier'],
  ['ensemble', 'Ensemble'],
]);

const SPEC_TAG_TOKEN = sanitizeVariantKey('spec');

const canonicalSpecMode = (value) => {
  const normalized = sanitizeVariantKey(value);
  if (!normalized) {
    return null;
  }

  return SPEC_MODE_CANONICALS.get(normalized) ?? null;
};

const buildSpecModeDisplayMap = (product) => {
  const map = new Map();

  if (Array.isArray(product?.variants)) {
    for (const variant of product.variants) {
      for (const part of collectVariantParts(variant)) {
        const canonical = canonicalSpecMode(part);
        if (canonical && !map.has(canonical)) {
          map.set(canonical, String(part).trim());
        }
      }
    }
  }

  if (Array.isArray(product?.options)) {
    for (const option of product.options) {
      if (!option || typeof option !== 'object') {
        continue;
      }

      if (Array.isArray(option.values)) {
        for (const value of option.values) {
          const canonical = canonicalSpecMode(value);
          if (canonical && !map.has(canonical)) {
            map.set(canonical, String(value ?? '').trim());
          }
        }
      }
    }
  }

  for (const [mode, fallback] of SPEC_MODE_FALLBACK_LABELS.entries()) {
    if (!map.has(mode)) {
      map.set(mode, fallback);
    }
  }

  return map;
};

const buildSpecVariantKey = (mode, chain, size) => {
  if (!mode || !chain) {
    return null;
  }

  if (mode === 'gourmette') {
    return `${mode}::${chain}`;
  }

  if ((mode === 'collier' || mode === 'ensemble') && Number.isFinite(size)) {
    return `${mode}::${chain}::${size}`;
  }

  return null;
};

const productHasSpecTag = (product) => {
  if (!SPEC_TAG_TOKEN) {
    return false;
  }

  if (!product || typeof product !== 'object' || !Array.isArray(product.tags)) {
    return false;
  }

  return product.tags.some((tag) => sanitizeVariantKey(tag) === SPEC_TAG_TOKEN);
};

const isSpecTaggedEnsemble = (product) => {
  if (!product || typeof product !== 'object') {
    return false;
  }

  const collection = typeof product.collection === 'string' ? product.collection.toLowerCase() : '';
  return collection === 'ensemble' && productHasSpecTag(product);
};

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
  const canonical = Number.isFinite(parsed) && necklaceSizes.includes(parsed) ? parsed : null;

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

const buildChainSizeKey = (chain, size) =>
  chain && Number.isFinite(size) ? `${chain}::${size}` : null;

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

const deriveHandChainKey = (variant) =>
  deriveBraceletKey(variant, 'hand chain options');

const deriveNecklaceSignature = (variant, contextLabel = 'necklace') => {
  if (!variant || typeof variant !== 'object') {
    return { key: null, chain: null, size: null };
  }

  let chain = null;
  let size = null;

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
      }
    }
  }

  return { key: buildChainSizeKey(chain, size), chain, size };
};

const deriveSetSignature = (variant) => deriveNecklaceSignature(variant, 'set');

const deriveSpecSetSignature = (variant) => {
  if (!variant || typeof variant !== 'object') {
    return { key: null, mode: null, chain: null, size: null };
  }

  let mode = canonicalSpecMode(variant.specMode);
  let chain = variant.chainType
    ? canonicalChainName(variant.chainType, 'spec set chain options')
    : null;

  let size = null;
  if (Number.isFinite(variant.size)) {
    size = variant.size;
  } else if (variant.size !== null && variant.size !== undefined) {
    const parsedSize = canonicalNecklaceSize(variant.size, 'spec set size');
    size = Number.isFinite(parsedSize) ? parsedSize : null;
  }

  for (const part of collectVariantParts(variant)) {
    if (!mode) {
      const parsedMode = canonicalSpecMode(part);
      if (parsedMode) {
        mode = parsedMode;
        continue;
      }
    }

    if (!chain && !hasDigits(part)) {
      const parsedChain = canonicalChainName(part, 'spec set chain options');
      if (parsedChain) {
        chain = parsedChain;
        continue;
      }
    }

    if (mode && mode !== 'gourmette' && !Number.isFinite(size)) {
      const parsedSize = canonicalNecklaceSize(part, 'spec set size');
      if (Number.isFinite(parsedSize)) {
        size = parsedSize;
        continue;
      }
    }
  }

  if (mode === 'gourmette') {
    return { key: buildSpecVariantKey(mode, chain, null), mode, chain, size: null };
  }

  if (mode === 'collier' || mode === 'ensemble') {
    return {
      key: buildSpecVariantKey(mode, chain, size),
      mode,
      chain,
      size: Number.isFinite(size) ? size : null,
    };
  }

  return { key: null, mode, chain, size: Number.isFinite(size) ? size : null };
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

const alignSetVariantOptions = (product) => {
  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  if (isSpecTaggedEnsemble(product)) {
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

const alignSpecSetVariantOptions = (product) => {
  if (!isSpecTaggedEnsemble(product)) {
    return null;
  }

  if (!Array.isArray(product?.variants) || product.variants.length === 0) {
    return null;
  }

  const chainMap = buildChainMetafieldMap(product, 'Chain Variants', 'spec set chain options');
  const sizeMap = buildNecklaceSizeMetafieldMap(product, 'Taille de chaine', 'spec set size options');
  const modeMap = buildSpecModeDisplayMap(product);

  if (chainMap.size === 0 || modeMap.size === 0) {
    return null;
  }

  let applied = false;
  let changed = false;

  const updatedVariants = product.variants.map((variant) => {
    const signature = deriveSpecSetSignature(variant);
    const mode = signature.mode;
    const chain = signature.chain;
    const size = signature.size;

    if (!mode || !chain) {
      return variant;
    }

    const modeDisplay = modeMap.get(mode);
    const chainDisplay = chainMap.get(chain);
    if (!modeDisplay || !chainDisplay) {
      return variant;
    }

    let nextOptions = null;

    if (mode === 'gourmette') {
      nextOptions = [modeDisplay, chainDisplay];
    } else {
      if (!Number.isFinite(size)) {
        return variant;
      }

      const sizeDisplay = sizeMap.get(size);
      if (!sizeDisplay) {
        return variant;
      }

      nextOptions = [modeDisplay, chainDisplay, sizeDisplay];
    }

    if (!nextOptions) {
      return variant;
    }

    applied = true;

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
    username: null,
    language: 'en',
    products: mockProducts,
    productsInitialized: false,
    productsSyncing: false,
    supplements: cloneSupplements(),
    backups: {},
    logs: [],
    loadingScopes: new Set(),

    setUsername: (username) => set({ username }),
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
        const next = new Set(state.loadingScopes);
        if (loading) {
          next.add(scope);
        } else {
          next.delete(scope);
        }
        return { loadingScopes: next };
      });
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

    alignSpecSetVariantsFromMetafields: () =>
      alignVariantsFromMetafields(
        {
          scope: 'specSets',
          collection: 'ensemble',
          label: 'spec set',
          alignProduct: alignSpecSetVariantOptions,
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
        const remoteProducts = await fetchProductsByCollections(collections);
        const scopedRemoteProducts = filterProductsForScope(scope, remoteProducts);
        const collectionSet = buildCollectionSet(scope);
        const currentProducts = get().products;
        const mergedProducts = mergeProductsForScope(
          currentProducts,
          scopedRemoteProducts,
          collectionSet,
        );
        const backupPayload = {
          timestamp: new Date().toISOString(),
          products: cloneProducts(scopedRemoteProducts),
        };

        set((state) => ({
          products: mergedProducts,
          backups: {
            ...state.backups,
            [scope]: backupPayload,
          },
        }));

        const count = scopedRemoteProducts.length;
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
        toast.dismiss(loadingToastId);
        get().toggleLoading(scope, false);
      }
    },

    restoreScope: async (scope) => {
      if (!(scope in SCOPE_COLLECTIONS)) {
        get().log('Unknown restore scope requested.', scope, 'error');
        return;
      }

      const backupEntry = get().backups[scope];
      if (!backupEntry?.products) {
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
      const scopePredicate = SCOPE_FILTERS[scope];
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

        if (scopePredicate && !scopePredicate(product)) {
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
        if (!shouldIncludeProductInScope(scope, backupProduct)) {
          continue;
        }

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
        toast.dismiss(restoreToastId);
        get().toggleLoading(scope, false);
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
          return;
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

        await commitShopifyVariantUpdates({
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
        toast.dismiss(loadingToastId);
        get().toggleLoading('global', false);
      }
    },
    previewBracelets: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'bracelet' && product.status === 'active')
        .map((product) => {
          const lookup = new Map();
          for (const existingVariant of product.variants) {
            const key = deriveBraceletKey(existingVariant);
            if (key) {
              lookup.set(key, existingVariant);
            }
          }

          return {
            product,
            updatedBasePrice: product.basePrice,
            updatedCompareAtPrice: product.baseCompareAtPrice,
            variants: buildBraceletVariants(product, supplements.bracelets).map((variant) => {
              const key = deriveBraceletKey(variant);
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
            const key = deriveBraceletKey(target);
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

            const key = deriveBraceletKey(variant);
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
            const key = deriveBraceletKey(variant);
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
            `Skipped ${titles.length} bracelet variant${plural} for ${product.title} because Shopify is missing: ${combinationSummary}.`,
            'bracelets',
            'warning',
          );
        }

        await commitShopifyVariantUpdates({
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
        toast.dismiss(loadingToastId);
        get().toggleLoading('bracelets', false);
      }
    },

    previewNecklaces: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'collier' && product.status === 'active')
        .map((product) => {
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
            variants: buildNecklaceVariants(product, supplements.necklaces).map((variant) => {
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

          const targetVariants = buildNecklaceVariants(product, supplements.necklaces);
          const targetByKey = new Map();

          for (const target of targetVariants) {
            const signature = deriveNecklaceSignature(target);
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

            const signature = deriveNecklaceSignature(variant);
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
            const signature = deriveNecklaceSignature(variant);
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
            `Skipped ${titles.length} necklace variant${plural} for ${product.title} because Shopify is missing: ${combinationSummary}.`,
            'necklaces',
            'warning',
          );
        }

        await commitShopifyVariantUpdates({
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
        toast.dismiss(loadingToastId);
        get().toggleLoading('necklaces', false);
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

        await commitShopifyVariantUpdates({
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
        toast.dismiss(loadingToastId);
        get().toggleLoading('rings', false);
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

        await commitShopifyVariantUpdates({
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
        toast.dismiss(loadingToastId);
        get().toggleLoading('handchains', false);
      }

    },

    previewSets: () => {
      const { products, supplements } = get();
      return products
        .filter(
          (product) =>
            product.collection === 'ensemble' &&
            product.status === 'active' &&
            !isSpecTaggedEnsemble(product),
        )
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

    previewSpecSets: () => {
      const { products, supplements } = get();
      return products
        .filter(
          (product) =>
            product.collection === 'ensemble' &&
            product.status === 'active' &&
            shouldIncludeProductInScope('specSets', product),
        )
        .map((product) => {
          const lookup = new Map();
          for (const existingVariant of product.variants) {
            const signature = deriveSpecSetSignature(existingVariant);
            if (signature.key) {
              lookup.set(signature.key, existingVariant);
            }
          }

          const modeDisplays = buildSpecModeDisplayMap(product);

          const targetVariants = buildSpecSetVariants(
            product,
            supplements.bracelets,
            supplements.necklaces,
            {
              braceletModeLabel:
                modeDisplays.get('gourmette') ?? SPEC_MODE_FALLBACK_LABELS.get('gourmette'),
              necklaceModeLabel:
                modeDisplays.get('collier') ?? SPEC_MODE_FALLBACK_LABELS.get('collier'),
              setModeLabel:
                modeDisplays.get('ensemble') ?? SPEC_MODE_FALLBACK_LABELS.get('ensemble'),
            },
          );

          return {
            product,
            updatedBasePrice: product.basePrice,
            updatedCompareAtPrice: product.baseCompareAtPrice,
            variants: targetVariants.map((variant) => {
              const signature = deriveSpecSetSignature(variant);
              const currentVariant = signature.key ? lookup.get(signature.key) : null;
              const matched = Boolean(currentVariant);
              const targetPrice = toNumberOrNull(variant.price);
              const targetCompare = toNumberOrNull(variant.compareAtPrice);
              const previousPrice = matched ? resolveVariantPrice(currentVariant, product) : null;
              const previousCompare = matched
                ? resolveVariantCompareAt(currentVariant, product)
                : null;
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
          if (product.collection !== 'ensemble' || isSpecTaggedEnsemble(product)) {
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

        await commitShopifyVariantUpdates({
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
        toast.dismiss(loadingToastId);
        get().toggleLoading('sets', false);
      }

    },

    applySpecSets: async () => {
      get().toggleLoading('specSets', true);
      const loadingToastId = toast.loading('Applying spec set pricing...');

      try {
        const { products, supplements } = get();

        const updatedProducts = [];
        const updatesByProduct = new Map();
        const originalVariantLookup = new Map();
        const missingSummaries = [];

        for (const product of products) {
          if (
            product.collection !== 'ensemble' ||
            !shouldIncludeProductInScope('specSets', product)
          ) {
            updatedProducts.push(product);
            continue;
          }

          const modeDisplays = buildSpecModeDisplayMap(product);
          const targetVariants = buildSpecSetVariants(
            product,
            supplements.bracelets,
            supplements.necklaces,
            {
              braceletModeLabel:
                modeDisplays.get('gourmette') ?? SPEC_MODE_FALLBACK_LABELS.get('gourmette'),
              necklaceModeLabel:
                modeDisplays.get('collier') ?? SPEC_MODE_FALLBACK_LABELS.get('collier'),
              setModeLabel:
                modeDisplays.get('ensemble') ?? SPEC_MODE_FALLBACK_LABELS.get('ensemble'),
            },
          );
          const targetByKey = new Map();

          for (const target of targetVariants) {
            const signature = deriveSpecSetSignature(target);
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

            const signature = deriveSpecSetSignature(variant);
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

          const missingVariants = targetVariants.filter((target) => {
            const signature = deriveSpecSetSignature(target);
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
          const summary = titles.join(', ');
          get().log(
            `Skipped ${titles.length} spec set variant${plural} for ${product.title} because Shopify is missing: ${summary}.`,
            'specSets',
            'warning',
          );
        }

        await commitShopifyVariantUpdates({
          scope: 'specSets',
          collection: 'ensemble',
          updatedProducts,
          updatesByProduct,
          originalVariantLookup,
          noChangesMessage:
            'Spec set variants already aligned with supplements; no Shopify update sent.',
          successLogMessage: 'Spec set variants updated.',
          updateLabel: 'spec set',
          failureLogMessage: 'Failed to push spec set variant updates to Shopify.',
          set,
          get,
        });
      } finally {
        toast.dismiss(loadingToastId);
        get().toggleLoading('specSets', false);
      }
    },

    updateBraceletSupplement: (title, value) => {
      set((state) => ({
        supplements: {
          ...state.supplements,
          bracelets: {
            ...state.supplements.bracelets,
            [title]: value,
          },
        },
      }));
    },

    updateNecklaceSupplement: (title, field, value) => {
      set((state) => ({
        supplements: {
          ...state.supplements,
          necklaces: {
            ...state.supplements.necklaces,
            [title]: {
              ...state.supplements.necklaces[title],
              [field]: value,
            },
          },
          handChains: {
            ...state.supplements.handChains,
            [title]:
              field === 'supplement'
                ? value * HAND_CHAIN_MULTIPLIER
                : state.supplements.handChains[title],
          },
        },
      }));
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
