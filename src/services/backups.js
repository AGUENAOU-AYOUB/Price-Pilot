import { SHOPIFY_PROXY_URL, hasShopifyProxy } from '../config/shopify';

const VALID_BACKUP_SCOPES = new Set([
  'global',
  'bracelets',
  'necklaces',
  'rings',
  'handchains',
  'sets',
]);

const normalizeScope = (scope) => {
  const normalized = typeof scope === 'string' ? scope.trim().toLowerCase() : '';
  return VALID_BACKUP_SCOPES.has(normalized) ? normalized : '';
};

const buildBackupEndpoint = (scope) => {
  const normalized = normalizeScope(scope);
  if (!normalized) {
    throw new Error(`Unknown backup scope: ${scope}`);
  }

  if (!SHOPIFY_PROXY_URL) {
    throw new Error('Missing Shopify proxy URL for backup synchronization.');
  }

  return `${SHOPIFY_PROXY_URL}/backups/${normalized}`;
};

const sanitizeBackupPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      timestamp: new Date().toISOString(),
      products: [],
    };
  }

  const timestamp =
    typeof payload.timestamp === 'string' && payload.timestamp.trim()
      ? payload.timestamp
      : new Date().toISOString();

  const products = Array.isArray(payload.products) ? payload.products : [];

  return {
    timestamp,
    products: JSON.parse(JSON.stringify(products)),
  };
};

export async function persistScopeBackup(scope, payload) {
  if (!hasShopifyProxy()) {
    return null;
  }

  try {
    const endpoint = buildBackupEndpoint(scope);
    const sanitizedPayload = sanitizeBackupPayload(payload);
    console.log('[Backups] Persisting scope backup', {
      scope: normalizeScope(scope),
      endpoint,
      productCount: sanitizedPayload.products?.length ?? 0,
      timestamp: sanitizedPayload.timestamp,
    });
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sanitizedPayload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to persist backup: ${response.status} ${response.statusText} - ${body}`,
      );
    }

    const result = await response.json().catch(() => null);
    return result?.backup ?? null;
  } catch (error) {
    console.warn('Failed to persist backup to proxy:', error);
    return null;
  }
}

export async function fetchScopeBackup(scope) {
  if (!hasShopifyProxy()) {
    return null;
  }

  try {
    const endpoint = buildBackupEndpoint(scope);
    console.log('[Backups] Fetching stored backup', {
      scope: normalizeScope(scope),
      endpoint,
    });
    const response = await fetch(endpoint);

    if (response.status === 404) {
      console.log('[Backups] No stored backup found', { scope: normalizeScope(scope) });
      return null;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to load stored backup: ${response.status} ${response.statusText} - ${body}`,
      );
    }

    const payload = await response.json().catch(() => null);
    console.log('[Backups] Loaded stored backup payload', {
      scope: normalizeScope(scope),
      productCount: payload?.backup?.products?.length ?? 0,
    });
    return payload?.backup ?? null;
  } catch (error) {
    console.warn('Failed to load backup from proxy:', error);
    return null;
  }
}
