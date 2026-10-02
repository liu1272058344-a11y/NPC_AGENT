import credentialsHandler from '../../api/credentials.ts'
import healthHandler from '../../api/health.ts'
import imageHandler from '../../api/image.ts'
import npcHandler from '../../api/npc.ts'
import pipelineHandler from '../../api/pipeline.ts'
import assetsHandler from '../../api/assets/index.ts'
import archiveHandler from '../../api/assets/archive.ts'
import imagesHandler from '../../api/assets/images/index.ts'
import imageRecordHandler from '../../api/assets/images/[id]/index.ts'
import imageDownloadHandler from '../../api/assets/images/[id]/download.ts'
import betaHandler from '../../api/internal-beta/[action].ts'

const exactRoutes = new Map([
  ['/api/credentials', credentialsHandler], ['/api/health', healthHandler],
  ['/api/image', imageHandler], ['/api/npc', npcHandler], ['/api/pipeline', pipelineHandler],
  ['/api/assets', assetsHandler], ['/api/assets/archive', archiveHandler],
  ['/api/assets/images', imagesHandler], ['/api/internal-beta/session', betaHandler],
  ['/api/internal-beta/usage', betaHandler]
])

const readBody = async (req) => {
  if (req.method === 'GET' || req.method === 'HEAD') return {}
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) throw Object.assign(new Error('请求内容过大。'), { statusCode: 413 }) }
  if (!raw.trim()) return {}
  try { return JSON.parse(raw) } catch { throw Object.assign(new Error('请求 JSON 格式无效。'), { statusCode: 400 }) }
}

const decorateResponse = (res) => {
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); return res }
  res.send = (body) => { res.end(body); return res }
  return res
}

export async function routeLocalApi(req, res, url) {
  if (url.pathname === '/api/assets' && !req.headers['x-workspace-id']) return false
  let handler = exactRoutes.get(url.pathname)
  const imageMatch = url.pathname.match(/^\/api\/assets\/images\/([^/]+)$/)
  const downloadMatch = url.pathname.match(/^\/api\/assets\/images\/([^/]+)\/download$/)
  if (downloadMatch) handler = imageDownloadHandler
  else if (imageMatch) handler = imageRecordHandler
  if (!handler) return false
  try {
    req.query = Object.fromEntries(url.searchParams)
    if (url.pathname.startsWith('/api/internal-beta/')) req.query.action = url.pathname.split('/').pop()
    if (downloadMatch || imageMatch) req.query.id = decodeURIComponent((downloadMatch || imageMatch)[1])
    req.body = await readBody(req)
    await handler(req, decorateResponse(res))
  } catch (error) {
    if (!res.writableEnded) decorateResponse(res).status(error?.statusCode || 500).json({ ok: false, error: { code: 'LOCAL_API_ERROR', message: error?.message || '本地接口请求失败。' } })
  }
  return true
}
