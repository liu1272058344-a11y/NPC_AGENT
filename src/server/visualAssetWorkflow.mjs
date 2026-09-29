import { buildVisualAsset } from '../agents/visualAgent.mjs'
import { buildPrompt } from '../prompt/promptBuilder.mjs'
import { criticPrompt } from '../prompt/promptCritic.mjs'
import { optimizePrompt } from '../prompt/promptOptimizer.mjs'
import { generateImage } from '../services/image/imageService.mjs'

export async function runVisualAssetGeneration({ character, provider = 'openai', model, size, apiKey, endpoint, imageService = generateImage }) {
  const visualAsset = buildVisualAsset(character)
  let prompt = buildPrompt(visualAsset)
  const critique = criticPrompt(prompt)
  if (!critique.valid) {
    prompt = optimizePrompt(prompt, critique)
    const remaining = criticPrompt(prompt)
    if (!remaining.valid) throw Object.assign(new Error(`Prompt is missing: ${remaining.issues.join(', ')}`), { code: 'PROMPT_INVALID', statusCode: 400 })
  }
  const image = await imageService({ prompt: prompt.prompt, negativePrompt: prompt.negative_prompt, provider, model, size, apiKey, endpoint })
  return { visualAsset: { ...visualAsset, prompt: prompt.prompt, status: 'ready' }, prompt, image }
}
