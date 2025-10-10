const normalizeEnv = (value) => (typeof value === 'string' ? value.trim() : '');

export const SHOPIFY_STORE_DOMAIN = normalizeEnv(import.meta.env.VITE_SHOPIFY_STORE_DOMAIN ?? '');
export const SHOPIFY_ACCESS_TOKEN = normalizeEnv(import.meta.env.VITE_SHOPIFY_ACCESS_TOKEN ?? '');
export const SHOPIFY_API_VERSION = normalizeEnv(import.meta.env.VITE_SHOPIFY_API_VERSION ?? '2024-04');
export const SHOPIFY_PROXY_URL = normalizeEnv(import.meta.env.VITE_SHOPIFY_PROXY_URL ?? '');

export const hasShopifyProxy = () => Boolean(SHOPIFY_PROXY_URL);
