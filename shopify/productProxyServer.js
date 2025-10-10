import 'dotenv/config';
import express from 'express';

const {
  VITE_SHOPIFY_STORE_DOMAIN,
  SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_API_VERSION = '2024-04',
  SHOPIFY_PROXY_PORT = 4000,
  SHOPIFY_PROXY_BASE_PATH = '/api/shopify',
  SHOPIFY_PROXY_ALLOWED_ORIGINS = '',
} = process.env;

if (!VITE_SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
  console.error(
    'Missing Shopify environment variables. Ensure VITE_SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN are set.',
  );
  process.exit(1);
}

const PRODUCTS_ENDPOINT = `https://${VITE_SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products.json`;
const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
};

const parseAllowedOrigins = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins(SHOPIFY_PROXY_ALLOWED_ORIGINS);
const basePath = SHOPIFY_PROXY_BASE_PATH.endsWith('/')
  ? SHOPIFY_PROXY_BASE_PATH.slice(0, -1)
  : SHOPIFY_PROXY_BASE_PATH;

const app = express();

app.use(
  express.json({
    limit: '1mb',
  }),
);

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (allowedOrigins.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

const parseNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseTags = (tags = '') =>
  tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

const determineCollection = (product) => {
  const normalizedTags = parseTags(product.tags)
    .map((tag) => tag.toLowerCase())
    .reduce((acc, tag) => acc.add(tag), new Set());
  const normalizedType = (product.product_type ?? '').trim().toLowerCase();

  if (normalizedTags.has('brac') || normalizedType.includes('bracelet')) {
    return 'bracelet';
  }
  if (
    normalizedTags.has('nckl') ||
    normalizedType.includes('necklace') ||
    normalizedType.includes('collier')
  ) {
    return 'collier';
  }
  if (
    normalizedTags.has('rng') ||
    normalizedType.includes('ring') ||
    normalizedType.includes('bague')
  ) {
    return 'bague';
  }
  if (
    normalizedTags.has('hand') ||
    normalizedTags.has('handchain') ||
    normalizedType.includes('hand chain') ||
    normalizedType.includes('handchain')
  ) {
    return 'handchain';
  }
  if (
    normalizedTags.has('set') ||
    normalizedTags.has('ensemble') ||
    normalizedType.includes('set') ||
    normalizedType.includes('ensemble')
  ) {
    return 'ensemble';
  }

  return null;
};

const extractVariantOptions = (variant) => {
  const options = [];

  if (variant.option1) {
    options.push(String(variant.option1));
  }
  if (variant.option2) {
    options.push(String(variant.option2));
  }
  if (variant.option3) {
    options.push(String(variant.option3));
  }

  return options.map((option) => option.trim()).filter(Boolean);
};

const normalizeVariants = (variants = []) => {
  const normalized = variants.map((variant) => ({
    id: String(variant.id),
    title: variant.title,
    price: parseNumber(variant.price),
    compareAtPrice: parseNumber(variant.compare_at_price, parseNumber(variant.price)),
    position: Number.isFinite(variant.position) ? variant.position : Number.MAX_SAFE_INTEGER,
    options: extractVariantOptions(variant),
  }));

  const sortedByPosition = [...normalized].sort((a, b) => a.position - b.position);
  const baseVariant = sortedByPosition[0] ?? {
    price: 0,
    compareAtPrice: 0,
  };

  return {
    basePrice: baseVariant.price,
    baseCompareAtPrice: baseVariant.compareAtPrice,
    variants: normalized.map(({ position, ...rest }) => rest),
  };
};

const parseLinkHeader = (header) => {
  if (!header) return null;

  const links = header.split(',');
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/i);
    if (!match) continue;
    try {
      const url = new URL(match[1]);
      return url.searchParams.get('page_info');
    } catch (error) {
      console.warn('Failed to parse Shopify pagination URL', error);
    }
  }

  return null;
};

const buildProductsUrl = ({ status = 'active', pageInfo = null }) => {
  const url = new URL(PRODUCTS_ENDPOINT);
  url.searchParams.set('limit', '250');
  url.searchParams.set('fields', 'id,title,handle,status,tags,product_type,variants');
  if (status) {
    url.searchParams.set('status', status);
  }
  if (pageInfo) {
    url.searchParams.set('page_info', pageInfo);
  }
  return url.toString();
};

