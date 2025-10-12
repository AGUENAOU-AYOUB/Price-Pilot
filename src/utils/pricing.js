import { necklaceSizes, ringBandSupplements, ringSizes } from '../data/supplements.js';

export const roundToLuxuryStep = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const candidates = [];
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

export const applyPercentage = (price, percent) => {
  const updated = price * (1 + percent / 100);
  return roundToLuxuryStep(updated);
};

export const buildBraceletVariants = (product, supplements) => {
  return Object.entries(supplements).map(([title, supplement]) => ({
    id: `${product.id}-${title}`,
    title,
    chainType: title,
    price: product.basePrice + supplement,
    compareAtPrice: product.baseCompareAtPrice + supplement,
  }));
};

export const buildNecklaceVariants = (product, chainTypeSupplements) => {
  const variants = [];
  for (const [chainType, data] of Object.entries(chainTypeSupplements)) {
    for (const size of necklaceSizes) {
      const sizeDelta = size - 41;
      const sizeSupplement = sizeDelta > 0 ? sizeDelta * data.perCm : 0;
      const title = `${chainType} • ${size}cm`;
      const priceBase = product.basePrice + data.supplement + sizeSupplement;
      const compareBase = product.baseCompareAtPrice + data.supplement + sizeSupplement;
      variants.push({
        id: `${product.id}-${chainType}-${size}`,
        title,
        chainType,
        size,
        price: priceBase,
        compareAtPrice: compareBase,
      });
    }
  }
  return variants;
};

export const buildRingVariants = (product, ringSupplements = ringBandSupplements) => {
  const variants = [];
  for (const band of Object.keys(ringSupplements)) {
    for (const size of ringSizes) {
      const supplement = ringSupplements[band][size];
      const title = `${band} • ${size}`;
      const price = product.basePrice + supplement;
      const compareAtPrice = product.baseCompareAtPrice + supplement;
      variants.push({
        id: `${product.id}-${band}-${size}`,
        title,
        band,
        size,
        price,
        compareAtPrice,
      });
    }
  }
  return variants;
};

export const buildHandChainVariants = (
  product,
  chainTypeSupplements,
  allowedChainKeys = null,
) => {
  const allowed =
    allowedChainKeys instanceof Set
      ? allowedChainKeys
      : Array.isArray(allowedChainKeys)
        ? new Set(allowedChainKeys)
        : null;

  const filterSet = allowed && allowed.size > 0 ? allowed : null;

  return Object.entries(chainTypeSupplements)
    .filter(([chainType]) => !filterSet || filterSet.has(chainType))
    .map(([chainType, supplement]) => ({
      id: `${product.id}-${chainType}`,
      title: chainType,
      chainType,
      price: product.basePrice + supplement,
      compareAtPrice: product.baseCompareAtPrice + supplement,
    }));
};

export const buildSetVariants = (product, braceletSupplements, necklaceSupplements) => {
  const variants = [];
  for (const [chainType, data] of Object.entries(necklaceSupplements)) {
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
        chainType,
        size,
        price: priceBase,
        compareAtPrice: compareBase,
      });
    }
  }
  return variants;
};

export const createPricingPreview = (product, variants) => ({
  product,
  updatedBasePrice: product.basePrice,
  updatedCompareAtPrice: product.baseCompareAtPrice,
  variants,
});
