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

export const roundSupplementValue = (
  value,
  { step = 10, minimum = 0, strategy = 'luxury-ceil' } = {},
) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return typeof minimum === 'number' && Number.isFinite(minimum) ? minimum : 0;
  }

  let rounded;

  if (strategy === 'step') {
    const numericStep = Number(step);
    const safeStep = Number.isFinite(numericStep) && numericStep > 0 ? numericStep : 1;
    rounded = Math.ceil(numericValue / safeStep) * safeStep;
  } else {
    const endings = [0, 50, 90];
    const hasFraction = !Number.isInteger(numericValue);
    const workingValue = hasFraction ? Math.floor(numericValue) : numericValue;
    const lastTwoDigits = ((workingValue % 100) + 100) % 100;

    if (endings.includes(lastTwoDigits)) {
      rounded = workingValue;
    } else {
      let hundredBlock = Math.floor(workingValue / 100);
      let candidate = hundredBlock * 100;

      while (candidate < workingValue) {
        let found = false;
        for (const ending of endings) {
          candidate = hundredBlock * 100 + ending;
          if (candidate >= workingValue) {
            found = true;
            break;
          }
        }

        if (found) {
          break;
        }

        hundredBlock += 1;
        candidate = hundredBlock * 100;
      }

      rounded = candidate;
    }
  }

  if (typeof minimum === 'number' && Number.isFinite(minimum)) {
    return Math.max(rounded, minimum);
  }

  return rounded;
};

export const applySupplementPercentage = (value, percent, options = {}) => {
  const numericValue = Number(value) || 0;
  const numericPercent = Number(percent);
  const ratio = Number.isFinite(numericPercent) ? numericPercent / 100 : 0;
  const updated = numericValue * (1 + ratio);
  return roundSupplementValue(updated, options);
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

export const buildHandChainVariants = (product, chainTypeSupplements) => {
  return Object.entries(chainTypeSupplements).map(([chainType, supplement]) => ({
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
