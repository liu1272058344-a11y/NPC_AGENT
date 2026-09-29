import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVisualAsset } from '../src/agents/visualAgent.mjs'
import { buildPrompt } from '../src/prompt/promptBuilder.mjs'
import { criticPrompt } from '../src/prompt/promptCritic.mjs'
import { optimizePrompt } from '../src/prompt/promptOptimizer.mjs'

const character = { character_id: 'npc-7', profile: { name: '维克斯', role: '港口医生', background: '在雾港寻找失踪的女儿', personality: ['谨慎', '坚韧'] }, visual: { appearance: '银灰短发与疲惫的眼神', costume: '旧军装与皮质药包', weapon: '折叠长枪', environment: '雾港码头', lighting: '冷色逆光', camera: '中景侧面', art_style: 'dark fantasy concept art' } }

test('Visual Agent maps Character JSON into a complete visual asset', () => {
  const asset = buildVisualAsset(character)
  assert.equal(asset.source_character_id, 'npc-7')
  assert.equal(asset.subject, '维克斯')
  assert.equal(asset.costume, '旧军装与皮质药包')
  assert.equal(asset.status, 'draft')
})

test('Visual Agent accepts the existing flat NPC response shape', () => {
  const asset = buildVisualAsset({ id: 'npc-flat', name: '霓虹医师', role: '地下医生', background: '在黑市诊所工作', world: '赛博朋克城', sourcePrompt: '义体诊所' })
  assert.equal(asset.source_character_id, 'npc-flat')
  assert.equal(asset.subject, '霓虹医师')
  assert.match(asset.environment, /赛博朋克城/)
})

test('Prompt Engine builds sections and critic identifies missing environment', () => {
  const prompt = buildPrompt(buildVisualAsset(character))
  assert.match(prompt.prompt, /维克斯/)
  assert.deepEqual(criticPrompt({ ...prompt, environment: '' }).issues, ['environment'])
})

test('Prompt Optimizer adds critic requirements without changing subject', () => {
  const prompt = buildPrompt(buildVisualAsset(character))
  const optimized = optimizePrompt(prompt, { valid: false, issues: ['camera'] })
  assert.equal(optimized.subject, '维克斯')
  assert.match(optimized.prompt, /camera/i)
})
