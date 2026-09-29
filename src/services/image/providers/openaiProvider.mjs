export async function generate({ prompt, negativePrompt = '', apiKey, endpoint = 'https://api.openai.com/v1', model = 'gpt-image-1', size = '1024x1024' }) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt: negativePrompt ? `${prompt}\nAvoid: ${negativePrompt}` : prompt, size, n: 1 }) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || '图像生成服务请求失败'), { code: 'IMAGE_PROVIDER_ERROR', statusCode: response.status })
  const image = body?.data?.[0]
  if (!image?.url && !image?.b64_json) throw Object.assign(new Error('图像服务返回为空。'), { code: 'IMAGE_PROVIDER_ERROR' })
  return { url: image.url || `data:image/png;base64,${image.b64_json}`, model, size }
}
