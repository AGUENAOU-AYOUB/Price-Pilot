export const SHOPIFY_STORE_DOMAIN = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN ?? '';
export const SHOPIFY_ACCESS_TOKEN = import.meta.env.VITE_SHOPIFY_ACCESS_TOKEN ?? '';
export const SHOPIFY_API_VERSION = import.meta.env.VITE_SHOPIFY_API_VERSION ?? '2024-04';

export const hasShopifyCredentials = () =>
  Boolean(SHOPIFY_STORE_DOMAIN) && Boolean(SHOPIFY_ACCESS_TOKEN);
