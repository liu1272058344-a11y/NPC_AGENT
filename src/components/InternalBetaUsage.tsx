import { useEffect, useState } from 'react'
import { createInternalBetaApi } from '../agent/internalBetaApi.mjs'
import type { BetaUsage } from '../agent/internalBetaApi.mjs'

export function InternalBetaUsage() {
  const [usage, setUsage] = useState<BetaUsage | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void createInternalBetaApi().usage().then(setUsage).catch((value) => setError(value instanceof Error ? value.message : '用量暂时不可用')) }, [])
  return <aside className="beta-usage"><strong>管理员 · 无上限</strong>{error?<span>用量统计暂时不可用：{error}</span>:usage?<span>项目用量：{usage.imageCount} 张 · {(usage.byteCount / 1048576).toFixed(1)} MB · 今日 {usage.dailyActions} 次</span>:<span>正在读取用量统计…</span>}</aside>
}
