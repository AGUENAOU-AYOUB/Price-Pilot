import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';

import {
  braceletChainTypes,
  necklaceChainTypes,
} from '../src/data/supplements.js';
import { recordVariantSelection } from './themeVariantEventStore.js';

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

const normalize = (value = '') => value.trim().toLowerCase();
const parseTags = (tags = '') =>
  new Set(
    tags
      .split(',')
      .map((tag) => normalize(tag))
      .filter(Boolean),
  );

const toNonEmptyString = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const asString = String(value).trim();
  return asString.length > 0 ? asString : null;
};

const normalizeSelectedOptions = (options) => {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .map((option) => {
      if (!option || typeof option !== 'object') {
        return null;
      }

      const name = toNonEmptyString(option.name ?? option.label);
      const value = toNonEmptyString(option.value ?? option.selection ?? option.option);

      if (!name || !value) {
        return null;
      }

      return {
        name,
        value,
      };
    })
    .filter(Boolean);
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

const determineFamily = (product) => {
  const tags = parseTags(product.tags);
  const type = normalize(product.product_type ?? '');

  if (tags.has('brac') || type.includes('bracelet')) return 'bracelet';
  if (tags.has('nckl') || type.includes('necklace')) return 'necklace';
  if (tags.has('set') || tags.has('ensemble') || type.includes('ensemble') || type.includes('set')) {
    return 'set';
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

const findOptionValue = (options, matcher) => {
  for (const option of options) {
    if (matcher(option)) {
      return option.value;
    }
  }
  return null;
};

app.post('/webhooks/theme-variant-selection', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({ error: 'Invalid payload. Expected JSON body.' });
    return;
  }

  const payload = req.body;
  const productId = toNonEmptyString(payload.productId ?? payload.id);
  const productHandle = toNonEmptyString(payload.productHandle ?? payload.handle);
  const variantId = toNonEmptyString(payload.variantId);
  const variantTitle = toNonEmptyString(payload.variantTitle ?? payload.title);
  const selectedOptions = normalizeSelectedOptions(
    payload.selectedOptions ?? payload.options ?? payload.variantOptions,
  );

  if (!productId && !productHandle) {
    res.status(400).json({ error: 'Missing product identifier. Provide productId or productHandle.' });
    return;
  }

  if (!variantId && !variantTitle) {
    res.status(400).json({ error: 'Missing variant identifier. Provide variantId or variantTitle.' });
    return;
  }

  const choisirValue = findOptionValue(selectedOptions, (option) => normalize(option.name) === 'choisir');
  const chainSizeValue = findOptionValue(selectedOptions, (option) => {
    const normalizedName = normalize(option.name);
    return normalizedName.includes('taille') || normalizedName.includes('chaine');
  });

  const event = {
    productId,
    productHandle,
    variantId,
    variantTitle,
    choisirValue,
    chainSize: chainSizeValue,
    selectedOptions,
    customerId: toNonEmptyString(payload.customerId ?? payload.customer?.id),
    cartId: toNonEmptyString(payload.cartId ?? payload.checkoutId ?? payload.cart?.id),
    source: {
      themeId: toNonEmptyString(payload.themeId ?? payload.theme?.id),
      themeName: toNonEmptyString(payload.themeName ?? payload.theme?.name),
      pageUrl: toNonEmptyString(payload.pageUrl ?? payload.context?.pageUrl ?? payload.location),
      sessionId: toNonEmptyString(payload.sessionId ?? payload.context?.sessionId),
      userAgent: toNonEmptyString(payload.userAgent ?? payload.context?.userAgent ?? req.get('User-Agent')),
      ip: req.ip,
    },
    receivedAt: new Date().toISOString(),
  };

  recordVariantSelection(event);

  console.log('Theme variant selection received', {
    product: event.productId ?? event.productHandle,
    variant: event.variantId ?? event.variantTitle,
    choisir: event.choisirValue,
    chainSize: event.chainSize,
  });

  res.status(202).json({ status: 'accepted' });
});

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
