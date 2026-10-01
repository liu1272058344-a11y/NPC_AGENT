const parse = async (response) => {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || '内测服务暂时不可用。'), { code: body?.error?.code || 'INTERNAL_BETA_ERROR', statusCode: response.status })
  return body
}

export const createInternalBetaApi = (fetchImpl = fetch) => ({
  async status() { const body = await parse(await fetchImpl('/api/internal-beta/session', { credentials: 'include' })); return { authenticated: body.authenticated, role: body.role } },
  async login(password) { const body = await parse(await fetchImpl('/api/internal-beta/session', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })); return { authenticated: body.authenticated, role: body.role } },
  async logout() { await parse(await fetchImpl('/api/internal-beta/session', { method: 'DELETE', credentials: 'include' })) },
  async usage() { const body = await parse(await fetchImpl('/api/internal-beta/usage', { credentials: 'include' })); return body.usage },
})
