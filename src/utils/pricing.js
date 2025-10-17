import { necklaceSizes, ringBandSupplements, ringSizes } from '../data/supplements.js';
import { parseChainName } from './variantParsers.js';

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

const DEFAULT_BRACELET_CONTEXT_KEY = 'default';

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

const buildChainLookup = (supplements) => {
  const lookup = new Map();
  for (const name of Object.keys(supplements ?? {})) {
    const sanitized = sanitizeVariantKey(name);
    if (sanitized) {
      lookup.set(sanitized, name);
    }
  }
  return lookup;
};

const canonicalChainNameFromLookup = (value, lookup) => {
  if (!value) {
    return null;
  }

  const parsed = parseChainName(value);
  const sanitized = sanitizeVariantKey(parsed);
  if (!sanitized) {
    return null;
  }

  if (lookup.has(sanitized)) {
    return lookup.get(sanitized);
  }

  for (const [candidateKey, candidateValue] of lookup.entries()) {
    if (sanitized.startsWith(candidateKey)) {
      return candidateValue;
    }
  }

  for (const [candidateKey, candidateValue] of lookup.entries()) {
    if (candidateKey.length >= 3 && sanitized.includes(candidateKey)) {
      return candidateValue;
    }
  }

  return null;
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

const collectBraceletVariantTokens = (variant) => {
  const tokens = [];

  if (Array.isArray(variant?.options) && variant.options.length > 0) {
    tokens.push(...variant.options);
  }

  if (typeof variant?.title === 'string' && variant.title.trim()) {
    tokens.push(...splitVariantDescriptor(variant.title));
  }

  return tokens;
};

const normalizeParentCandidate = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const lower = raw.toLowerCase();
  if (lower === 'default' || lower === 'default title' || lower === 'defaulttitle') {
    return null;
  }

  if (/\b(cm|centim|millim|mm)\b/.test(lower)) {
    return null;
  }

  return raw;
};

export const buildBraceletVariants = (product, supplements) => {
  const chainLookup = buildChainLookup(supplements);
  const contexts = new Map();

  const ensureContext = (parentKey, parentValues = []) => {
    const key = parentKey ?? DEFAULT_BRACELET_CONTEXT_KEY;
    if (!contexts.has(key)) {
      contexts.set(key, {
        key,
        parentKey,
        parentValues: parentValues.length > 0 ? [...parentValues] : [],
        observed: new Map(),
        baseVariantChain: null,
      });
    }

    const context = contexts.get(key);
    if (context.parentValues.length === 0 && parentValues.length > 0) {
      context.parentValues = [...parentValues];
    }

    return context;
  };

  for (const variant of Array.isArray(product?.variants) ? product.variants : []) {
    const tokens = collectBraceletVariantTokens(variant);
    let chainType = null;
    const parentValues = [];
    const parentKeyParts = [];

    for (const token of tokens) {
      const chain = canonicalChainNameFromLookup(token, chainLookup);
      if (chain) {
        chainType = chain;
        continue;
      }

      const normalizedParent = normalizeParentCandidate(token);
      if (!normalizedParent) {
        continue;
      }

      const sanitized = sanitizeVariantKey(normalizedParent);
      if (!sanitized) {
        continue;
      }

      if (!parentKeyParts.includes(sanitized)) {
        parentKeyParts.push(sanitized);
        parentValues.push(normalizedParent);
      }
    }

    if (!chainType) {
      continue;
    }

    const parentKey = parentKeyParts.length > 0 ? parentKeyParts.join('::') : null;
    const context = ensureContext(parentKey, parentValues);
    const price = Number(variant?.price);
    const compareAt = Number.isFinite(Number(variant?.compareAtPrice))
      ? Number(variant.compareAtPrice)
      : null;

    context.observed.set(chainType, {
      price: Number.isFinite(price) ? price : null,
      compareAt: Number.isFinite(compareAt) ? compareAt : null,
    });

    if (sanitizeVariantKey(chainType) === sanitizeVariantKey('Forsat S')) {
      context.baseVariantChain = chainType;
    }
  }

  if (contexts.size === 0) {
    ensureContext(null, []);
  }

  const supplementEntries = Object.entries(supplements ?? {});
  const results = [];

  for (const context of contexts.values()) {
    const observed = context.observed;
    let basePrice = observed.get('Forsat S')?.price;
    let baseCompare = observed.get('Forsat S')?.compareAt;

    if (!Number.isFinite(basePrice)) {
      for (const [chainName, data] of observed.entries()) {
        const supplement = supplements?.[chainName];
        if (!Number.isFinite(data?.price) || !Number.isFinite(supplement)) {
          continue;
        }
        const candidate = data.price - supplement;
        if (Number.isFinite(candidate)) {
          basePrice = candidate;
          break;
        }
      }
    }

    if (!Number.isFinite(basePrice)) {
      basePrice = Number(product?.basePrice ?? 0);
    }

    if (!Number.isFinite(basePrice)) {
      basePrice = 0;
    }

    if (!Number.isFinite(baseCompare)) {
      for (const [chainName, data] of observed.entries()) {
        const supplement = supplements?.[chainName];
        if (!Number.isFinite(data?.compareAt) || !Number.isFinite(supplement)) {
          continue;
        }
        const candidate = data.compareAt - supplement;
        if (Number.isFinite(candidate)) {
          baseCompare = candidate;
          break;
        }
      }
    }

    if (!Number.isFinite(baseCompare)) {
      baseCompare = Number(product?.baseCompareAtPrice ?? product?.basePrice ?? basePrice ?? 0);
    }

    if (!Number.isFinite(baseCompare)) {
      baseCompare = basePrice;
    }

    const parentId = context.parentKey ?? DEFAULT_BRACELET_CONTEXT_KEY;
    const parentLabel = context.parentValues.length > 0 ? context.parentValues.join(' • ') : null;

    for (const [chainType, supplement] of supplementEntries) {
      const numericSupplement = Number(supplement) || 0;
      const price = basePrice + numericSupplement;
      const compareAtPrice = baseCompare + numericSupplement;
      const options = context.parentValues.length > 0
        ? [...context.parentValues, chainType]
        : [chainType];

      results.push({
        id: `${product.id}-${parentId}-${sanitizeVariantKey(chainType) ?? 'chain'}`,
        title: parentLabel ? `${parentLabel} • ${chainType}` : chainType,
        chainType,
        parentKey: context.parentKey,
        parentLabel,
        options,
        price,
        compareAtPrice,
      });
    }
  }

  return results;
};

