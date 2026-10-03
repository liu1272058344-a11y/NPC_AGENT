import { z } from 'zod'
import { buildContentContext } from '../content/context.mjs'
import { contentCategories } from '../content/categories.mjs'
import { assetSchema } from './contracts.mjs'
import { generateStructured } from '../services/llm/llmService.mjs'

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode, code:statusCode === 400 ? 'INVALID_REQUEST' : 'PROVIDER_SCHEMA_MISMATCH' })
export function validateContentRequest(input) {
  if (!contentCategories[input?.category]) throw fail('请选择角色、地图、场景或道具。', 400)
  for (const field of ['itemId','name','requirements']) if (typeof input[field] !== 'string' || !input[field].trim()) throw fail('请填写条目名称和生成需求。', 400)
  return input
}
export async function generateContent(input, dependencies = {}) {
  validateContentRequest(input)
  const category = contentCategories[input.category]
  const context = buildContentContext({world:input.world,item:{id:input.itemId,revision:input.revision,worldId:input.worldId,fields:input.design,visualBrief:input.visualBrief,fieldStatus:input.fieldStatus},overrides:input.overrides})
  const fields = z.object(Object.fromEntries(Object.keys(category.fields).map(key => [key,z.string().optional()]))).strict()
  const schema = z.object({ category:z.literal(input.category), design:z.object({ name:z.string().min(1), summary:z.string().min(1), fields }).strict(), asset:assetSchema.extend({ negativePrompt:z.string() }) }).strict()
  const result = await (dependencies.requestStructured || generateStructured)({
    provider:input.provider, model:input.model, key:input.key, signal:input.signal, requestId:input.requestId,
    messages:[{ role:'user', content:input.requirements }], schema:z.toJSONSchema(schema),
    instructions:`你是游戏${category.label}设计师。为“${input.name}”输出完整结构化设计与中英文生图 Prompt，只返回符合 schema 的 JSON。类别固定为 ${input.category}。专用字段：${JSON.stringify(category.fields)}。${category.focus} 保留用户全部明确要求和细节。世界设定为约束，不把无关故事堆进图像。已确认资料不得替换。未知信息请省略，必需信息不足时以“待完善”标记，不适用字段省略。不要为动物、树木、石头默认添加服装、武器或人类语言。反向提示词针对本项需求，可为空，不默认禁止用户所需画风或文字。世界背景：${JSON.stringify(input.world || null)}。补充设计资料：${JSON.stringify(input.design || null)}。继承上下文与视觉简报：${JSON.stringify(context)}。`,
    ...(dependencies.logger ? { logger:dependencies.logger } : {}),
  })
  const parsed = schema.safeParse(result)
  if (!parsed.success) throw fail('生成结果与所选类别或必需字段不一致，请重试。', 422)
  return { status:'complete', phase:'content', itemId:input.itemId, context, ...parsed.data }
}
