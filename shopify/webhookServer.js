// shopify/webhookServer.js
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
  DEBUG_WEBHOOK, // set to "1" for verbose logs
} = process.env;

const DEBUG = String(DEBUG_WEBHOOK || '') === '1';
const redact = (s) => (s ? `${String(s).slice(0, 4)}…` : s);
const now = () => new Date().toISOString();
const log = {
  debug: (...a) => DEBUG && console.debug(`[webhook ${now()}]`, ...a),
  info: (...a) => console.info(`[webhook ${now()}]`, ...a),
  warn: (...a) => console.warn(`[webhook ${now()}]`, ...a),
  error: (...a) => console.error(`[webhook ${now()}]`, ...a),
};

if (!VITE_SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN || !SHOPIFY_WEBHOOK_SECRET) {
  console.error(
    'Missing env vars. Need VITE_SHOPIFY_STORE_DOMAIN, SHOPIFY_ACCESS_TOKEN, SHOPIFY_WEBHOOK_SECRET.',
  );
  process.exit(1);
}

log.info(`Node ${process.version} starting webhook server…`);

const SUPPLEMENTS_PATH = path.resolve(process.cwd(), 'src/data/supplements.js');
const DEFAULT_BRACELET_SIZE = 41;
const DEFAULT_NECKLACE_SIZE = 41;
const FORSAT_S_KEY = 'forsat s';

// ---------- utils ----------
const stripDiacritics = (value = '') =>
  String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalize = (value = '') => {
  if (value === null || value === undefined) return '';
  return stripDiacritics(String(value)).trim().toLowerCase();
};

const sanitizeVariantKey = (value = '') => {
  const normalized = stripDiacritics(String(value))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return normalized || null;
};

const moneyToNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};
const formatMoney = (value) => (Math.round(value * 100) / 100).toFixed(2);

const parseTags = (tags = '') => {
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  return new Set(list.map((t) => normalize(t)).filter(Boolean));
};

const findSizeInText = (value) => {
  const norm = normalize(value);
  const cm = norm.match(/(\d+(?:\.\d+)?)\s*cm/);
  if (cm) return Number.parseFloat(cm[1]);
  const any = norm.match(/(\d+(?:\.\d+)?)/);
  if (any) return Number.parseFloat(any[1]);
  return null;
};

const collectVariantFields = (variant) =>
  [variant.title, variant.option1, variant.option2, variant.option3]
    .filter(Boolean)
    .map((v) => normalize(v));

const DEFAULT_BRACELET_PARENT_KEY = 'default';

const identifyBraceletParentKey = (variant, chainKeyNormalized) => {
  const fields = collectVariantFields(variant);
  const parentParts = [];

  for (const field of fields) {
    if (!field) continue;
    if (field === chainKeyNormalized) continue;
    if (field === 'default' || field === 'default title' || field === 'defaulttitle') continue;
    if (/\b(cm|centim|millim|mm)\b/.test(field)) continue;

    const sanitized = sanitizeVariantKey(field);
    if (!sanitized || parentParts.includes(sanitized)) {
      continue;
    }

    parentParts.push(sanitized);
  }

  if (parentParts.length === 0) {
    return DEFAULT_BRACELET_PARENT_KEY;
  }

  return parentParts.join('::');
};

// ---------- supplements (hot-reloaded ESM) ----------
const supplementsState = {
  bracelet: new Map(),
  necklace: new Map(),
  necklaceSizes: [],
};

const sanitizeNecklaceSizeMap = (value, allowedSizes = []) => {
  const sizeSet = Array.isArray(allowedSizes) ? new Set(allowedSizes.map(Number)) : null;
  const result = new Map();

  if (!value || typeof value !== 'object') {
    return result;
  }

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const size = Number(rawKey);
    if (!Number.isFinite(size)) {
      continue;
    }

    if (sizeSet && sizeSet.size > 0 && !sizeSet.has(size)) {
      continue;
    }

    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      continue;
    }

    result.set(size, numeric);
  }

  return result;
};

