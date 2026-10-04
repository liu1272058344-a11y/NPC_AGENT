import { z } from 'zod'
import { GatewayError } from './errors.mjs'
import { buildContentContext } from '../content/context.mjs'
import { contentCategories } from '../content/categories.mjs'
import { assetSchema } from './contracts.mjs'
import { generateStructured } from '../services/llm/llmService.mjs'

const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode, code:statusCode === 400 ? 'INVALID_REQUEST' : 'PROVIDER_SCHEMA_MISMATCH' })
export function validateContentRequest(input) {
  if (!contentCategories[input?.category]) throw fail('请选择角色、地图、场景、道具或服饰。', 400)
  if(input.selectedCategoryId && input.selectedCategoryId!==input.category)throw fail('请求类别 ID 不一致。',400)
  if(input.designId && input.designId!==input.itemId)throw fail('请求设计 ID 不一致。',400)
  if(input.sourceWorldId!==undefined && input.sourceWorldId!==(input.worldId || ''))throw fail('请求来源世界 ID 不一致。',400)
  if(typeof input.itemId!=='string'||!input.itemId.trim())throw fail('内容会话 ID 无效。',400)
  if(input.messages!==undefined){if(!Array.isArray(input.messages)||!input.messages.length||!input.messages.some(m=>m.role==='user')||input.messages.some(m=>!['user','assistant'].includes(m?.role)||typeof m.content!=='string'||!m.content.trim()))throw fail('请提供有效的对话内容。',400)}
  else if(typeof input.requirements!=='string'||!input.requirements.trim())throw fail('请描述想设计的内容。',400)
  return input
}
export async function generateContent(input, dependencies = {}) {
  const signal = input.signal
  input = structuredClone({...input, signal:undefined})
  validateContentRequest(input)
  const category = contentCategories[input.category]
  const context = buildContentContext({world:input.world,item:{id:input.itemId,revision:input.revision,worldId:input.worldId,fields:input.currentDesign?.fields || input.design,visualBrief:input.visualBrief,fieldStatus:input.fieldStatus},overrides:input.overrides})
  const fields = z.object(Object.fromEntries(Object.keys(category.fields).map(key => [key,z.string().trim().min(1).optional()]))).strict()
  const completeSchema = z.object({ status:z.literal('complete').optional(),phase:z.literal('content').optional(),assistantMessage:z.string().optional(),suggestions:z.array(z.string()).optional(),design:z.object({ name:z.string().trim().min(1), summary:z.string().trim().min(1), fields }).strict(), asset:assetSchema.extend({ negativePrompt:z.string() }) }).strict()
  const clarificationSchema = z.object({assistantMessage:z.string().optional(),suggestions:z.array(z.string()).optional(),status:z.literal('needs_clarification'),phase:z.literal('content').optional(),question:z.string().trim().min(1),options:z.array(z.string()).optional(),missingFields:z.array(z.string()).optional()}).strict()
  const schema = z.union([completeSchema,clarificationSchema])
  const logger = dependencies.logger || (entry => console.debug('[AI_GENERATION]', entry))
  const started = Date.now()
  const metadata = {requestId:input.requestId,designId:input.itemId,selectedCategoryId:input.category,sourceWorldId:input.worldId || '',model:input.model}
  const validate = result => {
    // Legacy category metadata is discarded; content still has category-specific strict validation.
    const {category:_category,...content} = result && typeof result === 'object' ? result : {}
    const parsed = schema.safeParse(content)
    if (!parsed.success) {
      const branch = content.status === 'needs_clarification' ? clarificationSchema : completeSchema
      const issues = branch.safeParse(content).error?.issues || parsed.error.issues
      const error = new GatewayError('INVALID_SCHEMA','AI 返回的数据字段异常，请重试。',{statusCode:422,retryable:true})
      error.issues = issues.map(issue => ({path:issue.path,code:issue.code}))
      throw error
    }
    return parsed.data
  }
  logger({...metadata,event:'start',startedAt:new Date(started).toISOString()})
  try {
  const result = await (dependencies.requestStructured || generateStructured)({
    provider:input.provider, model:input.model, key:input.key, signal, requestId:input.requestId,
    messages:input.messages?.map(({role,content})=>({role,content})) || [{role:'user',content:input.requirements}], schema:z.toJSONSchema(schema), validate,
    instructions:`你是游戏${category.label}设计师。为“${input.name || input.currentDesign?.name || '尚未命名的内容'}”输出完整结构化设计与中英文生图 Prompt，只返回符合 schema 的 JSON。用户无需先命名，生成时建议合适名称。assistantMessage 用简短自然语言解释本轮设计，不把 JSON 当对话回复。用户让你建议时，明确标为“AI 建议”，不是已确认事实。当前任务类别 ID 固定为 ${input.category}，不要重新判断类别，不要输出 category 字段。只生成该类别内容，严格遵守 schema。专用字段：${JSON.stringify(category.fields)}。${category.focus} 保留用户全部明确要求和细节。世界设定为约束，不把无关故事堆进图像。若缺失信息会实质改变用途、主体或空间设计，返回 needs_clarification，合并询问2-3个关键问题并提供选项；不要重复询问已确认资料。其他非必需信息可待完善。已确认资料不得替换。未知或不适用的可选字段省略；必需信息不足时返回 needs_clarification，不使用空字符串或占位内容充当已完成设计。不要为动物、树木、石头默认添加服装、武器或人类语言。反向提示词针对本项需求，可为空，不默认禁止用户所需画风或文字。世界背景：${JSON.stringify(input.world || null)}。补充设计资料：${JSON.stringify(input.design || null)}。继承上下文与视觉简报：${JSON.stringify(context)}。当前完整设计：${JSON.stringify(input.currentDesign || null)}。当前视觉 Prompt：${JSON.stringify(input.currentAsset || null)}。${input.intent==='revise'?'这是同一档案修订，未被要求修改的字段和明确要求必须保留，不切换类型。':''}`,
    logger:entry=>logger({...metadata,...entry}),
  })
  const data = validate(result)
  logger({...metadata,event:'success',endedAt:new Date().toISOString(),durationMs:Date.now()-started,schemaValidation:'success',parsedContentLength:JSON.stringify(data).length})
  return { status:data.status || 'complete', phase:'content', itemId:input.itemId, context, ...data, category:input.category, requestId:input.requestId }
  } catch(error) {
    logger({...metadata,event:'failed',endedAt:new Date().toISOString(),durationMs:Date.now()-started,errorCode:error.code || 'INTERNAL_ERROR',message:error.message,issues:error.issues})
    throw error
  }
}
