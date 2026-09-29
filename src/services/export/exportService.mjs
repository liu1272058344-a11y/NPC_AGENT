export function exportAsset(asset, format = 'json') {
  if (!asset) throw new Error('asset is required')
  return { status: 'ready', format, asset }
}
