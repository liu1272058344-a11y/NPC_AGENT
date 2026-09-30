import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import http from 'node:http'
import https from 'node:https'
import { ASSET_LIMITS } from './config.mjs'

const assetError = (code, message, statusCode = 400) => Object.assign(new Error(message), { code, statusCode })

const isPrivateIp = (value) => {
  const ip = value.replace(/^\[|\]$/g, '').toLowerCase()
  if (ip.startsWith('::ffff:')) {
    const tail = ip.slice(7)
    const mapped = tail.includes('.') ? tail : tail.split(':').map((part) => part.padStart(4, '0')).join('').match(/.{2}/g)?.map((part) => parseInt(part, 16)).join('.')
    return mapped ? isPrivateIp(mapped) : true
  }
  if (ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true
  if (!isIP(ip)) return false
  const parts = ip.split('.').map(Number)
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
}

const defaultResolveHost = async (hostname) => (await lookup(hostname, { all: true })).map((item) => item.address)

export async function validatePublicImageUrl(url, resolveHost = defaultResolveHost) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw assetError('UNSAFE_SOURCE_URL', '图片来源地址不安全。')
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateIp(hostname)) throw assetError('UNSAFE_SOURCE_URL', '图片来源地址不安全。')
  let addresses
  try { addresses = await resolveHost(hostname) } catch { throw assetError('SOURCE_UNAVAILABLE', '无法解析图片来源地址。', 502) }
  if (!addresses?.length || addresses.some(isPrivateIp)) throw assetError('UNSAFE_SOURCE_URL', '图片来源地址不安全。')
  return addresses
}

const pinnedRequest = async (url, { resolveHost, signal, maxBytes }) => {
  const addresses = await validatePublicImageUrl(url, resolveHost)
  const address = addresses[0]
  const transport = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      signal,
      lookup: (_hostname, options, callback) => {
        const family = isIP(address)
        if (options?.all) callback(null, [{ address, family }])
        else callback(null, address, family)
      }
    }, (response) => {
      const chunks = []
      let total = 0
      response.on('data', (chunk) => {
        total += chunk.length
        if (total > maxBytes) { request.destroy(assetError('SOURCE_TOO_LARGE', '图片超过单文件大小限制。', 413)); return }
        chunks.push(chunk)
      })
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })))
    })
    request.on('error', reject)
    request.end()
  })
}

const readBounded = async (response, maxBytes) => {
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > maxBytes) throw assetError('SOURCE_TOO_LARGE', '图片超过单文件大小限制。', 413)
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) throw assetError('SOURCE_TOO_LARGE', '图片超过单文件大小限制。', 413)
    return bytes
  }
  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) { await reader.cancel(); throw assetError('SOURCE_TOO_LARGE', '图片超过单文件大小限制。', 413) }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

export async function fetchSourceImage(sourceUrl, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl
  const resolveHost = dependencies.resolveHost || defaultResolveHost
  const maxBytes = dependencies.maxBytes || ASSET_LIMITS.maxSourceBytes
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), dependencies.timeoutMs || ASSET_LIMITS.sourceTimeoutMs)
  try {
    let url
    try { url = new URL(sourceUrl) } catch { throw assetError('UNSAFE_SOURCE_URL', '图片来源地址无效。') }
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      await validatePublicImageUrl(url, resolveHost)
      let response
      try { response = fetchImpl ? await fetchImpl(url, { signal: controller.signal, redirect: 'manual' }) : await pinnedRequest(url, { resolveHost, signal: controller.signal, maxBytes }) } catch (error) {
        if (error?.code === 'SOURCE_TOO_LARGE') throw error
        if (error?.name === 'AbortError') throw assetError('SOURCE_TIMEOUT', '读取图片超时。', 504)
        throw assetError('SOURCE_UNAVAILABLE', '无法读取生成图片。', 502)
      }
      if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
        url = new URL(response.headers.get('location'), url)
        continue
      }
      if (!response.ok) {
        if ([404, 410].includes(response.status)) throw assetError('SOURCE_EXPIRED', '生成图片地址已失效，请重新生成。', 410)
        if (response.status === 429) throw assetError('SOURCE_RATE_LIMITED', '图片来源服务繁忙，请稍后重试。', 503)
        throw assetError('SOURCE_UNAVAILABLE', '图片来源服务暂时不可用。', 502)
      }
      const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase()
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(contentType)) throw assetError('INVALID_IMAGE_TYPE', '来源内容不是支持的图片格式。', 415)
      const bytes = await readBounded(response, maxBytes)
      return { bytes, contentType, byteSize: bytes.byteLength }
    }
    throw assetError('SOURCE_REDIRECT_LIMIT', '图片来源重定向次数过多。', 502)
  } finally { clearTimeout(timer) }
}
