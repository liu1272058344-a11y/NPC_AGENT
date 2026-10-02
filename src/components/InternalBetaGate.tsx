import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { createInternalBetaApi } from '../agent/internalBetaApi.mjs'
import type { BetaRole } from '../agent/internalBetaApi.mjs'
import { getProductBranding } from '../agent/branding.mjs'
import { InternalBetaUsage } from './InternalBetaUsage'

const branding = getProductBranding()

export function InternalBetaGate({ children }: { children: ReactNode }) {
  const api = useMemo(() => createInternalBetaApi(), [])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<BetaRole>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { void api.status().then((value) => { if (value.authenticated) setRole(value.role) }).catch(() => {}).finally(() => setLoading(false)) }, [api])
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); try { const value = await api.login(password); setPassword(''); setRole(value.role) } catch (value) { setError(value instanceof Error ? value.message : '登录失败') } }
  if (loading) return <main className="beta-login"><div className="beta-login-card"><p>正在验证内测访问…</p></div></main>
  if (!role) return <main className="beta-login"><form className="beta-login-card" onSubmit={submit}><div className="panel-label">INTERNAL BETA</div><h1>{branding.internalBetaTitle}</h1><p>当前项目仅面向受邀测试者。请输入内测口令继续。</p><label>内测口令<input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <p className="error-message">{error}</p>}<button className="primary-button" disabled={!password.trim()} type="submit">进入内测</button></form></main>
  const logout = async () => { await api.logout().catch(() => {}); setRole(null) }
  return <><button className="beta-logout" type="button" onClick={() => void logout()}>退出内测</button>{role === 'admin' && <InternalBetaUsage />}{children}</>
}
