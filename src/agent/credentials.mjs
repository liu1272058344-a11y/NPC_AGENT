const parse = async (response) => response.json().catch(() => ({}))

export async function saveCredential(provider, key, fetchImpl = fetch) {
  if (typeof key !== 'string' || !key.trim()) throw new Error('请输入 API Key 后再保存。')
  const response = await fetchImpl('/api/credentials', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key: key.trim() }) })
  const body = await parse(response)
  if (!response.ok) throw new Error(body.message || '密钥保存失败')
  return true
}

export async function loadCredentialStatus(fetchImpl = fetch) {
  const response = await fetchImpl('/api/credentials', { credentials: 'same-origin', cache: 'no-store' })
  const body = await parse(response)
  if (!response.ok) throw new Error(body.message || '无法读取凭据状态')
  return Array.isArray(body.providers) ? body.providers : []
}
