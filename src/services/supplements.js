import { SHOPIFY_PROXY_URL, hasShopifyProxy } from '../config/shopify';

const buildSupplementsEndpoint = () => {
  if (!SHOPIFY_PROXY_URL) {
    throw new Error('Missing Shopify proxy URL for supplement synchronization.');
  }

  return `${SHOPIFY_PROXY_URL}/supplements`;
};

export async function syncSupplementsFile({ bracelets = {}, necklaces = {} } = {}) {
  if (!hasShopifyProxy()) {
    return null;
  }

  try {
    const endpoint = buildSupplementsEndpoint();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bracelets, necklaces }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to synchronize supplements file: ${response.status} ${response.statusText} - ${body}`,
      );
    }

    const payload = await response.json().catch(() => null);
    return payload;
  } catch (error) {
    console.warn('Failed to synchronize supplements file with proxy:', error);
    return null;
  }
}