const refreshDerivedSupplements = (module) => {
  supplementsState.bracelet.clear();
  supplementsState.necklace.clear();
  supplementsState.braceletBase = module?.braceletChainTypes ?? {};
  supplementsState.necklaceBase = module?.necklaceChainTypes ?? {};
  supplementsState.necklaceSizes = Array.isArray(module?.necklaceSizes) ? [...module.necklaceSizes] : [];

  for (const [name, supplement] of Object.entries(supplementsState.braceletBase)) {
    supplementsState.bracelet.set(normalize(name), { name, supplement: Number(supplement) || 0 });
  }
  for (const [name, config] of Object.entries(supplementsState.necklaceBase)) {
    const key = normalize(name);
    const sizes = sanitizeNecklaceSizeMap(config?.sizes, supplementsState.necklaceSizes);
    supplementsState.necklace.set(key, {
      name,
      supplement: Number(config?.supplement) || 0,
      perCm: Number(config?.perCm) || 0,
      sizes,
    });
  }

  log.debug('Supplements refreshed.', {
    braceletKeys: Array.from(supplementsState.bracelet.keys()),
    necklaceKeys: Array.from(supplementsState.necklace.keys()),
    necklaceSizes: supplementsState.necklaceSizes,
  });
};

const loadSupplements = async () => {
  try {
    const moduleUrl = `${pathToFileURL(SUPPLEMENTS_PATH).href}?t=${Date.now()}`;
    const module = await import(moduleUrl);
    refreshDerivedSupplements(module);
    log.info('Supplements loaded.');
  } catch (e) {
    log.error('Failed to load supplements.', e);
  }
};

let supplementsReady = loadSupplements();

try {
  fs.watch(SUPPLEMENTS_PATH, { persistent: false }, (ev) => {
    if (ev === 'change' || ev === 'rename') {
      log.info('Supplements file change detected, reloading…');
      supplementsReady = loadSupplements();
    }
  });
} catch (e) {
  log.warn('Could not watch supplement file for changes:', e);
}

