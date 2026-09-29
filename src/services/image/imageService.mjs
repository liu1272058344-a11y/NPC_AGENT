import * as openai from './providers/openaiProvider.mjs'
import * as flux from './providers/fluxProvider.mjs'
import * as stableDiffusion from './providers/stableDiffusionProvider.mjs'

const providers = { openai, flux, 'stable-diffusion': stableDiffusion, stableDiffusion }

export async function generateImage({ prompt, negativePrompt = '', apiKey, provider = 'openai', endpoint, model = 'gpt-image-1', size = '1024x1024' }) {
  if (!prompt?.trim()) throw Object.assign(new Error('image prompt is required'), { code: 'IMAGE_PROVIDER_ERROR', statusCode: 400 })
  if (!apiKey) throw Object.assign(new Error('IMAGE_API_KEY 未配置，无法生成图片。'), { code: 'IMAGE_PROVIDER_ERROR', statusCode: 503 })
  const adapter = providers[provider]
  if (!adapter) throw Object.assign(new Error(`Unsupported image provider: ${provider}`), { code: 'IMAGE_PROVIDER_ERROR', statusCode: 400 })
  const result = await adapter.generate({ prompt, negativePrompt, apiKey, endpoint, model, size })
  return { ...result, provider }
}
