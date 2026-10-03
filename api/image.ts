import { sessionCredential, requireSameOrigin } from '../src/server/credentialSession.mjs'
import { generateImage } from '../src/services/image/imageService.mjs'
import { resolveImageCredentials } from '../src/server/imageCredentials.mjs'
import { guardVercelRequest } from '../src/server/internalBeta/guard.mjs'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only', code: 'METHOD_NOT_ALLOWED' })
  if (!await guardVercelRequest(req, res, { costKind: 'image' })) return
  const body = req.body || {}
  res.setHeader('Cache-Control', 'no-store')
  try {
    requireSameOrigin(req)
    const provider = body.provider || 'openai'
    const key = sessionCredential(req, provider)
    const result = await generateImage({
      ...resolveImageCredentials({ ...body, apiKey: key }, {}),
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      model: body.model || process.env.IMAGE_MODEL || 'gpt-image-1',
      size: body.size || '1024x1024'
    })
    return res.status(200).json(result)
  } catch (error: any) {
    return res.status(Number(error?.statusCode) || 502).json({
      error: error?.code || 'IMAGE_PROVIDER_ERROR',
      message: error?.message || '图片生成服务请求失败'
    })
  }
}
