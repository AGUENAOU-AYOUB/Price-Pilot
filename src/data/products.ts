export type ProductTag = 'brac' | 'nckl' | 'rng' | 'hand' | 'set';

export interface ProductVariant {
  id: string;
  title: string;
  price: number;
  compareAtPrice: number;
}

export interface ProductRecord {
  id: string;
  title: string;
  collection: 'bracelet' | 'collier' | 'bague' | 'handchain' | 'ensemble';
  tags: ProductTag[];
  basePrice: number;
  baseCompareAtPrice: number;
  variants: ProductVariant[];
  status: 'active' | 'draft';
}

export const mockProducts: ProductRecord[] = [
  {
    id: 'bracelet-1',
    title: 'Aurora Bracelet',
    collection: 'bracelet',
    tags: ['brac'],
    basePrice: 1500,
    baseCompareAtPrice: 1700,
    variants: [],
    status: 'active',
  },
  {
    id: 'bracelet-2',
    title: 'Luna Bracelet',
    collection: 'bracelet',
    tags: ['brac'],
    basePrice: 1890,
    baseCompareAtPrice: 2100,
    variants: [],
    status: 'active',
  },
  {
    id: 'necklace-1',
    title: 'Celeste Necklace',
    collection: 'collier',
    tags: ['nckl'],
    basePrice: 1900,
    baseCompareAtPrice: 2200,
    variants: [],
    status: 'active',
  },
  {
    id: 'necklace-2',
    title: 'Opaline Necklace',
    collection: 'collier',
    tags: ['nckl'],
    basePrice: 2300,
    baseCompareAtPrice: 2600,
    variants: [],
    status: 'active',
  },
  {
    id: 'ring-1',
    title: 'Etoile Ring',
    collection: 'bague',
    tags: ['rng'],
    basePrice: 1500,
    baseCompareAtPrice: 1800,
    variants: [],
    status: 'active',
  },
  {
    id: 'ring-2',
    title: 'Nova Ring',
    collection: 'bague',
    tags: ['rng'],
    basePrice: 2400,
    baseCompareAtPrice: 2800,
    variants: [],
    status: 'active',
  },
  {
    id: 'handchain-1',
    title: 'Serene Hand Chain',
    collection: 'handchain',
    tags: ['hand'],
    basePrice: 1100,
    baseCompareAtPrice: 1300,
    variants: [],
    status: 'active',
  },
  {
    id: 'set-1',
    title: 'Regal Set',
    collection: 'ensemble',
    tags: ['set'],
    basePrice: 4000,
    baseCompareAtPrice: 4500,
    variants: [],
    status: 'active',
  },
];
