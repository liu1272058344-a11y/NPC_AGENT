export async function saveCredential(provider: string, key: string) {
  if (!key.trim()) return
  const response = await fetch('/api/credentials', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key }) })
  if (!response.ok) { const body = await response.json(); throw new Error(body.message || '密钥保存失败') }
}
