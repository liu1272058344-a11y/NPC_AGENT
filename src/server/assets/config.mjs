const positive = (value, fallback) => { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback }

export const ASSET_LIMITS = Object.freeze({
  maxImages: 20,
  maxBytes: 100 * 1024 * 1024,
  projectMaxImages: positive(process.env.INTERNAL_BETA_MAX_IMAGES, 200),
  projectMaxBytes: positive(process.env.INTERNAL_BETA_MAX_BYTES, 1024 * 1024 * 1024),
  retentionDays: 30,
  warningRatio: 0.8,
  maxSourceBytes: 20 * 1024 * 1024,
  sourceTimeoutMs: 15000
})

export const expiresAtFrom = (date = new Date()) => new Date(date.getTime() + ASSET_LIMITS.retentionDays * 86400000).toISOString()
