import './loadEnv.js';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const {
  VITE_SHOPIFY_STORE_DOMAIN,
  SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_WEBHOOK_SECRET,
  SHOPIFY_API_VERSION = '2024-04',
  PORT = 3000,
} = process.env;

if (!VITE_SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN || !SHOPIFY_WEBHOOK_SECRET) {
  console.error(
    'Missing Shopify environment variables. Ensure VITE_SHOPIFY_STORE_DOMAIN, SHOPIFY_ACCESS_TOKEN, and SHOPIFY_WEBHOOK_SECRET are set.',
  );
  process.exit(1);
}

const stripDiacritics = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalize = (value = '') => {
  if (value === null || value === undefined) {
    return '';
  }
  return stripDiacritics(String(value)).trim().toLowerCase();
};

const DEFAULT_CHAIN_SIZE = 41;
const SUPPLEMENTS_PATH = path.resolve(process.cwd(), 'src/data/supplements.js');

const emptySupplementState = () => ({
  braceletChainTypes: {},
  necklaceChainTypes: {},
  necklaceSizes: [],
});

let supplementState = emptySupplementState();
let derivedSupplementState = {
  knownChainTypes: new Map(),
  knownChainTypeEntries: [],
  knownNecklaceSizes: new Set(),
};

const recomputeDerivedSupplementState = () => {
  const nextKnownChainTypes = new Map();

  for (const name of Object.keys(supplementState.braceletChainTypes)) {
    nextKnownChainTypes.set(normalize(name), name);
  }

  for (const name of Object.keys(supplementState.necklaceChainTypes)) {
    const normalized = normalize(name);
    if (!nextKnownChainTypes.has(normalized)) {
      nextKnownChainTypes.set(normalized, name);
    }
  }

  derivedSupplementState = {
    knownChainTypes: nextKnownChainTypes,
    knownChainTypeEntries: [...nextKnownChainTypes.entries()],
    knownNecklaceSizes: new Set(supplementState.necklaceSizes),
  };
};

const loadSupplementModule = async () => {
  const moduleUrl = `${pathToFileURL(SUPPLEMENTS_PATH).href}?t=${Date.now()}`;
  const module = await import(moduleUrl);

  return {
    braceletChainTypes: module.braceletChainTypes ?? {},
    necklaceChainTypes: module.necklaceChainTypes ?? {},
    necklaceSizes: Array.isArray(module.necklaceSizes) ? module.necklaceSizes : [],
  };
};

const hydrateSupplements = async () => {
  try {
    const next = await loadSupplementModule();
    supplementState = {
      braceletChainTypes: { ...next.braceletChainTypes },
      necklaceChainTypes: { ...next.necklaceChainTypes },
      necklaceSizes: [...next.necklaceSizes],
    };
    recomputeDerivedSupplementState();
    console.info('Webhook supplement tables refreshed.');
  } catch (error) {
    console.error('Failed to load supplements for webhook calculations:', error);
  }
};

const scheduleSupplementReload = (() => {
  let timer = null;
  return () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      hydrateSupplements();
    }, 100);
  };
})();

await hydrateSupplements();

try {
  fs.watch(SUPPLEMENTS_PATH, { persistent: false }, (eventType) => {
    if (eventType === 'change' || eventType === 'rename') {
      scheduleSupplementReload();
    }
  });
} catch (error) {
  console.warn(
    'Supplement file watch unavailable; restart the webhook server after supplement changes.',
    error,
  );
}

