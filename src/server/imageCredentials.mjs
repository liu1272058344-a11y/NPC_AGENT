const endpoints = {
  volcengine: 'https://ark.cn-beijing.volces.com',
  openai: 'https://api.openai.com/v1',
  fal: 'https://fal.run',
  together: 'https://api.together.xyz/v1',
}

export function resolveImageCredentials(body, env = process.env) {
  const provider = body.provider || 'openai'
  const endpoint = endpoints[provider]
  if (!endpoint) throw Object.assign(new Error('不支持的图片服务。'), { statusCode: 400 })
  if (body.endpoint && String(body.endpoint).replace(/\/$/, '') !== endpoint) {
    throw Object.assign(new Error('图片请求仅允许发送到所选服务的官方地址。'), { statusCode: 400 })
  }
  const apiKey = body.apiKey || (provider === 'volcengine' ? env.VOLCENGINE_API_KEY : env.OPENAI_API_KEY) || env.IMAGE_API_KEY
  if (!apiKey) throw Object.assign(new Error('请配置所选图片服务的 API Key。'), { statusCode: 400 })
  return { provider, endpoint, apiKey }
}