const DEFAULT_NECKLACE_SIZE = necklaceSizes[0] ?? 41;

export const resolveNecklaceSupplement = (data, size) => {
  if (data && typeof data === 'object') {
    const sizes = data.sizes;
    if (sizes && typeof sizes === 'object') {
      const direct = sizes[size] ?? sizes[String(size)];
      const numericDirect = Number(direct);
      if (Number.isFinite(numericDirect)) {
        return numericDirect;
      }
    }
  }

  const baseSupplement = Number(data?.supplement) || 0;
  const perCm = Number(data?.perCm) || 0;
  const delta = size - DEFAULT_NECKLACE_SIZE;
  const incremental = delta > 0 ? delta * perCm : 0;
  return baseSupplement + incremental;
};

const DEFAULT_GROUP_ENTRY = (product) => ({
  key: null,
  label: null,
  basePrice: Number(product.basePrice ?? 0),
  baseCompareAtPrice: Number(
    product.baseCompareAtPrice ?? product.basePrice ?? 0,
  ),
});

const buildGroupList = (product, groupsOption) => {
  if (Array.isArray(groupsOption) && groupsOption.length > 0) {
    return groupsOption.map((group) => ({
      key: group?.key ?? null,
      label: group?.label ?? null,
      basePrice: Number.isFinite(group?.basePrice)
        ? group.basePrice
        : Number(product.basePrice ?? 0),
      baseCompareAtPrice: Number.isFinite(group?.baseCompareAtPrice)
        ? group.baseCompareAtPrice
        : Number(product.baseCompareAtPrice ?? product.basePrice ?? 0),
    }));
  }

  return [DEFAULT_GROUP_ENTRY(product)];
};

const buildGroupIdentifier = (group) => {
  if (!group || !group.key) {
    return 'g-base';
  }

  return `g-${group.key}`;
};

export const buildNecklaceVariants = (
  product,
  chainTypeSupplements,
  options = {},
) => {
  const variants = [];
  const groups = buildGroupList(product, options.groups);

  for (const group of groups) {
    const basePrice = Number.isFinite(group.basePrice)
      ? group.basePrice
      : Number(product.basePrice ?? 0);
    const baseCompare = Number.isFinite(group.baseCompareAtPrice)
      ? group.baseCompareAtPrice
      : Number(product.baseCompareAtPrice ?? product.basePrice ?? 0);

    for (const [chainType, data] of Object.entries(chainTypeSupplements)) {
      for (const size of necklaceSizes) {
        const supplementValue = resolveNecklaceSupplement(data, size);
        const priceBase = basePrice + supplementValue;
        const compareBase = baseCompare + supplementValue;
        const titleParts = [];
        if (group.label) {
          titleParts.push(group.label);
        }
        titleParts.push(chainType);
        titleParts.push(`${size}cm`);
        const optionsList = [];
        if (group.label) {
          optionsList.push(group.label);
        }
        optionsList.push(chainType);
        optionsList.push(`${size}cm`);

        variants.push({
          id: `${product.id}-${buildGroupIdentifier(group)}-${chainType}-${size}`,
          title: titleParts.join(' • '),
          chainType,
          size,
          groupKey: group.key ?? null,
          groupLabel: group.label ?? null,
          options: optionsList,
          price: priceBase,
          compareAtPrice: compareBase,
        });
      }
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
    for (const size of necklaceSizes) {
      const necklaceSupplement = resolveNecklaceSupplement(data, size);
      const chainTypeSupplement = braceletSupplement + necklaceSupplement;
      const title = `${chainType} • ${size}cm`;
      const priceBase = product.basePrice + chainTypeSupplement;
      const compareBase = product.baseCompareAtPrice + chainTypeSupplement;
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
