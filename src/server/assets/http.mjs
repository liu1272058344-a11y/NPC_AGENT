import { createNeonAssetDatabase } from './database.mjs'
import { createVercelBlobStore } from './blobStore.mjs'
import { createAssetService } from './assetService.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const publicError = (error) => ({ status: Number(error?.statusCode) || 500, body: { ok: false, error: { code: error?.code || 'ASSET_ERROR', message: error?.message || '资产服务暂时不可用。' } } })
export const workspaceFrom = (headers = {}) => {
  const value = headers['x-workspace-id'] || headers['X-Workspace-Id']
  if (!UUID.test(String(value || ''))) throw Object.assign(new Error('工作区标识无效，请刷新后重试。'), { code: 'INVALID_WORKSPACE', statusCode: 400 })
  return String(value)
}

export async function createDefaultAssetService() {
  const [db, blob] = await Promise.all([createNeonAssetDatabase(), createVercelBlobStore()])
  return createAssetService({ db, blob })
}

export async function handleAssetRequest(request, service) {
  try {
    const workspaceId = workspaceFrom(request.headers)
    let data
    if (request.action === 'images' && request.method === 'POST') data = await service.saveGeneratedImage({ ...request.body, workspaceId })
    else if (request.action === 'image' && request.method === 'DELETE') data = await service.deleteImage(workspaceId, request.id)
    else if (!request.action && request.method === 'GET' && request.query?.archiveId) {
      data = await service.getArchiveDetail(workspaceId, request.query.archiveId)
      if (!data) throw Object.assign(new Error('未找到该档案。'), { code: 'ASSET_NOT_FOUND', statusCode: 404 })
    } else if (!request.action && request.method === 'GET') data = await service.listArchiveSummaries(workspaceId)
    else throw Object.assign(new Error('不支持的请求方法。'), { code: 'METHOD_NOT_ALLOWED', statusCode: 405 })
    return { status: 200, body: { ok: true, data } }
  } catch (error) { return publicError(error) }
}

export const sendResult = (res, result) => res.status(result.status).json(result.body)
