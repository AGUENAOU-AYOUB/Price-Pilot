import './loadEnv.js';
import express from 'express';
import crypto from 'node:crypto';

import {
  braceletChainTypes,
  necklaceChainTypes,
} from '../src/data/supplements.js';

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

const DEFAULT_CHAIN_SIZE = 41;

const app = express();
app.use(
  express.json({
    type: 'application/json',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

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

const parseSizeCm = (value) => {
  if (!value) return DEFAULT_CHAIN_SIZE;
  const match = `${value}`.match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : DEFAULT_CHAIN_SIZE;
};

const isForsatS = (value) => normalize(value) === 'forsat s';

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

const determineFamily = (product) => {
  const tags = parseTags(product.tags);
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

  const hasTag = (keywordList) => keywordList.some((keyword) => tags.has(keyword));
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

const findBaseVariant = (product) => {
  if (!Array.isArray(product.variants)) return null;
  return (
    product.variants.find(
      (variant) =>
        isForsatS(variant.option1) &&
        (variant.option2 === null || variant.option2 === undefined || parseSizeCm(variant.option2) === DEFAULT_CHAIN_SIZE) &&
        (variant.option3 === null || variant.option3 === undefined),
    ) ?? null
  );
};

const moneyString = (value) => (Math.round(value * 100) / 100).toFixed(2);

const computeBraceletSupplement = (variant) => {
  const chainType = variant.option1;
  if (!Object.prototype.hasOwnProperty.call(braceletChainTypes, chainType)) {
    return null;
  }
  return braceletChainTypes[chainType];
};

const computeNecklaceSupplement = (variant) => {
  const chainType = variant.option1;
  const chainData = necklaceChainTypes[chainType];
  if (!chainData) return null;
  const size = parseSizeCm(variant.option2);
  const sizeDelta = Math.max(0, size - DEFAULT_CHAIN_SIZE);
  return chainData.supplement + sizeDelta * chainData.perCm;
};

const computeSetSupplement = (variant) => {
  const chainType = variant.option1;
  const necklaceData = necklaceChainTypes[chainType];
  if (!necklaceData) return null;
  const braceletSupplement = braceletChainTypes[chainType] ?? 0;
  const size = parseSizeCm(variant.option2);
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
    const priceNumber = parseNumber(variant.price, 0);
    const compareNumber = parseNumber(variant.compare_at_price, priceNumber);

    if (Math.abs(priceNumber - price) < 0.1 && Math.abs(compareNumber - compareAt) < 0.1) {
      continue;
    }

    updates.push({
      id: variant.id,
      price: moneyString(price),
      compare_at_price: moneyString(compareAt),
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

  const family = determineFamily(product);
  if (!family) {
    return res.status(200).json({ skipped: true, reason: 'Product does not match bracelet/necklace/set tags.' });
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
