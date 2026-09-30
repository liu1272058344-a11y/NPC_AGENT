const WORKSPACE_KEY = 'npc-forge-workspace-id'

export const getWorkspaceId = (storage = localStorage, createId = () => crypto.randomUUID()) => {
  const existing = storage.getItem(WORKSPACE_KEY)
  if (existing) return existing
  const id = createId()
  storage.setItem(WORKSPACE_KEY, id)
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('npc-forge-workspace-new', id)
  return id
}

export const assetErrorMessage = (code, fallback = '') => ({
  QUOTA_COUNT_EXCEEDED: '最多可临时保存 20 张图片，请删除旧资产后再试。',
  QUOTA_BYTES_EXCEEDED: '临时图片容量已达到 100 MB，请删除旧资产后再试。',
  SOURCE_EXPIRED: '生成图片地址已失效，请重新生成后保存。',
  ASSET_STORAGE_UNAVAILABLE: '资产存储暂时不可用，请稍后重试。',
  STALE_WORKSPACE: '当前浏览器的工作区已失效，请清除工作区标识后刷新重试。',
  ASSET_NOT_FOUND: '资产不存在或已被定期清理。'
}[code] || fallback || '资产操作失败，请重试。')

export const createAssetApi = ({ workspaceId = getWorkspaceId(), fetchImpl = fetch } = {}) => {
  let createWorkspace = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('npc-forge-workspace-new') === workspaceId
  const request = async (url, init = {}) => {
    const response = await fetchImpl(url, { ...init, headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': workspaceId, ...(init.headers || {}) } })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) throw Object.assign(new Error(assetErrorMessage(payload?.error?.code, payload?.error?.message)), { code: payload?.error?.code, status: response.status })
    return payload.data
  }
  return {
    listRemoteAssets: async () => { const data = await request('/api/assets', { headers: createWorkspace ? { 'X-Workspace-Create': '1' } : {} }); createWorkspace = false; if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('npc-forge-workspace-new'); return data },
    getRemoteArchive: (id) => request(`/api/assets?archiveId=${encodeURIComponent(id)}`),
    saveRemoteImage: (input) => request('/api/assets/images', { method: 'POST', body: JSON.stringify(input) }),
    saveRemoteArchive: (input) => request('/api/assets/archive', { method: 'POST', body: JSON.stringify(input) }),
    deleteRemoteImage: (id) => request(`/api/assets/images/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getRemoteImageDownloadUrl: (id) => `/api/assets/images/${encodeURIComponent(id)}/download?workspaceId=${encodeURIComponent(workspaceId)}`,
    workspaceId
  }
}
