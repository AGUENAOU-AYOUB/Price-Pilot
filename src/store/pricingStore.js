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

    restoreScope: (scope) => {
      const backup = get().backups[scope];
      if (!backup) {
        get().log('No backup available to restore.', scope);
        return;
      }
      set({
        products: backup.map((product) => ({
          ...product,
          variants: product.variants.map((variant) => ({ ...variant })),
        })),
      });
      get().log('Backup restored successfully.', scope);
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

    applyBracelets: () => {
      const { products, supplements } = get();
      const updated = products.map((product) => {
        if (product.collection !== 'bracelet') return product;
        const variants = buildBraceletVariants(product, supplements.bracelets);
        return { ...product, variants };
      });
      set({ products: updated });
      get().log('Bracelet variants updated.', 'bracelets');
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

    applyNecklaces: () => {
      const { products, supplements } = get();
      const updated = products.map((product) => {
        if (product.collection !== 'collier') return product;
        const variants = buildNecklaceVariants(product, supplements.necklaces);
        return { ...product, variants };
      });
      set({ products: updated });
      get().log('Necklace variants updated.', 'necklaces');
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

      const updatesPayload = Array.from(updatesByProduct.values());

      if (!hasShopifyProxy()) {
        get().log('Shopify proxy missing; ring changes applied locally only.', 'rings');
        set({ products: updatedProducts });
        get().log('Ring variants updated.', 'rings');
        return;
      }

      if (updatesPayload.length === 0) {
        set({ products: updatedProducts });
        get().log('Ring variants already aligned with supplements; no Shopify update sent.', 'rings');
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
          if (product.collection !== 'bague' || failedVariantIds.size === 0) {
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
        const updatedCount = Number.isFinite(result?.updatedCount)
          ? result.updatedCount
          : 0;

        if (failedCount > 0) {
          get().log(
            `Updated ${updatedCount} Shopify ring variants with ${failedCount} failures.`,
            'rings',
          );
          for (const failure of failures) {
            get().log(
              `Failed to update variant ${failure.variantId} for ${failure.productTitle}: ${failure.reason}`,
              'rings',
            );
          }
        } else {
          get().log(`Updated ${updatedCount} Shopify ring variants.`, 'rings');
        }
        if (updatedCount > 0) {
          get().log('Ring variants updated.', 'rings');
        }
      } catch (error) {
        console.error('Failed to push ring variant updates to Shopify', error);
        get().log('Failed to push ring variant updates to Shopify.', 'rings');
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

    applyHandChains: () => {
      const { products, supplements } = get();
      const updated = products.map((product) => {
        if (product.collection !== 'handchain') return product;
        const variants = buildHandChainVariants(product, supplements.handChains);
        return { ...product, variants };
      });
      set({ products: updated });
      get().log('Hand chain variants updated.', 'handchains');
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

    applySets: () => {
      const { products, supplements } = get();
      const updated = products.map((product) => {
        if (product.collection !== 'ensemble') return product;
        const variants = buildSetVariants(
          product,
          supplements.bracelets,
          supplements.necklaces,
        );
        return { ...product, variants };
      });
      set({ products: updated });
      get().log('Set variants updated.', 'sets');
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
