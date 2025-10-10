/**
 * Parse ring size from Shopify format to app format.
 * Example: "XL (60 - 65)" -> "XL".
 */
export const parseRingSize = (sizeString) => {
  if (!sizeString) return null;
  return String(sizeString).split('(')[0].trim() || null;
};

/**
 * Parse necklace size from Shopify format to app format.
 * Example: "41 cm" -> 41.
 */
export const parseNecklaceSize = (sizeString) => {
  if (!sizeString) return null;
  const numStr = String(sizeString).replace('cm', '').trim();
  if (!numStr) {
    return null;
  }
  const parsed = parseInt(numStr, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Parse chain name - currently passthrough but allows future normalization.
 * Example: "Forsat S" -> "Forsat S".
 */
export const parseChainName = (chainName) => {
  if (!chainName) return null;
  const parsed = String(chainName).trim();
  return parsed ? parsed : null;
};

/**
 * Parse band type - currently passthrough but allows future normalization.
 * Example: "Big" -> "Big".
 */
export const parseBandType = (bandType) => {
  if (!bandType) return null;
  const parsed = String(bandType).trim();
  return parsed ? parsed : null;
};
