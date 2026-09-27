import { worldSchema } from './contracts.mjs'

const labels = Object.freeze({
  name: '世界名称', genre: '游戏类型', era: '时代背景', atmosphere: '整体氛围',
  coreRule: '核心规则', centralConflict: '主要冲突', summary: '世界概述'
})

export function validateWorldSchema(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const parsed = worldSchema.safeParse(source)
  if (parsed.success) return { status: 'SUCCESS', phase: 'world', world: parsed.data }

  const missingFields = Object.keys(labels).filter((field) => typeof source[field] !== 'string' || !source[field].trim())
  const invalidFields = parsed.error.issues
    .map((issue) => issue.path[0])
    .filter((field) => typeof field === 'string' && !missingFields.includes(field))
  const affected = [...new Set([...missingFields, ...invalidFields])]
  const names = affected.map((field) => labels[field] || field).join('、')
  return {
    status: 'FAILED',
    code: 'INVALID_SCHEMA',
    message: names ? `世界观信息不完整，缺少或格式错误：${names}。` : '世界观数据结构不符合要求，请检查后重试。',
    missingFields: affected
  }
}
