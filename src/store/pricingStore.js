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
} from '../utils/pricing';
import {
  parseBandType,
  parseChainName,
  parseNecklaceSize,
  parseRingSize,
} from '../utils/variantParsers';

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
};

const cloneVariant = (variant) => ({ ...variant });

const cloneProduct = (product) => ({
  ...product,
  variants: Array.isArray(product?.variants)
    ? product.variants.map((variant) => cloneVariant({ ...variant }))
    : [],
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
  const canonical = normalized ? CHAIN_LOOKUP.get(normalized) : null;

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
    get().log(proxyMissingMessage, scope);
    return { success: false, reason: 'missing-proxy' };
  }

  if (updatesPayload.length === 0) {
    set({ products: updatedProducts });
    get().log(noChangesMessage, scope);
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
      get().log(`Updated ${updatedCount} Shopify ${updateLabel} variants with ${failedCount} failures.`, scope);
      for (const failure of failures) {
        get().log(
          `Failed to update variant ${failure.variantId} for ${failure.productTitle}: ${failure.reason}`,
          scope,
        );
      }
    } else {
      get().log(`Updated ${updatedCount} Shopify ${updateLabel} variants.`, scope);
    }

    if (updatedCount > 0 && failedCount === 0) {
      get().log(successLogMessage, scope);
    }

    return {
      success: failedCount === 0,
      updatedCount,
      failedCount,
      failures,
    };
  } catch (error) {
    console.error(failureLogMessage, error);
    get().log(failureLogMessage, scope);
    return { success: false, reason: 'request-failed', error };
  }
};

const splitVariantDescriptor = (value) => {
  if (!value) {
    return [];
  }

  return String(value)
    .split(/[\/•|]/)
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

    log: (message, scope) => {
      const entry = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)),
        message,
        variantScope: scope,
        timestamp: new Date().toISOString(),
      };
      set((state) => ({ logs: [entry, ...state.logs].slice(0, 200) }));
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

    syncProductsFromShopify: async () => {
      if (get().productsSyncing || get().productsInitialized) {
        return;
      }

      if (!hasShopifyProxy()) {
        get().log('Shopify proxy missing; using local mock catalog.', 'catalog');
        set({ productsInitialized: true });
        return;
      }

      set({ productsSyncing: true });
      get().toggleLoading('catalog', true);

      try {
        const products = await fetchActiveProducts();
        set({ products });
        if (products.length === 0) {
          get().log('No active Shopify products found for this store.', 'catalog');
        } else {
          get().log(`Loaded ${products.length} Shopify products.`, 'catalog');
        }
      } catch (error) {
        console.error('Failed to synchronize Shopify products', error);
        get().log('Failed to load Shopify products. Using mock catalog.', 'catalog');
        set({ products: mockProducts });
      } finally {
        get().toggleLoading('catalog', false);
        set({ productsInitialized: true, productsSyncing: false });
      }
    },

    backupScope: async (scope) => {
      if (!(scope in SCOPE_COLLECTIONS)) {
        get().log('Unknown backup scope requested.', scope);
        return;
      }

      if (!hasShopifyProxy()) {
        get().log('Shopify proxy missing; unable to capture live backup.', scope);
        return;
      }

      get().toggleLoading(scope, true);

      try {
        const collections = SCOPE_COLLECTIONS[scope] ?? [];
        const remoteProducts = await fetchProductsByCollections(collections);
        const collectionSet = buildCollectionSet(scope);
        const currentProducts = get().products;
        const mergedProducts = mergeProductsForScope(currentProducts, remoteProducts, collectionSet);
        const backupPayload = {
          timestamp: new Date().toISOString(),
          products: cloneProducts(remoteProducts),
        };

        set((state) => ({
          products: mergedProducts,
          backups: {
            ...state.backups,
            [scope]: backupPayload,
          },
        }));

        const count = remoteProducts.length;
        const plural = count === 1 ? '' : 's';
        get().log(
          `Captured Shopify backup with ${count} product${plural} for ${scope}.`,
          scope,
        );
      } catch (error) {
        console.error('Failed to capture Shopify backup', error);
        get().log('Failed to capture Shopify backup. Verify proxy connection.', scope);
      } finally {
        get().toggleLoading(scope, false);
      }
    },

    restoreScope: async (scope) => {
      if (!(scope in SCOPE_COLLECTIONS)) {
        get().log('Unknown restore scope requested.', scope);
        return;
      }

      const backupEntry = get().backups[scope];
      if (!backupEntry?.products) {
        get().log('No backup available to restore.', scope);
        return;
      }

      if (!hasShopifyProxy()) {
        get().log('Shopify proxy missing; unable to restore backup to Shopify.', scope);
        return;
      }

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
          get().log('Backup restored successfully.', scope);
        } else if (result.failedCount > 0) {
          get().log('Backup restore completed with Shopify errors. Review logs for details.', scope);
        }
      } finally {
        get().toggleLoading(scope, false);
      }
    },
    previewBracelets: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'bracelet' && product.status === 'active')
        .map((product) => ({
          product,
          updatedBasePrice: product.basePrice,
          updatedCompareAtPrice: product.baseCompareAtPrice,
          variants: buildBraceletVariants(product, supplements.bracelets),
        }));
    },

    applyBracelets: async () => {
      get().toggleLoading('bracelets', true);

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
        get().toggleLoading('bracelets', false);
      }
    },

    previewNecklaces: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'collier' && product.status === 'active')
        .map((product) => ({
          product,
          updatedBasePrice: product.basePrice,
          updatedCompareAtPrice: product.baseCompareAtPrice,
          variants: buildNecklaceVariants(product, supplements.necklaces),
        }));
    },

    applyNecklaces: async () => {
      get().toggleLoading('necklaces', true);

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
        get().toggleLoading('necklaces', false);
      }
    },

    previewRings: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'bague' && product.status === 'active')
        .map((product) => ({
          product,
          updatedBasePrice: product.basePrice,
          updatedCompareAtPrice: product.baseCompareAtPrice,
          variants: buildRingVariants(product, supplements.rings),
        }));
    },

    applyRings: async () => {
      get().toggleLoading('rings', true);

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
        get().toggleLoading('rings', false);
      }

    },

    previewHandChains: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'handchain' && product.status === 'active')
        .map((product) => ({
          product,
          updatedBasePrice: product.basePrice,
          updatedCompareAtPrice: product.baseCompareAtPrice,
          variants: buildHandChainVariants(product, supplements.handChains),
        }));
    },

    applyHandChains: async () => {
      get().toggleLoading('handchains', true);

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
        get().toggleLoading('handchains', false);
      }

    },

    previewSets: () => {
      const { products, supplements } = get();
      return products
        .filter((product) => product.collection === 'ensemble' && product.status === 'active')
        .map((product) => ({
          product,
          updatedBasePrice: product.basePrice,
          updatedCompareAtPrice: product.baseCompareAtPrice,
          variants: buildSetVariants(product, supplements.bracelets, supplements.necklaces),
        }));
    },

    applySets: async () => {
      get().toggleLoading('sets', true);

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
        get().toggleLoading('sets', false);
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
