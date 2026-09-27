import { z } from 'zod'

const text = z.string().trim().min(1)
const list = z.array(text).min(1)

export const worldSchema = z.object({
  name: text, genre: text, era: text, atmosphere: text, coreRule: text, centralConflict: text, summary: text
}).strict()

export const npcSchema = z.object({
  id: text, name: text, role: text, world: text, function: text, summary: text,
  background: text, goal: text, speechStyle: text, sourcePrompt: text,
  personality: list, behaviorRules: list
}).strict()

export const assetSchema = z.object({
  type: text, style: text, objects: list, composition: text, palette: text, lighting: text,
  details: list, format: text, aspectRatio: text, promptZh: text, promptEn: text, negativePrompt: text
}).strict()

export const clarificationSchema = z.object({
  status: z.literal('needs_clarification'), phase: z.enum(['world', 'npc']),
  question: text.optional(), options: z.array(text).optional(), missingFields: z.array(text).optional()
}).strict()

export const worldResultSchema = z.discriminatedUnion('status', [
  clarificationSchema.extend({ phase: z.literal('world') }),
  z.object({ status: z.literal('world_ready'), phase: z.literal('world'), world: worldSchema }).strict()
])

export const npcResultSchema = z.discriminatedUnion('status', [
  clarificationSchema.extend({ phase: z.literal('npc') }),
  z.object({ status: z.literal('complete'), phase: z.literal('npc'), npc: npcSchema }).strict()
])

export const assetResultSchema = z.object({ status: z.literal('complete'), phase: z.literal('asset'), asset: assetSchema }).strict()
export const reviewSchema = z.object({ approved: z.boolean(), issues: z.array(text), suggestions: z.array(text), score: z.number().finite().optional() }).strict()

export const jsonSchemaFor = (schema) => {
  if (schema === reviewSchema) return { type: 'object', properties: { approved: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } }, suggestions: { type: 'array', items: { type: 'string' } }, score: { type: 'number' } }, required: ['approved', 'issues', 'suggestions'], additionalProperties: false }
  return { type: 'object' }
}
