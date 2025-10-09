import {
  braceletChainTypes,
  NecklaceChainType,
  necklaceChainTypes,
  necklaceSizes,
  ringBandSupplements,
  RingBandType,
  RingSize,
  ringSizes,
} from '../data/supplements';
import { ProductRecord, ProductVariant } from '../data/products';

export const roundToLuxuryStep = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const candidates = [] as number[];
  const base = Math.floor(value / 100) * 100;
  candidates.push(base);
  candidates.push(base + 90);
  candidates.push(base + 100);

  let winner = candidates[0];
  let minDistance = Math.abs(value - winner);
  for (const candidate of candidates) {
    const distance = Math.abs(value - candidate);
    if (distance < minDistance) {
      winner = candidate;
      minDistance = distance;
    }
  }

  return Math.max(winner, 0);
};

export const applyPercentage = (price: number, percent: number): number => {
  const updated = price * (1 + percent / 100);
  return roundToLuxuryStep(updated);
};

export const buildBraceletVariants = (
  product: ProductRecord,
  supplements: Record<string, number>,
): ProductVariant[] => {
  return Object.entries(supplements).map(([title, supplement]) => ({
    id: `${product.id}-${title}`,
    title,
    price: roundToLuxuryStep(product.basePrice + supplement),
    compareAtPrice: roundToLuxuryStep(product.baseCompareAtPrice + supplement),
  }));
};

export const buildNecklaceVariants = (
  product: ProductRecord,
  chainTypeSupplements: Record<NecklaceChainType, { supplement: number; perCm: number }>,
): ProductVariant[] => {
  const variants: ProductVariant[] = [];
  for (const [chainType, data] of Object.entries(chainTypeSupplements) as [
    NecklaceChainType,
    { supplement: number; perCm: number }
  ][]) {
    for (const size of necklaceSizes) {
      const sizeDelta = size - 41;
      const sizeSupplement = sizeDelta > 0 ? sizeDelta * data.perCm : 0;
      const title = `${chainType} • ${size}cm`;
      const priceBase = product.basePrice + data.supplement + sizeSupplement;
      const compareBase = product.baseCompareAtPrice + data.supplement + sizeSupplement;
      variants.push({
        id: `${product.id}-${chainType}-${size}`,
        title,
        price: roundToLuxuryStep(priceBase),
        compareAtPrice: roundToLuxuryStep(compareBase),
      });
    }
  }
  return variants;
};

export const buildRingVariants = (
  product: ProductRecord,
  ringSupplements: typeof ringBandSupplements,
): ProductVariant[] => {
  const variants: ProductVariant[] = [];
  for (const band of Object.keys(ringSupplements) as RingBandType[]) {
    for (const size of ringSizes) {
      const supplement = ringSupplements[band][size];
      const title = `${band} • ${size}`;
      const price = roundToLuxuryStep(product.basePrice + supplement);
      const compareAtPrice = roundToLuxuryStep(product.baseCompareAtPrice + supplement);
      variants.push({
        id: `${product.id}-${band}-${size}`,
        title,
        price,
        compareAtPrice,
      });
    }
  }
  return variants;
};

export const buildHandChainVariants = (
  product: ProductRecord,
  chainTypeSupplements: Record<string, number>,
): ProductVariant[] => {
  return Object.entries(chainTypeSupplements).map(([chainType, supplement]) => ({
    id: `${product.id}-${chainType}`,
    title: chainType,
    price: roundToLuxuryStep(product.basePrice + supplement),
    compareAtPrice: roundToLuxuryStep(product.baseCompareAtPrice + supplement),
  }));
};

export const buildSetVariants = (
  product: ProductRecord,
  braceletSupplements: Record<string, number>,
  necklaceSupplements: Record<NecklaceChainType, { supplement: number; perCm: number }>,
): ProductVariant[] => {
  const variants: ProductVariant[] = [];
  for (const [chainType, data] of Object.entries(necklaceSupplements) as [
    NecklaceChainType,
    { supplement: number; perCm: number }
  ][]) {
    const braceletSupplement = braceletSupplements[chainType] ?? 0;
    const chainTypeSupplement = braceletSupplement + data.supplement;
    for (const size of necklaceSizes) {
      const sizeDelta = size - 41;
      const sizeSupplement = sizeDelta > 0 ? sizeDelta * data.perCm : 0;
      const title = `${chainType} • ${size}cm`;
      const priceBase = product.basePrice + chainTypeSupplement + sizeSupplement;
      const compareBase = product.baseCompareAtPrice + chainTypeSupplement + sizeSupplement;
      variants.push({
        id: `${product.id}-${chainType}-${size}`,
        title,
        price: roundToLuxuryStep(priceBase),
        compareAtPrice: roundToLuxuryStep(compareBase),
      });
    }
  }
  return variants;
};

export interface PricingPreview {
  product: ProductRecord;
  updatedBasePrice: number;
  updatedCompareAtPrice: number;
  variants: ProductVariant[];
}
