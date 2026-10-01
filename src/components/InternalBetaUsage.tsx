import { useEffect, useState } from 'react'
import { createInternalBetaApi } from '../agent/internalBetaApi.mjs'
import type { BetaUsage } from '../agent/internalBetaApi.mjs'

export function InternalBetaUsage() {
  const [usage, setUsage] = useState<BetaUsage | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void createInternalBetaApi().usage().then(setUsage).catch((value) => setError(value instanceof Error ? value.message : '用量暂时不可用')) }, [])
  if (error) return <aside className="beta-usage beta-risk">管理员用量读取失败：{error}</aside>
  if (!usage) return <aside className="beta-usage">正在读取内测用量…</aside>
  const used = Math.max(usage.imageCount / usage.limits.maxImages, usage.byteCount / usage.limits.maxBytes, usage.dailyActions / usage.limits.dailyActions)
  const state = used >= 1 ? '已暂停新增操作' : used >= 0.9 ? '高风险：即将达到上限' : used >= 0.7 ? '提醒：额度已使用 70% 以上' : '额度正常'
  return <aside className={`beta-usage ${used >= 0.9 ? 'beta-risk' : used >= 0.7 ? 'beta-warning' : ''}`}><strong>内测用量 · {state}</strong><span>{usage.imageCount}/{usage.limits.maxImages} 张 · {(usage.byteCount / 1048576).toFixed(1)}/{(usage.limits.maxBytes / 1048576).toFixed(0)} MB · 今日 {usage.dailyActions}/{usage.limits.dailyActions} 次</span></aside>
}
