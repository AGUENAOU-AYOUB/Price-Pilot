import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  braceletChainTypes,
  HAND_CHAIN_MULTIPLIER,
  necklaceChainTypes,
  ringBandSupplements,
} from '../data/supplements';
import { mockProducts } from '../data/products';
import { hasShopifyProxy } from '../config/shopify';
import { fetchActiveProducts } from '../services/shopify';
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

    applyRings: () => {
      const { products, supplements } = get();
      const updated = products.map((product) => {
        if (product.collection !== 'bague') return product;
        const variants = buildRingVariants(product, supplements.rings);
        return { ...product, variants };
      });
      set({ products: updated });
      get().log('Ring variants updated.', 'rings');
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
