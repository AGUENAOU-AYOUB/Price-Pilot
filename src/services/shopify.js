import { SHOPIFY_PROXY_URL } from '../config/shopify';

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

const parseNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeVariant = (variant) => {
  if (!variant || typeof variant !== 'object') {
    return {
      id: '',
      title: '',
      price: 0,
      compareAtPrice: 0,
      options: [],
    };
  }

  const price = parseNumber(variant.price, 0);
  const compareAtPrice = parseNumber(variant.compareAtPrice, price);
  const options = Array.isArray(variant.options)
    ? variant.options.map((option) => String(option ?? '').trim()).filter(Boolean)
    : [];

  return {
    id: String(variant.id ?? ''),
    title: variant.title ?? '',
    price,
    compareAtPrice,
    options,
  };
};

const normalizeMetafields = (metafields) => {
  if (!metafields || typeof metafields !== 'object') {
    return {};
  }

  if (Array.isArray(metafields)) {
    const normalized = {};
    for (const entry of metafields) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const key = entry.key ?? entry.name ?? entry.handle ?? entry.id;
      if (!key) {
        continue;
      }

      normalized[String(key)] = entry.value ?? entry.values ?? entry;
    }
    return normalized;
  }

  return { ...metafields };
};

const normalizeProduct = (product) => {
  if (!product || typeof product !== 'object') {
    return null;
  }

  const basePrice = parseNumber(product.basePrice, 0);
  const baseCompareAtPrice = parseNumber(product.baseCompareAtPrice, basePrice);

  return {
    id: String(product.id ?? ''),
    title: product.title ?? '',
    handle: product.handle ?? '',
    collection: product.collection ?? null,
    tags: Array.isArray(product.tags) ? product.tags : [],
    basePrice,
    baseCompareAtPrice,
    variants: Array.isArray(product.variants) ? product.variants.map(normalizeVariant) : [],
    status: product.status ?? 'inactive',
    metafields: normalizeMetafields(product.metafields),
  };
};

const buildProxyEndpoint = () => {
  if (!SHOPIFY_PROXY_URL) {
    throw new Error('Missing Shopify proxy URL');
  }

  return trimTrailingSlash(SHOPIFY_PROXY_URL);
};

const fetchProducts = async ({ status = 'active' } = {}) => {
  const baseEndpoint = buildProxyEndpoint();
  const searchParams = new URLSearchParams();
  if (status) {
    searchParams.set('status', status);
  }

  const query = searchParams.toString();
  const response = await fetch(
    query ? `${baseEndpoint}/products?${query}` : `${baseEndpoint}/products`,
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to load Shopify products from proxy: ${response.status} ${response.statusText} - ${body}`,
    );
  }

  const payload = await response.json();
  const products = Array.isArray(payload?.products) ? payload.products : [];

  return products
    .map(normalizeProduct)
    .filter((product) => product !== null);
};

export async function fetchActiveProducts() {
  return fetchProducts({ status: 'active' });
}

const normalizeCollectionKey = (collection) =>
  typeof collection === 'string' ? collection.trim().toLowerCase() : '';

const collectNormalizedCollectionKeys = (target, collection) => {
  if (!target || !(target instanceof Set) || collection === null || collection === undefined) {
    return;
  }

  if (Array.isArray(collection)) {
    for (const entry of collection) {
      collectNormalizedCollectionKeys(target, entry);
    }
    return;
  }

  if (typeof collection === 'object') {
    const { handle, title, name } = collection;
    collectNormalizedCollectionKeys(target, handle);
    collectNormalizedCollectionKeys(target, title);
    collectNormalizedCollectionKeys(target, name);
    return;
  }

  const normalized = normalizeCollectionKey(collection);
  if (normalized) {
    target.add(normalized);
  }
};

export async function fetchProductsByCollections(collections = [], options = {}) {
  const normalizedCollections = new Set();
  if (Array.isArray(collections)) {
    for (const collection of collections) {
      collectNormalizedCollectionKeys(normalizedCollections, collection);
    }
  } else {
    collectNormalizedCollectionKeys(normalizedCollections, collections);
  }

  const universe = await fetchProducts(options);
  if (normalizedCollections.size === 0) {
    return universe;
  }

  return universe.filter((product) => {
    const productCollections = new Set();
    collectNormalizedCollectionKeys(productCollections, product?.collection);

    if (productCollections.size === 0) {
      return false;
    }

    for (const key of productCollections) {
      if (normalizedCollections.has(key)) {
        return true;
      }
    }

    return false;
  });
}

export async function pushVariantUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { updatedCount: 0, failedCount: 0, failures: [] };
  }

  const baseEndpoint = buildProxyEndpoint();
  const response = await fetch(`${baseEndpoint}/variants/bulk-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to push Shopify variant updates: ${response.status} ${response.statusText} - ${body}`,
    );
  }

  return response.json();
}
