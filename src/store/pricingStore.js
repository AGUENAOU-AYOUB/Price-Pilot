import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  braceletChainTypes,
  HAND_CHAIN_MULTIPLIER,
  necklaceChainTypes,
  ringBandSupplements,
  ringSizes,
} from '../data/supplements';
import { mockProducts } from '../data/products';
import { hasShopifyProxy } from '../config/shopify';
import { fetchActiveProducts, pushVariantUpdates } from '../services/shopify';
import {
  applyPercentage,
  buildBraceletVariants,
  buildHandChainVariants,
  buildNecklaceVariants,
  buildRingVariants,
  buildSetVariants,
} from '../utils/pricing';

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

const escapeRegExp = (value) => value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

const RING_BAND_PATTERNS = Object.keys(ringBandSupplements).map((band) => ({
  canonical: band,
  regex: new RegExp(`\\b${escapeRegExp(band)}\\b`, 'i'),
}));

const RING_SIZE_PATTERNS = ringSizes.map((size) => ({
  canonical: size,
  regex: new RegExp(`\\b${escapeRegExp(size)}\\b`, 'i'),
}));

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

const collectVariantKeyCandidates = (variant) => {
  const candidates = new Set();

  if (variant?.title) {
    const key = sanitizeVariantKey(variant.title);
    if (key) {
      candidates.add(key);
    }
  }

  if (Array.isArray(variant?.options) && variant.options.length > 0) {
    const combined = sanitizeVariantKey(variant.options.join(' '));
    if (combined) {
      candidates.add(combined);
    }

    if (variant.options.length >= 2) {
      const firstTwo = sanitizeVariantKey(variant.options.slice(0, 2).join(' '));
      if (firstTwo) {
        candidates.add(firstTwo);
      }
    }

    for (const option of variant.options) {
      const optionKey = sanitizeVariantKey(option);
      if (optionKey) {
        candidates.add(optionKey);
      }
    }
  }

  return Array.from(candidates);
};

