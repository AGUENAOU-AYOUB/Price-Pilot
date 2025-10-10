import {
  SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_API_VERSION,
  SHOPIFY_STORE_DOMAIN,
} from '../config/shopify';

const PRODUCTS_ENDPOINT = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products.json`;
const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
};

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

const normalizeVariants = (variants = []) => {
  const normalized = variants.map((variant) => ({
    id: String(variant.id),
    title: variant.title,
    price: parseNumber(variant.price),
    compareAtPrice: parseNumber(variant.compare_at_price, parseNumber(variant.price)),
    position: Number.isFinite(variant.position) ? variant.position : Number.MAX_SAFE_INTEGER,
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

const buildProductsUrl = (pageInfo = null) => {
  const url = new URL(PRODUCTS_ENDPOINT);
  url.searchParams.set('status', 'active');
  url.searchParams.set('limit', '250');
  url.searchParams.set('fields', 'id,title,handle,status,tags,product_type,variants');
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

export async function fetchActiveProducts() {
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('Missing Shopify credentials');
  }

  const products = [];
  let pageInfo = null;

  do {
    const response = await fetch(buildProductsUrl(pageInfo), {
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
      if (product.status !== 'active') {
        continue;
      }
      products.push(transformShopifyProduct(product));
    }

    pageInfo = parseLinkHeader(response.headers.get('link'));
  } while (pageInfo);

  return products;
}
