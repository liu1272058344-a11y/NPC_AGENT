const statuses = new Set(['pending', 'ready', 'failed'])

export function createAssetVersion(input) {
  const value = input && typeof input === 'object' ? input : {}
  const required = ['asset_id', 'prompt', 'provider', 'model', 'url', 'created_at', 'status']
  if (!required.every((field) => typeof value[field] === 'string' && value[field].trim()) || !Number.isInteger(value.version) || value.version < 1 || !statuses.has(value.status)) {
    throw Object.assign(new Error('AssetVersion is incomplete'), { code: 'INVALID_ASSET_VERSION' })
  }
  return { asset_id: value.asset_id, version: value.version, prompt: value.prompt, provider: value.provider, model: value.model, url: value.url, created_at: value.created_at, status: value.status }
}
