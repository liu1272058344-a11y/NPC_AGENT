import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export const credentialProviders = ['deepseek', 'openai', 'volcengine', 'fal', 'together']
const fail = (message, statusCode = 401) => Object.assign(new Error(message), { statusCode })
const name = (provider) => `__Host-npc-key-${provider}`
const encryptionKey = () => {
  const secret = process.env.CREDENTIAL_SESSION_SECRET
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw fail('安全凭据服务尚未配置。', 503)
  return Buffer.from(secret, 'hex')
}
export function credentialCookie(provider, key) {
  if (!credentialProviders.includes(provider) || typeof key !== 'string' || !key.trim() || key.length > 1024) throw fail('密钥或服务类型无效。', 400)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(Buffer.from(provider))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ key: key.trim(), expires: Date.now() + 4 * 60 * 60 * 1000 })), cipher.final()])
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url')
  return `${name(provider)}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`
}
export function sessionCredential(req, provider) {
  if (!credentialProviders.includes(provider)) throw fail('不支持的模型服务。', 400)
  const cookies = String(req.headers?.cookie || '').split(';').map((s) => s.trim())
  const token = cookies.find((s) => s.startsWith(`${name(provider)}=`))?.slice(name(provider).length + 1)
  if (!token) throw fail('请在设置中保存个人 API Key，凭据会话有效期为 4 小时。')
  const secret = encryptionKey()
  try {
    const data = Buffer.from(token, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', secret, data.subarray(0, 12))
    decipher.setAAD(Buffer.from(provider)); decipher.setAuthTag(data.subarray(12, 28))
    const payload = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString())
    if (payload.expires <= Date.now() || typeof payload.key !== 'string') throw new Error('expired')
    return payload.key
  } catch { throw fail('凭据会话已失效，请在设置中重新保存 API Key。') }
}
export function requireSameOrigin(req) {
  const origin = req.headers?.origin
  const host = req.headers?.host
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host || '')
  if (!origin || (origin !== `https://${host}` && !(local && origin === `http://${host}`))) throw fail('不允许跨站调用。', 403)
}
