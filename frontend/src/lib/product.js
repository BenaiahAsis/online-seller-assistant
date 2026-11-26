// Shared, non-visual helpers for product data coming from the API.

// Keep in sync with ProductBase.features max_length in backend/app/schemas.py
export const FEATURES_MAX_LENGTH = 2000;

// Keep in sync with PLATFORMS in backend/app/agents/listing_generator.py
export const PLATFORMS = [
  { id: 'shopee', label: 'Shopee', hint: 'Search-focused' },
  { id: 'tiktok', label: 'TikTok Shop', hint: 'Hook-driven' },
  { id: 'lazada', label: 'Lazada', hint: 'Detail and trust' },
];

export const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.label]));

// One source of truth for the status shown in the catalog and the product header.
export function productStatus(product) {
  if (!product) return null;
  if ((product.listings && product.listings.length > 0) || product.status === 'completed') {
    return 'ready';
  }
  if (product.analysis || product.status === 'analyzed') return 'analyzed';
  return 'draft';
}

export const STATUS_LABEL = {
  ready: 'Listings ready',
  analyzed: 'Analyzed',
  draft: 'Draft',
};

export function formatPeso(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '₱—';
  return `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// Map backend agent names in execution logs to plain stage names.
export function logStage(agent = '') {
  if (agent.includes('Agent 1')) return 'understanding';
  if (agent.includes('Agent 2')) return 'strategy';
  if (agent.includes('Agent 3')) return 'writing';
  return 'setup';
}

export const STAGE_LABEL = {
  understanding: 'Understanding',
  strategy: 'Strategy',
  writing: 'Writing',
  setup: 'Setup',
};

// Backend tiers: "Budget-Friendly", "Mid-Tier Value", "Premium" (agents/market_analyzer.py)
export const PRICE_TIERS = ['Budget', 'Mid-range', 'Premium'];

export function tierIndex(tier = '') {
  if (/budget/i.test(tier)) return 0;
  if (/mid/i.test(tier)) return 1;
  if (/premium/i.test(tier)) return 2;
  return -1;
}

export function formatSpecValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function humanizeKey(key = '') {
  const text = key.replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
