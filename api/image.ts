import { generateImage } from '../src/services/image/imageService.mjs'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only', code: 'METHOD_NOT_ALLOWED' })
  const body = req.body || {}
  try {
    const result = await generateImage({
      provider: body.provider || 'openai',
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      apiKey: body.apiKey || process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY,
      endpoint: body.endpoint || process.env.IMAGE_API_ENDPOINT || 'https://api.openai.com/v1',
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