const app = express();
app.use(
  express.json({
    type: 'application/json',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

const parseTags = (tags = '') => {
  const values = Array.isArray(tags)
    ? tags
    : String(tags)
        .split(',')
        .map((tag) => tag);

  return new Set(values.map((tag) => normalize(tag)).filter(Boolean));
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCollection = (...values) =>
  values
    .flat()
    .map((value) => normalize(value ?? ''))
    .filter(Boolean);

const BRACELET_KEYWORDS = {
  tags: ['brac', 'bracelet', 'bracelets'],
  text: ['bracelet', 'bracelets', 'gourmette'],
};

const NECKLACE_KEYWORDS = {
  tags: [
    'nckl',
    'necklace',
    'necklaces',
    'collier',
    'colliers',
    'chaine',
    'chaines',
    'sautoir',
    'pendentif',
    'pendentifs',
    'pendant',
    'pendants',
  ],
  text: [
    'necklace',
    'necklaces',
    'collier',
    'colliers',
    'chaine',
    'chaines',
    'sautoir',
    'sautoirs',
    'pendentif',
    'pendentifs',
    'pendant',
    'pendants',
    (value) => value.includes('neck') && !value.includes('hand'),
  ],
};

const SET_KEYWORDS = {
  tags: ['set', 'sets', 'ensemble', 'ensembles', 'parure', 'parures'],
  text: ['ensemble', 'ensembles', 'parure', 'parures'],
};

const matchesKeywords = (candidates, keywords) =>
  candidates.some((candidate) =>
    keywords.some((keyword) =>
      typeof keyword === 'function' ? keyword(candidate) : candidate.includes(keyword),
    ),
  );

const splitVariantDescriptor = (value) => {
  if (!value) {
    return [];
  }

  return String(value)
    .split(/[\\/•|,;\-–—]/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const collectVariantTokens = (variant) => {
  const rawTokens = [
    variant?.option1,
    variant?.option2,
    variant?.option3,
    ...(Array.isArray(variant?.options) ? variant.options : []),
    variant?.title,
  ];

  return rawTokens.flatMap((token) => splitVariantDescriptor(token));
};

const findChainType = (variant) => {
  const { knownChainTypes, knownChainTypeEntries } = derivedSupplementState;

  for (const token of collectVariantTokens(variant)) {
    const normalizedToken = normalize(token);

    const directMatch = knownChainTypes.get(normalizedToken);
    if (directMatch) {
      return directMatch;
    }

    for (const [normalizedName, canonical] of knownChainTypeEntries) {
      if (normalizedToken.includes(normalizedName)) {
        return canonical;
      }
    }
  }

  return null;
};

const findNecklaceSize = (variant) => {
  const { knownNecklaceSizes } = derivedSupplementState;

  for (const token of collectVariantTokens(variant)) {
    const match = token.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      continue;
    }

    const numeric = Number.parseFloat(match[1]);
    if (!Number.isFinite(numeric)) {
      continue;
    }

    if (knownNecklaceSizes.has(numeric)) {
      return numeric;
    }

    const rounded = Math.round(numeric);
    if (knownNecklaceSizes.has(rounded)) {
      return rounded;
    }
  }

  return null;
};

const isForsatS = (value) => normalize(value) === 'forsat s';

const TARGET_COLLECTION_RULES = [
  {
    family: 'bracelet',
    requiredTag: 'brac',
    collectionKeys: ['bracelet'],
  },
  {
    family: 'necklace',
    requiredTag: 'nckl',
    collectionKeys: ['colliers', 'collier'],
  },
];

const determineFamilyFromMetadata = (product, tags) => {
  const normalizedTags = tags ?? parseTags(product.tags);
  const types = normalizeCollection(
    product.product_type,
    product.custom_product_type,
    product?.standardized_product_type?.product_type,
    product?.standardized_product_type?.product_taxonomy_node?.full_path,
  );
  const metadata = normalizeCollection(
    product.title,
    product.handle,
    product.vendor,
    product.template_suffix,
    product?.options?.map((option) => option.name),
  );

  const hasTag = (keywordList) => keywordList.some((keyword) => normalizedTags.has(keyword));
  const matchesType = (keywordList) => matchesKeywords(types, keywordList);
  const matchesMetadata = (keywordList) => matchesKeywords(metadata, keywordList);

  if (
    hasTag(SET_KEYWORDS.tags) ||
    matchesType([...SET_KEYWORDS.tags, ...SET_KEYWORDS.text]) ||
    matchesMetadata(SET_KEYWORDS.text)
  ) {
    return 'set';
  }

  if (
    hasTag(NECKLACE_KEYWORDS.tags) ||
    matchesType([...NECKLACE_KEYWORDS.tags, ...NECKLACE_KEYWORDS.text]) ||
    matchesMetadata(NECKLACE_KEYWORDS.text)
  ) {
    return 'necklace';
  }

  if (
    hasTag(BRACELET_KEYWORDS.tags) ||
    matchesType([...BRACELET_KEYWORDS.tags, ...BRACELET_KEYWORDS.text]) ||
    matchesMetadata(BRACELET_KEYWORDS.text)
  ) {
    return 'bracelet';
  }

  return null;
};

const fetchProductCollections = async (productId) => {
  const productIdParam = encodeURIComponent(productId);
  try {
    const response = await fetch(
      `https://${VITE_SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products/${productIdParam}/collections.json?fields=id,title,handle`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      console.warn(
        `Failed to load collection memberships for product ${productId}: ${response.status} ${response.statusText} - ${body}`,
      );
      return { collections: [], reliable: false };
    }

    const payload = await response.json();
    const collections = Array.isArray(payload?.collections) ? payload.collections : [];
    return {
      collections: collections.map((collection) => ({
        id: String(collection?.id ?? ''),
        title: collection?.title ?? '',
        handle: collection?.handle ?? '',
      })),
      reliable: true,
    };
  } catch (error) {
    console.warn(`Unexpected error loading collections for product ${productId}:`, error);
    return { collections: [], reliable: false };
  }
};

const determineFamilyFromCollections = (collections, tags) => {
  if (!collections || collections.length === 0) {
    return null;
  }

  const normalizedCollections = new Set(
    collections
      .flatMap((collection) => [collection.title, collection.handle])
      .map((value) => normalize(value))
      .filter(Boolean),
  );

  for (const rule of TARGET_COLLECTION_RULES) {
    if (!tags.has(rule.requiredTag)) {
      continue;
    }

    const matchesCollection = rule.collectionKeys.some((key) =>
      normalizedCollections.has(normalize(key)),
    );

    if (matchesCollection) {
      return rule.family;
    }
  }

  return null;
};

const findBaseVariant = (product) => {
  if (!Array.isArray(product.variants) || product.variants.length === 0) {
    return null;
  }

  let firstForsatVariant = null;
  let closestForsatVariant = null;
  let smallestDelta = Number.POSITIVE_INFINITY;

  for (const variant of product.variants) {
    const chainType = findChainType(variant);
    if (!chainType || !isForsatS(chainType)) {
      continue;
    }

    if (!firstForsatVariant) {
      firstForsatVariant = variant;
    }

    const size = findNecklaceSize(variant);
    if (size === null) {
      // Bracelet/base variants often omit a size entirely; accept immediately.
      return variant;
    }

    const delta = Math.abs(size - DEFAULT_CHAIN_SIZE);
    if (delta < 0.5) {
      // Exact match to the canonical 41cm length.
      return variant;
    }

    if (delta < smallestDelta) {
      smallestDelta = delta;
      closestForsatVariant = variant;
    }
  }

  return closestForsatVariant ?? firstForsatVariant ?? null;
};

const moneyString = (value) => (Math.round(value * 100) / 100).toFixed(2);

const computeBraceletSupplement = (variant) => {
  const chainType = findChainType(variant);
  if (
    !chainType ||
    !Object.prototype.hasOwnProperty.call(supplementState.braceletChainTypes, chainType)
  ) {
    return null;
  }
  return supplementState.braceletChainTypes[chainType];
};

const computeNecklaceSupplement = (variant) => {
  const chainType = findChainType(variant);
  const chainData = supplementState.necklaceChainTypes[chainType];
  if (!chainData) return null;
  const size = findNecklaceSize(variant) ?? DEFAULT_CHAIN_SIZE;
  const sizeDelta = Math.max(0, size - DEFAULT_CHAIN_SIZE);
  return chainData.supplement + sizeDelta * chainData.perCm;
};

const computeSetSupplement = (variant) => {
  const chainType = findChainType(variant);
  const necklaceData = supplementState.necklaceChainTypes[chainType];
  if (!necklaceData) return null;
  const braceletSupplement = supplementState.braceletChainTypes[chainType] ?? 0;
  const size = findNecklaceSize(variant) ?? DEFAULT_CHAIN_SIZE;
  const sizeDelta = Math.max(0, size - DEFAULT_CHAIN_SIZE);
  return braceletSupplement + necklaceData.supplement + sizeDelta * necklaceData.perCm;
};

const buildVariantUpdates = (product, family) => {
  const baseVariant = findBaseVariant(product);
  if (!baseVariant) {
    return { baseVariant: null, updates: [], message: 'No Forsat S base variant found.' };
  }

  const basePrice = parseNumber(baseVariant.price, 0);
  const baseCompare = parseNumber(baseVariant.compare_at_price, basePrice);

  const computeSupplement =
    family === 'bracelet'
      ? computeBraceletSupplement
      : family === 'necklace'
      ? computeNecklaceSupplement
      : computeSetSupplement;

  const updates = [];

  for (const variant of product.variants) {
    if (variant.id === baseVariant.id) {
      continue;
    }
    const supplement = computeSupplement(variant);
    if (supplement === null) {
      continue;
    }
    const price = basePrice + supplement;
    const compareAt = baseCompare + supplement;
    const nextPrice = moneyString(price);
    const nextCompareAt = moneyString(compareAt);
    const currentPriceNumber = parseNumber(variant.price, price);
    const currentCompareNumber = parseNumber(variant.compare_at_price, currentPriceNumber);
    const currentPrice = moneyString(currentPriceNumber);
    const currentCompareAt = moneyString(currentCompareNumber);

    if (currentPrice === nextPrice && currentCompareAt === nextCompareAt) {
      continue;
    }

    updates.push({
      id: variant.id,
      price: nextPrice,
      compare_at_price: nextCompareAt,
      title: variant.title,
    });
  }

  return { baseVariant, updates };
};

const verifyShopifyRequest = (req) => {
  const shopifyHmac = req.get('X-Shopify-Hmac-Sha256');
  if (!shopifyHmac) return false;
  const digest = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(shopifyHmac));
  } catch (error) {
    console.warn('Failed to perform timing-safe comparison:', error);
    return false;
  }
};

const updateShopifyVariant = async (variant) => {
  const response = await fetch(
    `https://${VITE_SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/variants/${variant.id}.json`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        variant: {
          id: variant.id,
          price: variant.price,
          compare_at_price: variant.compare_at_price,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    return {
      id: variant.id,
      title: variant.title,
      ok: false,
      status: response.status,
      statusText: response.statusText,
      body: errorBody,
    };
  }

  return { id: variant.id, title: variant.title, ok: true };
};

app.post('/webhooks/product-update', async (req, res) => {
  if (!verifyShopifyRequest(req)) {
    return res.status(401).send('Invalid webhook signature');
  }

  const product = req.body;
  if (!product || product.status !== 'active') {
    return res.status(200).json({ skipped: true, reason: 'Product inactive or missing.' });
  }

  const tags = parseTags(product.tags);
  const requiresCollectionLookup = TARGET_COLLECTION_RULES.some((rule) => tags.has(rule.requiredTag));
  if (!requiresCollectionLookup) {
    return res.status(200).json({
      skipped: true,
      reason: 'Product not in targeted collections with required tags.',
    });
  }

  const { collections, reliable } = await fetchProductCollections(product.id);
  const familyFromCollections = determineFamilyFromCollections(collections, tags);
  const family =
    familyFromCollections ?? (!reliable ? determineFamilyFromMetadata(product, tags) : null);

  if (!family) {
    return res.status(200).json({
      skipped: true,
      reason: reliable
        ? 'Product not in targeted collections with required tags.'
        : 'Product classification unavailable without collection data.',
    });
  }

  if (!familyFromCollections && !reliable) {
    console.warn(
      `Product ${product.id}: proceeding with metadata classification (${family}) due to unavailable collection data.`,
    );
  }

  const { baseVariant, updates, message } = buildVariantUpdates(product, family);
  if (!baseVariant) {
    console.warn(`Product ${product.id}: ${message}`);
    return res.status(200).json({ skipped: true, reason: message });
  }

  if (updates.length === 0) {
    return res.status(200).json({ updated: 0, message: 'No variant prices required updates.' });
  }

  const results = [];
  for (const variant of updates) {
    try {
      const result = await updateShopifyVariant(variant);
      results.push(result);
    } catch (error) {
      results.push({ id: variant.id, title: variant.title, ok: false, error: error.message });
    }
  }

  const successCount = results.filter((item) => item.ok).length;

  console.info(
    `Product ${product.id}: updated ${successCount}/${updates.length} variants after Forsat S change.`,
  );

  return res.status(200).json({
    updated: successCount,
    attempted: updates.length,
    variants: results,
  });
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(Number(PORT), () => {
  console.log(`Shopify webhook listener running on port ${PORT}`);
});
