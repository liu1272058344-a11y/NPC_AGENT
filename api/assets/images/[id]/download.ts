import { workspaceFrom, createDefaultAssetService } from '../../../../src/server/assets/http.mjs'

const safeName = (value: string) => value.replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 80) || 'generated-image'

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持下载请求。' } })
    const workspaceId = workspaceFrom(req.headers)
    const service: any = await createDefaultAssetService()
    const image = await service.getImage(workspaceId, String(req.query?.id || ''))
    if (!image) return res.status(404).json({ ok: false, error: { code: 'ASSET_NOT_FOUND', message: '图片不存在或已过期。' } })
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(image.archive_name || 'generated-image')}.${image.content_type?.split('/')[1] || 'png'}"`)
    return res.redirect(302, image.blob_url || image.url)
  } catch (error: any) { return res.status(error?.statusCode || 500).json({ ok: false, error: { code: error?.code || 'ASSET_ERROR', message: error?.message || '下载失败。' } }) }
}
