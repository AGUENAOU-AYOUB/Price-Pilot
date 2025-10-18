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

const buildChainMatchers = (name, aliases = []) => {
  const normalizedSet = new Set();
  const sanitizedSet = new Set();

  const register = (raw) => {
    if (!raw && raw !== 0) return;

    const normalized = normalize(raw);
    if (normalized && normalized.length >= 2) {
      normalizedSet.add(normalized);
    }

    const sanitized = sanitizeVariantKey(raw);
    if (sanitized && sanitized.length >= 3) {
      sanitizedSet.add(sanitized);
    }
  };

  register(name);

  const normalizedName = normalize(name);
  if (normalizedName) {
    const collapsed = normalizedName.replace(/\s+/g, '');
    if (collapsed && collapsed !== normalizedName) {
      register(collapsed);
    }

    const tokens = normalizedName.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      register(tokens.join(' '));
      register(tokens.join(''));
    }

    for (const token of tokens) {
      if (token && token.length >= 3) {
        register(token);
      }
    }
  }

  if (Array.isArray(aliases)) {
    for (const alias of aliases) {
      register(alias);
    }
  }

  const normalizedMatchers = Array.from(normalizedSet).sort((a, b) => b.length - a.length);
  const sanitizedMatchers = Array.from(sanitizedSet).sort((a, b) => b.length - a.length);

  return { normalizedMatchers, sanitizedMatchers };
};

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildChainRemovalPatterns = (names = []) => {
  const patterns = [];
  const seen = new Set();

  for (const name of names) {
    if (!name) continue;

    const base = escapeRegExp(name);
    if (!seen.has(base)) {
      patterns.push(new RegExp(base, 'ig'));
      seen.add(base);
    }

    const collapsed = name.replace(/\s+/g, '');
    if (collapsed && collapsed !== name) {
      const collapsedPattern = escapeRegExp(collapsed);
      if (!seen.has(collapsedPattern)) {
        patterns.push(new RegExp(collapsedPattern, 'ig'));
        seen.add(collapsedPattern);
      }
    }
  }

  return patterns;
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

const splitVariantDescriptor = (value) => {
  if (!value) return [];

  return String(value)
    .split(/[\/•|\-–]/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const collectVariantFields = (variant) => {
  const values = [];

  if (variant?.option1) values.push(variant.option1);
  if (variant?.option2) values.push(variant.option2);
  if (variant?.option3) values.push(variant.option3);

  if (variant?.title) {
    values.push(...splitVariantDescriptor(variant.title));
  }

  const seen = new Set();
  const results = [];

  for (const raw of values) {
    if (raw === null || raw === undefined) {
      continue;
    }

    const normalized = normalize(raw);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);

    const sanitized = sanitizeVariantKey(raw);
    results.push({ raw, normalized, sanitized });
  }

  return results;
};

const DEFAULT_BRACELET_PARENT_KEY = 'default';

let braceletChainSanitizedKeys = [];
let braceletChainRemovalPatterns = [];

const stripBraceletChainFragments = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  let working = String(value);
  for (const pattern of braceletChainRemovalPatterns) {
    working = working.replace(pattern, ' ');
  }

  return working.replace(/[(){}\[\]]/g, ' ').replace(/[\-_/•]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const identifyBraceletParentKey = (variant, chainKeyNormalized) => {
  const chainKeySanitized = chainKeyNormalized ? sanitizeVariantKey(chainKeyNormalized) : null;
  const parentParts = [];
  const seen = new Set();

  const register = (raw) => {
    if (!raw) return;

    const cleaned = stripBraceletChainFragments(raw);
    if (!cleaned) return;

    const normalized = normalize(cleaned);
    if (!normalized) return;
    if (normalized === 'default' || normalized === 'default title' || normalized === 'defaulttitle') return;
    if (/\b(cm|centim|millim|mm)\b/.test(normalized)) return;

    const sanitized = sanitizeVariantKey(cleaned);
    if (!sanitized) return;
    if (chainKeySanitized && sanitized.includes(chainKeySanitized)) return;

    let remainder = sanitized;
    for (const key of braceletChainSanitizedKeys) {
      if (!key) continue;
      remainder = remainder.split(key).join('');
    }

    if (chainKeySanitized) {
      remainder = remainder.split(chainKeySanitized).join('');
    }

    if (!remainder) return;
    if (seen.has(remainder)) return;

    seen.add(remainder);
    parentParts.push(remainder);
  };

  register(variant?.option1);
  register(variant?.option2);
  register(variant?.option3);

  if (variant?.title) {
    for (const fragment of splitVariantDescriptor(variant.title)) {
      register(fragment);
    }
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
    const key = normalize(name);
    const matchers = buildChainMatchers(name);
    supplementsState.bracelet.set(key, {
      name,
      supplement: Number(supplement) || 0,
      matchers,
    });
  }
  for (const [name, config] of Object.entries(supplementsState.necklaceBase)) {
    const key = normalize(name);
    const sizes = sanitizeNecklaceSizeMap(config?.sizes, supplementsState.necklaceSizes);
    const matchers = buildChainMatchers(name, config?.aliases);
    supplementsState.necklace.set(key, {
      name,
      supplement: Number(config?.supplement) || 0,
      perCm: Number(config?.perCm) || 0,
      sizes,
      matchers,
    });
  }

  braceletChainSanitizedKeys = Array.from(
    new Set(
      Array.from(supplementsState.bracelet.values())
        .map((entry) => sanitizeVariantKey(entry?.name))
        .filter(Boolean),
    ),
  );
  const braceletNames = Array.from(supplementsState.bracelet.values())
    .map((entry) => entry?.name)
    .filter(Boolean);
  braceletChainRemovalPatterns = buildChainRemovalPatterns(braceletNames);

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
  if (fields.length === 0) {
    return null;
  }

  const source = productKind === 'necklace' ? supplementsState.necklace : supplementsState.bracelet;

  let bestMatch = null;
  let bestScore = -Infinity;

  for (const field of fields) {
    const normalizedField = field.normalized;
    const sanitizedField = field.sanitized;

    for (const [normalizedName, config] of source) {
      const matchers = config?.matchers;
      const normalizedMatchers = Array.isArray(matchers?.normalizedMatchers)
        ? matchers.normalizedMatchers
        : [normalizedName];
      for (const candidate of normalizedMatchers) {
        if (!candidate) continue;
        if (normalizedField.includes(candidate)) {
          const score = candidate.length * 2;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { key: normalizedName, config };
          }
        }
      }

      if (!sanitizedField) {
        continue;
      }

      const sanitizedMatchers = Array.isArray(matchers?.sanitizedMatchers)
        ? matchers.sanitizedMatchers
        : [];
      for (const candidate of sanitizedMatchers) {
        if (!candidate) continue;
        if (sanitizedField.includes(candidate)) {
          const score = candidate.length * 2 - 1; // prefer normalized matches when equal length
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { key: normalizedName, config };
          }
        }
      }
    }
  }

  return bestMatch;
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
    const byTitle = variants.find((v) =>
      collectVariantFields(v).some((f) => f.normalized.includes(FORSAT_S_KEY)),
    );
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

const pickNecklaceBaseEntry = (candidates = []) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  let best = null;
  let bestScore = null;

  for (const entry of candidates) {
    const sizeKnown = Number.isFinite(entry.size);
    const diff = sizeKnown ? Math.abs(entry.size - DEFAULT_NECKLACE_SIZE) : Number.POSITIVE_INFINITY;
    const missingPrice = entry.hasPrice ? 0 : 1;
    const score = { diff, missingPrice };

    if (
      !best ||
      score.diff < bestScore.diff ||
      (score.diff === bestScore.diff && score.missingPrice < bestScore.missingPrice)
    ) {
      best = entry;
      bestScore = score;
    }
  }

  return best;
};

// ---------- pricing ----------
const normalizeNecklaceSize = (size) =>
  Number.isFinite(size) ? size : DEFAULT_NECKLACE_SIZE;

const resolveNecklaceSizeOverride = (chainConfig = {}, size) => {
  if (chainConfig?.sizes instanceof Map) {
    const override = chainConfig.sizes.get(size);
    if (Number.isFinite(override)) {
      return override;
    }
  }
  return null;
};

const computeNecklaceIncrement = (chainConfig = {}, size) => {
  const override = resolveNecklaceSizeOverride(chainConfig, size);
  if (override !== null) {
    return override;
  }

  const baseSupplementRaw = Number(chainConfig?.supplement);
  const perCmRaw = Number(chainConfig?.perCm);
  const baseSupplement = Number.isFinite(baseSupplementRaw) ? baseSupplementRaw : 0;
  const perCm = Number.isFinite(perCmRaw) ? perCmRaw : 0;

  return baseSupplement + (size - DEFAULT_NECKLACE_SIZE) * perCm;
};

const calculateNecklacePrice = (basePrice, chainConfig = {}, size) => {
  const normalizedSize = normalizeNecklaceSize(size);
  return basePrice + computeNecklaceIncrement(chainConfig, normalizedSize);
};

const deriveNecklaceBaseFromPrice = (price, chainConfig = {}, size) => {
  if (!Number.isFinite(price)) {
    return null;
  }

  const normalizedSize = normalizeNecklaceSize(size);
  return price - computeNecklaceIncrement(chainConfig, normalizedSize);
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
          context.baseCompareAt = Number.isFinite(context.basePrice)
            ? context.basePrice
            : null;
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
      const productOptions = Array.isArray(product.options) ? product.options : [];
      const extraOptionIndexSet = new Set();
      productOptions.forEach((option, idx) => {
        const normalizedName = normalize(option?.name);
        if (!normalizedName) {
          return;
        }

        if (normalizedName === 'chain variants' || normalizedName === 'taille de chaine') {
          return;
        }

        const position = Number(option?.position);
        const index = Number.isFinite(position) ? position : idx + 1;
        if (index >= 1) {
          extraOptionIndexSet.add(index);
        }
      });
      const extraOptionIndices = Array.from(extraOptionIndexSet).sort((a, b) => a - b);

      const DEFAULT_CONTEXT_KEY = '__default__';
      const buildContextKey = (variant) => {
        if (extraOptionIndices.length === 0) {
          return { key: DEFAULT_CONTEXT_KEY, labelParts: [] };
        }

        const labelParts = [];
        const keyParts = [];
        for (const optionIndex of extraOptionIndices) {
          const raw = variant?.[`option${optionIndex}`];
          labelParts.push(raw ?? '');
          const normalizedValue = normalize(raw);
          keyParts.push(normalizedValue || `__empty${optionIndex}`);
        }

        const key = keyParts.join('::') || DEFAULT_CONTEXT_KEY;
        return { key, labelParts };
      };

      const contexts = new Map();

      for (const variant of product.variants) {
        const chainType = identifyChainType(variant, productKind);
        if (!chainType) {
          log.debug(`[${reqId}] skip ${variant.id}: no chainType match for "${variant.title}"`);
          continue;
        }

        const { key, labelParts } = buildContextKey(variant);
        if (!contexts.has(key)) {
          const label = labelParts.filter(Boolean).join(' / ') || 'default';
          contexts.set(key, {
            key,
            label,
            variants: [],
            baseCandidates: [],
            baseVariantId: null,
            basePrice: null,
            baseCompareAt: null,
          });
        }

        const context = contexts.get(key);
        const hasPrice = variant.price !== null && variant.price !== undefined && variant.price !== '';
        const hasCompare =
          variant.compare_at_price !== null &&
          variant.compare_at_price !== undefined &&
          variant.compare_at_price !== '';
        const price = hasPrice ? moneyToNumber(variant.price) : null;
        const compareAt = hasCompare ? moneyToNumber(variant.compare_at_price) : null;
        const size = extractVariantSize(variant);

        const entry = {
          variant,
          chainType,
          size,
          price,
          compareAt,
          hasPrice,
          hasCompare,
        };
        context.variants.push(entry);
        if (chainType.key === FORSAT_S_KEY) {
          context.baseCandidates.push(entry);
        }
      }

      if (contexts.size === 0) {
        log.warn(`[${reqId}] no necklace chain matches, skipping`);
        return res.status(200).json({ skipped: true, reason: 'No necklace chain matches' });
      }

      for (const context of contexts.values()) {
        const baseEntry = pickNecklaceBaseEntry(context.baseCandidates);
        if (baseEntry) {
          context.baseVariantId = baseEntry.variant.id;
          if (baseEntry.hasPrice && Number.isFinite(baseEntry.price)) {
            context.basePrice = baseEntry.price;
          }
          if (baseEntry.hasCompare && Number.isFinite(baseEntry.compareAt)) {
            context.baseCompareAt = baseEntry.compareAt;
          }
        }

        if (!Number.isFinite(context.basePrice)) {
          for (const entry of context.variants) {
            if (!entry.hasPrice) {
              continue;
            }

            const candidate = deriveNecklaceBaseFromPrice(
              entry.price,
              entry.chainType.config,
              entry.size,
            );
            if (Number.isFinite(candidate)) {
              context.basePrice = candidate;
              break;
            }
          }
        }

        if (!Number.isFinite(context.basePrice)) {
          log.warn(`[${reqId}] context=${context.label} missing base price, skipping`);
          continue;
        }

        if (!Number.isFinite(context.baseCompareAt)) {
          let derivedCompare = null;
          for (const entry of context.variants) {
            if (!entry.hasCompare) {
              continue;
            }

            const candidate = deriveNecklaceBaseFromPrice(
              entry.compareAt,
              entry.chainType.config,
              entry.size,
            );
            if (Number.isFinite(candidate)) {
              derivedCompare = candidate;
              break;
            }
          }

          if (Number.isFinite(derivedCompare)) {
            context.baseCompareAt = derivedCompare;
          } else if (Number.isFinite(context.basePrice)) {
            context.baseCompareAt = context.basePrice;
          } else {
            context.baseCompareAt = null;
          }
        }

        log.debug(`[${reqId}] necklace context`, {
          context: context.label,
          baseVariantId: context.baseVariantId,
          basePrice: context.basePrice,
          baseCompareAt: context.baseCompareAt,
        });

        for (const entry of context.variants) {
          if (context.baseVariantId && entry.variant.id === context.baseVariantId) {
            log.debug(`[${reqId}] skip base ${entry.variant.id} (context=${context.label})`);
            continue;
          }

          const targetPrice = calculateNecklacePrice(
            context.basePrice,
            entry.chainType.config,
            entry.size,
          );
          const targetCompareAt =
            context.baseCompareAt !== null
              ? context.baseCompareAt + (targetPrice - context.basePrice)
              : null;

          const needsPrice = !pricesEqual(entry.variant.price, targetPrice);
          const needsCompareAt = !compareAtEqual(entry.variant.compare_at_price, targetCompareAt);

          log.debug(`[${reqId}] variant ${entry.variant.id}`, {
            title: entry.variant.title,
            context: context.label,
            chainKey: entry.chainType.key,
            size: entry.size,
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
