const requiredFields = ['visual_asset_id', 'source_character_id', 'subject', 'appearance', 'costume', 'weapon', 'environment', 'lighting', 'camera', 'art_style', 'prompt', 'negative_prompt', 'status']
const statuses = new Set(['draft', 'ready', 'failed'])

export function validateVisualAsset(value) {
  const input = value && typeof value === 'object' ? value : {}
  const missing = requiredFields.filter((field) => typeof input[field] !== 'string' || !input[field].trim())
  if (missing.length || !statuses.has(input.status)) return { success: false, error: { code: 'INVALID_VISUAL_ASSET', missing } }
  return { success: true, data: { ...input } }
}

export function createVisualAsset(input) {
  const result = validateVisualAsset(input)
  if (!result.success) throw Object.assign(new Error('VisualAsset is incomplete'), result.error)
  return result.data
}
