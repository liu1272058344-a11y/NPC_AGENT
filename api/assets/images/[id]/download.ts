import { workspaceFrom, createDefaultAssetService, downloadFilename } from '../../../../src/server/assets/http.mjs'

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持下载请求。' } })
    const workspaceId = workspaceFrom({ ...req.headers, 'x-workspace-id': req.headers?.['x-workspace-id'] || req.query?.workspaceId })
    const service: any = await createDefaultAssetService()
    const image = await service.getImage(workspaceId, String(req.query?.id || ''))
    if (!image) return res.status(404).json({ ok: false, error: { code: 'ASSET_NOT_FOUND', message: '图片不存在或已过期。' } })
    const source = await fetch(image.blob_url || image.url)
    if (!source.ok) return res.status(502).json({ ok: false, error: { code: 'DOWNLOAD_FAILED', message: '图片读取失败，请稍后重试。' } })
    const filename = downloadFilename(image)
    const bytes = Buffer.from(await source.arrayBuffer())
    res.setHeader('Content-Type', image.content_type || 'application/octet-stream')
    res.setHeader('Content-Length', String(bytes.length))
    res.setHeader('Content-Disposition', `attachment; filename="download.${filename.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
    return res.status(200).send(bytes)
  } catch (error: any) { return res.status(error?.statusCode || 500).json({ ok: false, error: { code: error?.code || 'ASSET_ERROR', message: error?.message || '下载失败。' } }) }
}
