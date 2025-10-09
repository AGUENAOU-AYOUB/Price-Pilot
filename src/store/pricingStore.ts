import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  braceletChainTypes,
  HAND_CHAIN_MULTIPLIER,
  necklaceChainTypes,
  RingBandType,
  RingSize,
  ringBandSupplements,
} from '../data/supplements';
import { mockProducts, ProductRecord } from '../data/products';
import {
  buildBraceletVariants,
  buildHandChainVariants,
  buildNecklaceVariants,
  buildRingVariants,
  buildSetVariants,
  PricingPreview,
  applyPercentage,
} from '../utils/pricing';

export type PricingLogEntry = {
  id: string;
  message: string;
  timestamp: string;
  variantScope: 'global' | 'bracelets' | 'necklaces' | 'rings' | 'handchains' | 'sets';
};

export type SupplementState = {
  bracelets: Record<string, number>;
  necklaces: Record<string, { supplement: number; perCm: number }>;
  rings: typeof ringBandSupplements;
  handChains: Record<string, number>;
};

export interface PricingStore {
  username: string | null;
  language: 'en' | 'fr';
  products: ProductRecord[];
  supplements: SupplementState;
  backups: Record<string, ProductRecord[]>;
  logs: PricingLogEntry[];
  loadingScopes: Set<PricingLogEntry['variantScope']>;
  setUsername: (username: string | null) => void;
  setLanguage: (language: 'en' | 'fr') => void;
  previewGlobalChange: (percent: number) => PricingPreview[];
  applyGlobalChange: (percent: number) => void;
  backupScope: (scope: PricingLogEntry['variantScope']) => void;
  restoreScope: (scope: PricingLogEntry['variantScope']) => void;
  previewBracelets: () => PricingPreview[];
  applyBracelets: () => void;
  previewNecklaces: () => PricingPreview[];
  applyNecklaces: () => void;
  previewRings: () => PricingPreview[];
  applyRings: () => void;
  previewHandChains: () => PricingPreview[];
  applyHandChains: () => void;
  previewSets: () => PricingPreview[];
  applySets: () => void;
  updateBraceletSupplement: (title: string, value: number) => void;
  updateNecklaceSupplement: (
    title: string,
    field: 'supplement' | 'perCm',
    value: number,
  ) => void;
  updateRingSupplement: (
    band: RingBandType,
    size: RingSize,
    value: number,
  ) => void;
  updateHandChainSupplement: (title: string, value: number) => void;
  log: (message: string, scope: PricingLogEntry['variantScope']) => void;
  toggleLoading: (scope: PricingLogEntry['variantScope'], loading: boolean) => void;
}

const defaultSupplements: SupplementState = {
  bracelets: { ...braceletChainTypes },
  necklaces: { ...necklaceChainTypes },
  rings: JSON.parse(JSON.stringify(ringBandSupplements)) as typeof ringBandSupplements,
  handChains: Object.fromEntries(
    Object.entries(necklaceChainTypes).map(([title, data]) => [
      title,
      data.supplement * HAND_CHAIN_MULTIPLIER,
    ]),
  ),
};

export const usePricingStore = create<PricingStore>()(
  devtools((set, get) => ({
    username: null,
    language: 'en',
    products: mockProducts,
    supplements: defaultSupplements,
    backups: {},
    logs: [],
    loadingScopes: new Set(),
    setUsername: (username) => set({ username }),
    setLanguage: (language) => set({ language }),
    log: (message, scope) => {
      const entry: PricingLogEntry = {
        id: crypto.randomUUID(),
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
      set({ products: backup.map((product) => ({
        ...product,
        variants: product.variants.map((variant) => ({ ...variant })),
      })) });
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
  }))
);
