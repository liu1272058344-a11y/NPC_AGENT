const IMAGE_PROVIDER_DEFAULTS = {
  volcengine: {
    endpoint: 'https://ark.cn-beijing.volces.com',
    modelId: 'doubao-seedream-5-0-flash-260915'
  },
  openai: { endpoint: 'https://api.openai.com/v1', modelId: 'gpt-image-1' },
  fal: { endpoint: 'https://fal.run', modelId: 'fal-ai/flux/schnell' },
  together: { endpoint: 'https://api.together.xyz/v1', modelId: 'black-forest-labs/FLUX.1-schnell-Free' }
}

const LEGACY_VOLCENGINE_MODEL_IDS = new Set([
  'Doubao-Seedream-5.0-flash-260915',
  'doubao-seedream-5-0-flash-250528'
])

export const getImageProviderDefaults = (provider) => IMAGE_PROVIDER_DEFAULTS[provider] || IMAGE_PROVIDER_DEFAULTS.openai

export const resolveImageModelId = (provider, storedModelId) => {
  const value = storedModelId?.trim()
  if (!value || (provider === 'volcengine' && LEGACY_VOLCENGINE_MODEL_IDS.has(value))) return getImageProviderDefaults(provider).modelId
  return value
}