// ---------- express ----------
const app = express();
app.use(
  express.json({
    type: 'application/json',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// ---------- signature ----------
const verifyShopifySignature = (req) => {
  const header = req.get('X-Shopify-Hmac-Sha256');
  if (!header) return false;
  const digest = crypto.createHmac('sha256', SHOPIFY_WEBHOOK_SECRET).update(req.rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(header, 'base64'), Buffer.from(digest, 'base64'));
  } catch (e) {
    log.warn('Failed to verify webhook signature:', e);
    return false;
  }
};

// ---------- collections ----------
const collectionCache = new Map(); // productId -> {timestamp, collections}
const COLLECTION_TTL = 5 * 60 * 1000;

const fetchProductCollections = async (productId, reqId) => {
  if (!productId) return [];
  const cached = collectionCache.get(productId);
  if (cached && Date.now() - cached.timestamp < COLLECTION_TTL) {
    log.debug(`[${reqId}] collections cache hit for product ${productId}`);
    return cached.collections;
  }

  const url = `https://${VITE_SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}/collections.json`;
  log.debug(`[${reqId}] fetching collections`, { url, token: redact(SHOPIFY_ACCESS_TOKEN) });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    log.warn(`[${reqId}] load product collections failed`, productId, response.status, text);
    return [];
  }

  const payload = await response.json();
  const collections = Array.isArray(payload?.collections) ? payload.collections : [];
  collectionCache.set(productId, { timestamp: Date.now(), collections });
  log.debug(
    `[${reqId}] collections loaded`,
    collections.map((c) => ({ id: c.id, title: c.title })),
  );
  return collections;
};

const productBelongsTo = (collections, target) => {
  const normalizedTarget = normalize(target);
  return collections.some((c) => normalize(c?.title) === normalizedTarget);
};

// ---------- kind / chain / size helpers ----------
const resolveProductKind = async (product, reqId) => {
  const tags = parseTags(product?.tags);
  const collections = await fetchProductCollections(product?.id, reqId);

  const inBracelet = productBelongsTo(collections, 'Bracelet');
  const inNecklace = productBelongsTo(collections, 'Colliers');

  // accept tag OR collection
  if (tags.has('brac') || inBracelet) {
    log.debug(`[${reqId}] kind=bracelet (${inBracelet ? 'collection' : 'tag'})`);
    return 'bracelet';
  }
  if (tags.has('nckl') || inNecklace) {
    log.debug(`[${reqId}] kind=necklace (${inNecklace ? 'collection' : 'tag'})`);
    return 'necklace';
  }

  log.warn(
    `[${reqId}] kind unresolved (tags=${[...tags].join(',')}, collections=${collections
      .map((c) => c.title)
      .join('|')})`,
  );
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
  for (const f of fields) {
    if (!f) continue;
    const size = findSizeInText(f);
    if (Number.isFinite(size)) return size;
  }
  return null;
};

const pickForsatBaseVariant = (variants, productKind, reqId) => {
  const candidates = [];
  for (const v of variants) {
    const chainType = identifyChainType(v, productKind);
    if (chainType?.key === FORSAT_S_KEY) {
      const size = extractVariantSize(v);
      candidates.push({ variant: v, size });
    }
  }

  if (candidates.length === 0) {
    // fallback by title text if mapping ever misses
    const byTitle = variants.find((v) => collectVariantFields(v).some((f) => f.includes(FORSAT_S_KEY)));
    if (byTitle) {
      log.warn(`[${reqId}] base via title fallback: ${byTitle.id} "${byTitle.title}"`);
      return byTitle;
    }
    log.warn(`[${reqId}] no Forsat S base found`);
    return null;
  }

  log.debug(`[${reqId}] Forsat S candidates: ${candidates.length}`);

  const targetSize = productKind === 'necklace' ? DEFAULT_NECKLACE_SIZE : DEFAULT_BRACELET_SIZE;

  let best = candidates[0];
  for (const c of candidates) {
    if (!Number.isFinite(c.size)) continue;

    if (!Number.isFinite(best.size)) {
      best = c;
      continue;
    }

    const d1 = Math.abs(c.size - targetSize);
    const d2 = Math.abs(best.size - targetSize);
    if (d1 < d2) best = c;
  }

  return best.variant;
};

// ---------- pricing ----------
const calculateNecklacePrice = (basePrice, chainConfig = {}, size) => {
  const normalizedSize = Number.isFinite(size) ? size : DEFAULT_NECKLACE_SIZE;
  const override =
    chainConfig?.sizes instanceof Map ? chainConfig.sizes.get(normalizedSize) : undefined;
  if (Number.isFinite(override)) {
    return basePrice + override;
  }

  const baseSupplement = Number(chainConfig?.supplement) || 0;
  const perCm = Number(chainConfig?.perCm) || 0;
  const delta = normalizedSize - DEFAULT_NECKLACE_SIZE;
  const incremental = delta > 0 ? delta * perCm : 0;

  return basePrice + baseSupplement + incremental;
};

const pricesEqual = (current, target) =>
  typeof target === 'number' && !Number.isNaN(target) && Math.abs(moneyToNumber(current) - target) < 0.005;

const compareAtEqual = (current, target) => {
  if (target == null) return current == null || current === '' || moneyToNumber(current) === 0;
  return pricesEqual(current, target);
};

const updateVariantPrice = async (variantId, price, compareAtPrice, reqId) => {
  const url = `https://${VITE_SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/variants/${variantId}.json`;
  const payload = {
    variant: {
      id: variantId,
      price: formatMoney(price),
      // include compare_at_price explicitly so it can be cleared when null
      compare_at_price: compareAtPrice == null ? null : formatMoney(compareAtPrice),
    },
  };

  log.debug(`[${reqId}] PUT variant`, { url, body: payload });

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text(); // read once (ok or error)
  if (!response.ok) {
    throw new Error(`Failed to update variant ${variantId}: ${response.status} ${text}`);
  }
  log.info(`[${reqId}] Updated variant ${variantId} OK`, text.slice(0, 400));
};

// ---------- routes ----------
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.post('/webhooks/product-update', async (req, res) => {
  const reqId = crypto.randomUUID();
  const start = Date.now();

  log.info(
    `[${reqId}] → received /webhooks/product-update (topic=${req.get('X-Shopify-Topic')}, shop=${req.get(
      'X-Shopify-Shop-Domain',
    )}, len=${req.get('Content-Length')}, hmac=${req.get('X-Shopify-Hmac-Sha256') ? 'present' : 'missing'})`,
  );

  const signatureOk = verifyShopifySignature(req);
  log.info(`[${reqId}] signature ${signatureOk ? 'OK' : 'FAIL'}`);
  if (!signatureOk) return res.status(401).send('Invalid signature');

  const product = req.body;
  log.debug(`[${reqId}] product`, {
    id: product?.id,
    title: product?.title,
    tags: product?.tags,
    variants: product?.variants?.length,
  });

  if (!product?.variants?.length) {
    log.warn(`[${reqId}] no variants found, skipping`);
    return res.status(200).json({ skipped: true, reason: 'No variants found' });
  }

  try {
    const t0 = Date.now();
    await supplementsReady;
    log.debug(`[${reqId}] supplements ready in ${Date.now() - t0}ms`);

    const productKind = await resolveProductKind(product, reqId);
    if (!productKind) {
      log.warn(`[${reqId}] product not bracelet or necklace, skipping`);
      return res.status(200).json({ skipped: true, reason: 'Product not bracelet or necklace' });
    }

    const updates = [];

    if (productKind === 'bracelet') {
      const contexts = new Map();

      for (const variant of product.variants) {
        const chainType = identifyChainType(variant, productKind);
        if (!chainType) {
          log.debug(`[${reqId}] skip ${variant.id}: no chainType match for "${variant.title}"`);
          continue;
        }

        const parentKey = identifyBraceletParentKey(variant, chainType.key);
        const key = parentKey || DEFAULT_BRACELET_PARENT_KEY;
        if (!contexts.has(key)) {
          contexts.set(key, {
            parentKey: key,
            variants: [],
            baseVariantId: null,
            basePrice: null,
            baseCompareAt: null,
          });
        }

        const context = contexts.get(key);
        const hasPrice = variant.price !== null && variant.price !== undefined && variant.price !== '';
        const hasCompare =
          variant.compare_at_price !== null && variant.compare_at_price !== undefined && variant.compare_at_price !== '';
        const price = hasPrice ? moneyToNumber(variant.price) : null;
        const compareAt = hasCompare ? moneyToNumber(variant.compare_at_price) : null;

        context.variants.push({
          variant,
          chainType,
          price,
          compareAt,
          hasPrice,
          hasCompare,
        });

        if (chainType.key === FORSAT_S_KEY) {
          context.baseVariantId = variant.id;
          if (hasPrice) {
            context.basePrice = price;
          }
          context.baseCompareAt = hasCompare ? compareAt : null;
        }
      }

      if (contexts.size === 0) {
        log.warn(`[${reqId}] no bracelet chain matches, skipping`);
        return res.status(200).json({ skipped: true, reason: 'No bracelet chain matches' });
      }

      for (const context of contexts.values()) {
        if (!Number.isFinite(context.basePrice)) {
          for (const entry of context.variants) {
            const supplement = Number(entry.chainType.config?.supplement);
            if (!entry.hasPrice || !Number.isFinite(supplement)) {
              continue;
            }

            const candidate = entry.price - supplement;
            if (Number.isFinite(candidate)) {
              context.basePrice = candidate;
              break;
            }
          }
        }

        if (!Number.isFinite(context.baseCompareAt)) {
          for (const entry of context.variants) {
            const supplement = Number(entry.chainType.config?.supplement);
            if (!entry.hasCompare || !Number.isFinite(supplement)) {
              continue;
            }

            const candidate = entry.compareAt - supplement;
            if (Number.isFinite(candidate)) {
              context.baseCompareAt = candidate;
              break;
            }
          }
        }

        if (!Number.isFinite(context.basePrice)) {
          log.warn(`[${reqId}] parent=${context.parentKey} missing base price, skipping context`);
          continue;
        }

        if (!Number.isFinite(context.baseCompareAt)) {
          context.baseCompareAt = null;
        }

        log.debug(`[${reqId}] context base`, {
          parent: context.parentKey,
          basePrice: context.basePrice,
          baseCompareAt: context.baseCompareAt,
          baseVariantId: context.baseVariantId,
        });

        for (const entry of context.variants) {
          if (entry.chainType.key === FORSAT_S_KEY && context.baseVariantId === entry.variant.id) {
            log.debug(`[${reqId}] skip base ${entry.variant.id} (parent=${context.parentKey})`);
            continue;
          }

          const supplement = Number(entry.chainType.config?.supplement) || 0;
          const targetPrice = context.basePrice + supplement;
          const targetCompareAt =
            context.baseCompareAt !== null ? context.baseCompareAt + supplement : null;

          const needsPrice = !pricesEqual(entry.variant.price, targetPrice);
          const needsCompareAt = !compareAtEqual(entry.variant.compare_at_price, targetCompareAt);

          log.debug(`[${reqId}] variant ${entry.variant.id}`, {
            title: entry.variant.title,
            chainKey: entry.chainType.key,
            parent: context.parentKey,
            currentPrice: entry.variant.price,
            targetPrice,
            currentCompareAt: entry.variant.compare_at_price,
            targetCompareAt,
            needsPrice,
            needsCompareAt,
          });

          if (!needsPrice && !needsCompareAt) {
            continue;
          }

          updates.push({ variant: entry.variant, targetPrice, targetCompareAt });
        }
      }
    } else {
      const baseVariant = pickForsatBaseVariant(product.variants, productKind, reqId);
      if (!baseVariant) {
        log.warn(`[${reqId}] Forsat S base variant missing, skipping`);
        return res.status(200).json({ skipped: true, reason: 'Forsat S base variant missing' });
      }

      const basePrice = moneyToNumber(baseVariant.price);
      const baseCompareAt =
        baseVariant.compare_at_price != null ? moneyToNumber(baseVariant.compare_at_price) : null;
      log.debug(`[${reqId}] base variant`, {
        id: baseVariant.id,
        title: baseVariant.title,
        price: basePrice,
        compareAt: baseCompareAt,
      });

      for (const variant of product.variants) {
        if (variant.id === baseVariant.id) {
          log.debug(`[${reqId}] skip base ${variant.id}`);
          continue;
        }

        const chainType = identifyChainType(variant, productKind);
        if (!chainType) {
          log.debug(`[${reqId}] skip ${variant.id}: no chainType match for "${variant.title}"`);
          continue;
        }

        const size = extractVariantSize(variant);
        const targetPrice = calculateNecklacePrice(basePrice, chainType.config, size);
        const targetCompareAt = baseCompareAt !== null ? baseCompareAt + (targetPrice - basePrice) : null;

        const needsPrice = !pricesEqual(variant.price, targetPrice);
        const needsCompareAt = !compareAtEqual(variant.compare_at_price, targetCompareAt);

        log.debug(`[${reqId}] variant ${variant.id}`, {
          title: variant.title,
          chainKey: chainType.key,
          size,
          currentPrice: variant.price,
          targetPrice,
          currentCompareAt: variant.compare_at_price,
          targetCompareAt,
          needsPrice,
          needsCompareAt,
        });

        if (!needsPrice && !needsCompareAt) {
          continue;
        }

        updates.push({ variant, targetPrice, targetCompareAt });
      }
    }

    if (updates.length === 0) {
      log.info(`[${reqId}] no changes required`);
      return res.status(200).json({ updated: 0 });
    }

    let success = 0;
    for (const upd of updates) {
      try {
        await updateVariantPrice(upd.variant.id, upd.targetPrice, upd.targetCompareAt, reqId);
        success += 1;
      } catch (e) {
        log.error(`[${reqId}] update error for variant ${upd.variant.id}`, e);
      }
    }

    const ms = Date.now() - start;
    log.info(`[${reqId}] done`, { updated: success, attempted: updates.length, ms });
    return res.status(200).json({ updated: success, attempted: updates.length });
  } catch (e) {
    log.error(`[${reqId}] failed to process product update webhook:`, e);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

app.listen(Number(PORT), () => {
  log.info(`Webhook server listening on port ${PORT}`);
});
