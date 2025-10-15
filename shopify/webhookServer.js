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

const SUPPLEMENTS_PATH = path.resolve(process.cwd(), 'src/data/supplements.js');
const DEFAULT_NECKLACE_SIZE = 41;
const FORSAT_S_KEY = 'forsat s';

const stripDiacritics = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalize = (value = '') => {
  if (value === null || value === undefined) {
    return '';
  }

  return stripDiacritics(String(value)).trim().toLowerCase();
};

const moneyToNumber = (value) => {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatMoney = (value) => (Math.round(value * 100) / 100).toFixed(2);

const parseTags = (tags = '') => {
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  return new Set(list.map((tag) => normalize(tag)).filter(Boolean));
};

const findSizeInText = (value) => {
  const normalized = normalize(value);
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*cm/);
  if (match) {
    return Number.parseFloat(match[1]);
  }

  const fallback = normalized.match(/(\d+(?:\.\d+)?)/);
  if (fallback) {
    return Number.parseFloat(fallback[1]);
  }

  return null;
};

const collectVariantFields = (variant) =>
  [variant.title, variant.option1, variant.option2, variant.option3]
    .filter(Boolean)
    .map((value) => normalize(value));

const supplementsState = {
  bracelet: new Map(),
  necklace: new Map(),
  necklaceSizes: [],
};

const refreshDerivedSupplements = (module) => {
  supplementsState.bracelet.clear();
  supplementsState.necklace.clear();
  supplementsState.braceletBase = module?.braceletChainTypes ?? {};
  supplementsState.necklaceBase = module?.necklaceChainTypes ?? {};
  supplementsState.necklaceSizes = Array.isArray(module?.necklaceSizes) ? [...module.necklaceSizes] : [];

  if (supplementsState.braceletBase) {
    for (const [name, supplement] of Object.entries(supplementsState.braceletBase)) {
      supplementsState.bracelet.set(normalize(name), { name, supplement: Number(supplement) || 0 });
    }
  }

  if (supplementsState.necklaceBase) {
    for (const [name, config] of Object.entries(supplementsState.necklaceBase)) {
      const normalizedName = normalize(name);
      const supplement = Number(config?.supplement) || 0;
      const perCm = Number(config?.perCm) || 0;
      supplementsState.necklace.set(normalizedName, {
        name,
        supplement,
        perCm,
      });
    }
  }
};

const loadSupplements = async () => {
  try {
    const moduleUrl = `${pathToFileURL(SUPPLEMENTS_PATH).href}?t=${Date.now()}`;
    const module = await import(moduleUrl);
    refreshDerivedSupplements(module);
    console.info('Webhook supplements loaded.');
  } catch (error) {
    console.error('Failed to load supplements.', error);
  }
};

await loadSupplements();

try {
  fs.watch(SUPPLEMENTS_PATH, { persistent: false }, (eventType) => {
    if (eventType === 'change' || eventType === 'rename') {
      loadSupplements();
    }
  });
} catch (error) {
  console.warn('Could not watch supplement file for changes:', error);
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

const verifyShopifySignature = (req) => {
  const header = req.get('X-Shopify-Hmac-Sha256');
  if (!header) {
    return false;
  }

  const digest = crypto.createHmac('sha256', SHOPIFY_WEBHOOK_SECRET).update(req.rawBody).digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(header, 'base64'), Buffer.from(digest, 'base64'));
  } catch (error) {
    console.warn('Failed to verify webhook signature:', error);
    return false;
  }
};

const collectionCache = new Map();
const COLLECTION_TTL = 5 * 60 * 1000;