const matchVariantKey = (variant, targetByKey) => {
  for (const candidate of collectVariantKeyCandidates(variant)) {
    if (targetByKey.has(candidate)) {
      return candidate;
    }
  }

  return null;
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
  const proxyMissingMessage = `Shopify proxy missing; ${updateLabel} changes applied locally only.`;

  if (!hasShopifyProxy()) {
    get().log(proxyMissingMessage, scope);
    set({ products: updatedProducts });
    get().log(successLogMessage, scope);
    return;
  }

  if (updatesPayload.length === 0) {
    set({ products: updatedProducts });
    get().log(noChangesMessage, scope);
    return;
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
      if (product.collection !== collection || failedVariantIds.size === 0) {
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

    if (updatedCount > 0) {
      get().log(successLogMessage, scope);
    }
  } catch (error) {
    console.error(failureLogMessage, error);
    get().log(failureLogMessage, scope);
  }
};

const findRingBand = (value) => {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  for (const pattern of RING_BAND_PATTERNS) {
    if (pattern.regex.test(text)) {
      return pattern.canonical;
    }
  }

  return null;
};

const findRingSize = (value) => {
  if (!value) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  for (const pattern of RING_SIZE_PATTERNS) {
    if (pattern.regex.test(text)) {
      return pattern.canonical;
    }
  }

  return null;
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

const deriveRingIdentity = (variant) => {
  if (!variant || typeof variant !== 'object') {
    return { key: null, band: null, size: null };
  }

  if (variant.band && variant.size) {
    const key = buildRingKey(variant.band, variant.size);
    if (key) {
      return { key, band: variant.band, size: variant.size };
    }
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

    let band = null;
    let size = null;

    for (const part of parts) {
      if (!band) {
        band = findRingBand(part);
      }
      if (!size) {
        size = findRingSize(part);
      }
    }

    if (band && size) {
      return { key: buildRingKey(band, size), band, size };
    }
  }

  return { key: null, band: null, size: null };
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

    backupScope: (scope) => {
      const products = get().products.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({ ...variant })),
      }));
      set((state) => ({
        backups: {
          ...state.backups,
          [scope]: products,
        },
      }));
      get().log('Backup completed successfully.', scope);
    },

    restoreScope: async (scope) => {
      const backup = get().backups[scope];
      if (!backup) {
        get().log('No backup available to restore.', scope);
        return;
      }

      const clonedBackup = backup.map((product) => ({
        ...product,
        variants: Array.isArray(product.variants)
          ? product.variants.map((variant) => ({ ...variant }))
          : [],
      }));

      if (scope !== 'rings') {
        set({ products: clonedBackup });
        get().log('Backup restored successfully.', scope);
        return;
      }

      if (!hasShopifyProxy()) {
        set({ products: clonedBackup });
        get().log('Shopify proxy missing; ring backup restored locally only.', 'rings');
        get().log('Backup restored successfully.', scope);
        return;
      }

      const currentProducts = get().products;
      const currentProductsById = new Map(currentProducts.map((product) => [product.id, product]));
      const updatesByProduct = new Map();
      const currentVariantsByProduct = new Map();

      for (const product of clonedBackup) {
        if (product.collection !== 'bague') {
          continue;
        }

        const currentProduct = currentProductsById.get(product.id);
        if (!currentProduct) {
          continue;
        }

        const currentVariantLookup = new Map(
          (Array.isArray(currentProduct.variants) ? currentProduct.variants : []).map((variant) => [
            String(variant?.id ?? ''),
            { ...variant },
          ]),
        );

        currentVariantsByProduct.set(product.id, currentVariantLookup);

        for (const targetVariant of Array.isArray(product.variants) ? product.variants : []) {
          const variantId = String(targetVariant?.id ?? '');
          if (!variantId) {
            continue;
          }

          const currentVariant = currentVariantLookup.get(variantId);
          if (!currentVariant) {
            continue;
          }

          const priceChanged = currentVariant.price !== targetVariant.price;
          const compareChanged =
            currentVariant.compareAtPrice !== targetVariant.compareAtPrice;

          if (!priceChanged && !compareChanged) {
            continue;
          }

          if (!updatesByProduct.has(product.id)) {
            updatesByProduct.set(product.id, {
              productId: product.id,
              productTitle: product.title,
              variants: [],
            });
          }

          updatesByProduct.get(product.id).variants.push({
            id: variantId,
            price: targetVariant.price,
            compareAtPrice: targetVariant.compareAtPrice,
          });
        }
      }

      const updatesPayload = Array.from(updatesByProduct.values());

      if (updatesPayload.length === 0) {
        set({ products: clonedBackup });
        get().log('Ring variants already match the backup; no Shopify update sent.', 'rings');
        get().log('Backup restored successfully.', scope);
        return;
      }

      get().toggleLoading('rings', true);

      try {
        const result = await pushVariantUpdates(updatesPayload);
        const failures = Array.isArray(result?.failures) ? result.failures : [];
        const failedVariantIds = new Set(
          failures
            .map((failure) => (failure?.variantId ? String(failure.variantId) : ''))
            .filter(Boolean),
        );
        const attemptedCount = updatesPayload.reduce(
          (total, entry) => total + entry.variants.length,
          0,
        );

        const finalProducts = clonedBackup.map((product) => {
          if (product.collection !== 'bague' || failedVariantIds.size === 0) {
            return product;
          }

          const currentVariantLookup = currentVariantsByProduct.get(product.id);
          if (!currentVariantLookup) {
            return product;
          }

          const nextVariants = product.variants.map((variant) => {
            const variantId = String(variant?.id ?? '');
            if (!variantId || !failedVariantIds.has(variantId)) {
              return variant;
            }

            const fallback = currentVariantLookup.get(variantId);
            return fallback ? { ...fallback } : variant;
          });

          return { ...product, variants: nextVariants };
        });

        set({ products: finalProducts });

        const failedCount = Number.isFinite(result?.failedCount)
          ? result.failedCount
          : failedVariantIds.size;
        const updatedCount = Number.isFinite(result?.updatedCount)
          ? result.updatedCount
          : Math.max(attemptedCount - failedVariantIds.size, 0);

        if (failedCount > 0) {
          get().log(
            `Restored ${updatedCount} Shopify ring variants with ${failedCount} failures.`,
            'rings',
          );
          for (const failure of failures) {
            get().log(
              `Failed to restore variant ${failure.variantId} for ${failure.productTitle}: ${failure.reason}`,
              'rings',
            );
          }
        } else {
          get().log(`Restored ${updatedCount} Shopify ring variants.`, 'rings');
        }

        get().log('Backup restored successfully.', scope);
      } catch (error) {
        console.error('Failed to restore ring backup to Shopify', error);
        get().log('Failed to restore ring backup on Shopify.', 'rings');
      } finally {
        get().toggleLoading('rings', false);
      }
    },

    previewGlobalChange: (percent) => {
      const { products } = get();
      return products.map((product) => ({
        product,
        updatedBasePrice: applyPercentage(product.basePrice, percent),
        updatedCompareAtPrice: applyPercentage(product.baseCompareAtPrice, percent),
        variants: product.variants.map((variant) => ({
          ...variant,
          price: applyPercentage(variant.price, percent),
          compareAtPrice: applyPercentage(variant.compareAtPrice, percent),
        })),
      }));
    },

    applyGlobalChange: (percent) => {
      const { products } = get();
      const updated = products.map((product) => ({
        ...product,
        basePrice: applyPercentage(product.basePrice, percent),
        baseCompareAtPrice: applyPercentage(product.baseCompareAtPrice, percent),
        variants: product.variants.map((variant) => ({
          ...variant,
          price: applyPercentage(variant.price, percent),
          compareAtPrice: applyPercentage(variant.compareAtPrice, percent),
        })),
      }));
      set({ products: updated });
      get().log(`Applied global ${percent}% adjustment.`, 'global');
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
          const key = sanitizeVariantKey(target.title);
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

          const key = matchVariantKey(variant, targetByKey);
          if (key) {
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
          const key = sanitizeVariantKey(variant.title);
          return key ? !availableKeys.has(key) : false;
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
          const key = sanitizeVariantKey(target.title);
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

          const key = matchVariantKey(variant, targetByKey);
          if (key) {
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
          const key = sanitizeVariantKey(variant.title);
          return key ? !availableKeys.has(key) : false;
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
          const key = sanitizeVariantKey(target.title);
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

          const key = matchVariantKey(variant, targetByKey);
          if (key) {
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
          const key = sanitizeVariantKey(variant.title);
          return key ? !availableKeys.has(key) : false;
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
          const key = sanitizeVariantKey(target.title);
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

          const key = matchVariantKey(variant, targetByKey);
          if (key) {
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
          const key = sanitizeVariantKey(variant.title);
          return key ? !availableKeys.has(key) : false;
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
