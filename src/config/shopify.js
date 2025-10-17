const normalizeEnv = (value) => (typeof value === 'string' ? value.trim() : '');
const trimSlashes = (value) => value.replace(/^\/+|\/+$/g, '');

const DEFAULT_PROXY_BASE_PATH = 'api/shopify';

const rawProxyUrl = normalizeEnv(import.meta.env.VITE_SHOPIFY_PROXY_URL ?? '');
const configuredProxyBasePath = trimSlashes(
  normalizeEnv(import.meta.env.VITE_SHOPIFY_PROXY_BASE_PATH ?? DEFAULT_PROXY_BASE_PATH),
);

const computeProxyBaseUrl = () => {
  if (!rawProxyUrl) {
    return '';
  }

  try {
    const parsed = new URL(rawProxyUrl);
    const origin = `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
    const basePath = trimSlashes(parsed.pathname) || configuredProxyBasePath;
    return basePath ? `${origin}/${basePath}` : origin;
  } catch (error) {
    return rawProxyUrl.replace(/\/+$/, '');
  }
};

const joinProxyPath = (base, path) => {
  const normalizedBase = base.replace(/\/+$/, '');
  if (!path) {
    return normalizedBase;
  }

  const normalizedPath = normalizeEnv(path);
  if (!normalizedPath) {
    return normalizedBase;
  }

  const [pathPart, queryPart] = normalizedPath.split('?');
  const trimmedPath = trimSlashes(pathPart);
  const joined = trimmedPath ? `${normalizedBase}/${trimmedPath}` : normalizedBase;
  return queryPart ? `${joined}?${queryPart}` : joined;
};

export const SHOPIFY_STORE_DOMAIN = normalizeEnv(import.meta.env.VITE_SHOPIFY_STORE_DOMAIN ?? '');
export const SHOPIFY_API_VERSION = normalizeEnv(import.meta.env.VITE_SHOPIFY_API_VERSION ?? '2024-04');
export const SHOPIFY_PROXY_URL = computeProxyBaseUrl();

export const hasShopifyProxy = () => Boolean(SHOPIFY_PROXY_URL);

export const buildShopifyProxyUrl = (path = '') => {
  if (!SHOPIFY_PROXY_URL) {
    throw new Error('Missing Shopify proxy URL');
  }

  return joinProxyPath(SHOPIFY_PROXY_URL, path);
};