const transformShopifyProduct = (product) => {
  const { basePrice, baseCompareAtPrice, variants } = normalizeVariants(product.variants);
  const tags = parseTags(product.tags);

  return {
    id: String(product.id),
    title: product.title,
    handle: product.handle,
    collection: determineCollection(product),
    tags,
    basePrice,
    baseCompareAtPrice,
    variants,
    status: product.status === 'active' ? 'active' : product.status ?? 'inactive',
  };
};

const VARIANT_ENDPOINT = (variantId) =>
  `https://${VITE_SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/variants/${variantId}.json`;

const formatMoney = (value) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed.toFixed(2);
};

const buildVariantPayload = (variant) => {
  if (!variant || typeof variant !== 'object') {
    return null;
  }

  const price = formatMoney(variant.price);
  const compareAtPrice = formatMoney(variant.compareAtPrice);

  if (price === null && compareAtPrice === null) {
    return null;
  }

  const payload = { id: String(variant.id ?? '') };

  if (price !== null) {
    payload.price = price;
  }

  if (compareAtPrice !== null) {
    payload.compare_at_price = compareAtPrice;
  }

  if (!payload.id) {
    return null;
  }

  return payload;
};

const updateVariantPrice = async (variant) => {
  const payload = buildVariantPayload(variant);

  if (!payload) {
    throw new Error('Invalid variant payload provided for update.');
  }

  const response = await fetch(VARIANT_ENDPOINT(payload.id), {
    method: 'PUT',
    headers: REQUEST_HEADERS,
    body: JSON.stringify({ variant: payload }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to update variant ${payload.id}: ${response.status} ${response.statusText} - ${body}`,
    );
  }
};

const fetchProducts = async (status = 'active') => {
  const products = [];
  let pageInfo = null;

  do {
    const response = await fetch(buildProductsUrl({ status, pageInfo }), {
      headers: REQUEST_HEADERS,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to load Shopify products: ${response.status} ${response.statusText} - ${body}`,
      );
    }

    const payload = await response.json();
    const batch = Array.isArray(payload?.products) ? payload.products : [];

    for (const product of batch) {
      if (status === 'active' && product.status !== 'active') {
        continue;
      }
      products.push(transformShopifyProduct(product));
    }

    pageInfo = parseLinkHeader(response.headers.get('link'));
  } while (pageInfo);

  return products;
};

app.get(`${basePath}/healthz`, (_req, res) => {
  res.json({ status: 'ok' });
});

app.get(`${basePath}/products`, async (req, res) => {
  const { status = 'active' } = req.query;

  try {
    const products = await fetchProducts(status);
    res.json({ products });
  } catch (error) {
    console.error('Failed to synchronize Shopify products', error);
    res.status(502).json({
      error: 'Failed to load products from Shopify.',
      details: error.message,
    });
  }
});

app.post(`${basePath}/variants/bulk-update`, async (req, res) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];

  if (updates.length === 0) {
    res.status(400).json({ error: 'No variant updates provided.' });
    return;
  }

  const summary = {
    updatedCount: 0,
    failedCount: 0,
    failures: [],
  };

  for (const entry of updates) {
    const productId = String(entry?.productId ?? '');
    const productTitle = entry?.productTitle ?? '';
    const variants = Array.isArray(entry?.variants) ? entry.variants : [];

    for (const variant of variants) {
      try {
        await updateVariantPrice(variant);
        summary.updatedCount += 1;
      } catch (error) {
        summary.failedCount += 1;
        summary.failures.push({
          productId,
          productTitle,
          variantId: variant?.id ? String(variant.id) : '',
          reason: error.message,
        });
      }
    }
  }

  const statusCode = summary.failedCount > 0 ? 207 : 200;
  res.status(statusCode).json(summary);
});

app.listen(Number(SHOPIFY_PROXY_PORT), () => {
  console.log(
    `Shopify product proxy listening on port ${SHOPIFY_PROXY_PORT} at path ${basePath}.`,
  );
});
