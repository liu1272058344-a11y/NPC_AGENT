import { geminiConfig } from '../src/server/geminiConfig.mjs'
import { generateStructured } from '../src/services/llm/llmService.mjs'

try {
  const result = await generateStructured({
    ...geminiConfig(),
    messages:[{role:'user',content:'Return {"ok":true} as JSON.'}],
    instructions:'Return only the requested JSON object.',
    schema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false},
    validate(value) { if (value?.ok !== true) throw new Error('Smoke result mismatch'); return value },
    logger:()=>{},
  })
  if (result.ok !== true) throw new Error('Smoke result mismatch')
  console.log('Gemini smoke check passed.')
} catch (error) {
  console.error('Gemini smoke check failed:', error.code || 'SMOKE_FAILED')
  process.exitCode = 1
}