const fetchProductCollections = async (productId) => {
  if (!productId) {
    return [];
  }

  const cached = collectionCache.get(productId);
  if (cached && Date.now() - cached.timestamp < COLLECTION_TTL) {
    return cached.collections;
  }

  const url = `https://${VITE_SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}/collections.json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
  });

  if (!response.ok) {
    console.warn('Failed to load product collections', productId, response.status, await response.text());
    return [];
  }

  const payload = await response.json();
  const collections = Array.isArray(payload?.collections) ? payload.collections : [];
  collectionCache.set(productId, { timestamp: Date.now(), collections });
  return collections;
};

const productBelongsTo = (collections, target) => {
  const normalizedTarget = normalize(target);
  return collections.some((collection) => normalize(collection?.title) === normalizedTarget);
};

const resolveProductKind = async (product) => {
  const tags = parseTags(product?.tags);
  const collections = await fetchProductCollections(product?.id);

  if (tags.has('brac') && productBelongsTo(collections, 'Bracelet')) {
    return 'bracelet';
  }

  if (tags.has('nckl') && productBelongsTo(collections, 'Colliers')) {
    return 'necklace';
  }

  if (tags.has('brac')) {
    console.warn(`Product ${product?.id} missing Bracelet collection membership; falling back to tag.`);
    return 'bracelet';
  }

  if (tags.has('nckl')) {
    console.warn(`Product ${product?.id} missing Colliers collection membership; falling back to tag.`);
    return 'necklace';
  }

  return null;
};

const identifyChainType = (variant, productKind) => {
  const fields = collectVariantFields(variant);
  const source = productKind === 'necklace' ? supplementsState.necklace : supplementsState.bracelet;

  for (const field of fields) {
    for (const [normalizedName, config] of source) {
      if (field.includes(normalizedName)) {
        return { key: normalizedName, config };
      }
    }
  }

  return null;
};

const extractVariantSize = (variant) => {
  const fields = [variant.option1, variant.option2, variant.option3, variant.title];
  for (const field of fields) {
    if (!field) continue;
    const size = findSizeInText(field);
    if (Number.isFinite(size)) {
      return size;
    }
  }
  return null;
};

const pickForsatBaseVariant = (variants, productKind) => {
  const candidates = [];
  for (const variant of variants) {
    const chainType = identifyChainType(variant, productKind);
    if (!chainType || chainType.key !== FORSAT_S_KEY) {
      continue;
    }

    const size = productKind === 'necklace' ? extractVariantSize(variant) : null;
    candidates.push({ variant, size });
  }

  if (candidates.length === 0) {
    return null;
  }

  if (productKind !== 'necklace') {
    return candidates[0].variant;
  }

  let best = candidates[0];
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.size)) {
      continue;
    }
    if (!Number.isFinite(best.size)) {
      best = candidate;
      continue;
    }
    const candidateDiff = Math.abs(candidate.size - DEFAULT_NECKLACE_SIZE);
    const bestDiff = Math.abs(best.size - DEFAULT_NECKLACE_SIZE);
    if (candidateDiff < bestDiff) {
      best = candidate;
    }
  }

  return best.variant;
};

const calculateBraceletPrice = (basePrice, chainConfig) => basePrice + chainConfig.supplement;

const calculateNecklacePrice = (basePrice, chainConfig, size) => {
  const normalizedSize = Number.isFinite(size) ? size : DEFAULT_NECKLACE_SIZE;
  const delta = normalizedSize - DEFAULT_NECKLACE_SIZE;
  return basePrice + chainConfig.supplement + delta * chainConfig.perCm;
};

const pricesEqual = (current, target) => Math.abs(moneyToNumber(current) - target) < 0.005;

const updateVariantPrice = async (variantId, price, compareAtPrice) => {
  const url = `https://${VITE_SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/variants/${variantId}.json`;
  const payload = {
    variant: {
      id: variantId,
      price: formatMoney(price),
    },
  };

  if (compareAtPrice !== null && compareAtPrice !== undefined) {
    payload.variant.compare_at_price = formatMoney(compareAtPrice);
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update variant ${variantId}: ${response.status} ${text}`);
  }
};

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.post('/webhooks/product-update', async (req, res) => {
  if (!verifyShopifySignature(req)) {
    return res.status(401).send('Invalid signature');
  }

  const product = req.body;
  if (!product?.variants?.length) {
    return res.status(200).json({ skipped: true, reason: 'No variants found' });
  }

  try {
    const productKind = await resolveProductKind(product);
    if (!productKind) {
      return res.status(200).json({ skipped: true, reason: 'Product not bracelet or necklace' });
    }

    const baseVariant = pickForsatBaseVariant(product.variants, productKind);
    if (!baseVariant) {
      return res.status(200).json({ skipped: true, reason: 'Forsat S base variant missing' });
    }

    const basePrice = moneyToNumber(baseVariant.price);
    const baseCompareAt = baseVariant.compare_at_price ? moneyToNumber(baseVariant.compare_at_price) : null;

    const updates = [];

    for (const variant of product.variants) {
      if (variant.id === baseVariant.id) {
        continue;
      }

      const chainType = identifyChainType(variant, productKind);
      if (!chainType) {
        continue;
      }

      let targetPrice = null;
      if (productKind === 'bracelet') {
        targetPrice = calculateBraceletPrice(basePrice, chainType.config);
      } else if (productKind === 'necklace') {
        const size = extractVariantSize(variant);
        targetPrice = calculateNecklacePrice(basePrice, chainType.config, size);
      } else {
        continue;
      }

      const targetCompareAt = baseCompareAt !== null ? baseCompareAt + (targetPrice - basePrice) : null;

      if (targetPrice === null) {
        continue;
      }

      if (pricesEqual(variant.price, targetPrice) && pricesEqual(variant.compare_at_price, targetCompareAt ?? variant.compare_at_price)) {
        continue;
      }

      updates.push({
        variant,
        targetPrice,
        targetCompareAt,
      });
    }

    if (updates.length === 0) {
      return res.status(200).json({ updated: 0 });
    }

    let success = 0;
    for (const update of updates) {
      try {
        await updateVariantPrice(update.variant.id, update.targetPrice, update.targetCompareAt);
        success += 1;
      } catch (error) {
        console.error(error);
      }
    }

    return res.status(200).json({ updated: success, attempted: updates.length });
  } catch (error) {
    console.error('Failed to process product update webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
