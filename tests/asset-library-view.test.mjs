import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAssetLibraryDetail, buildAssetLibraryEntries } from '../src/agent/assetLibraryView.mjs'

const npc = {
  id: 'npc-1',
  name: '维克斯·索恩',
  role: '义体安装技师',
  world: '黑市义体诊所',
  function: '剧情 NPC',
  personality: ['冷静'],
  background: '曾为企业工作。',
  summary: '在黑市诊所服务底层居民。',
  goal: '维持诊所运作。',
  speechStyle: '简短克制',
  behaviorRules: ['不背叛患者'],
  sourcePrompt: '创建地下医生'
}

const prompt = {
  type: 'NPC立绘',
  style: '赛博朋克写实',
  objects: ['义体工具'],
  composition: '全身立绘',
  palette: '冷蓝色',
  lighting: '霓虹侧光',
  details: ['机械义肢'],
  format: 'PNG',
  aspectRatio: '2:3',
  promptZh: '黑市义体医生',
  promptEn: 'underground cybernetic doctor',
  negativePrompt: 'blurry'
}

test('asset library includes the saved NPC alongside saved visual prompts', () => {
  assert.deepEqual(buildAssetLibraryEntries(npc, [prompt]), [
    { id: 'npc:npc-1', kind: 'npc', title: '维克斯·索恩', subtitle: '义体安装技师 · 黑市义体诊所', detail: '角色档案' },
    { id: 'prompt:underground cybernetic doctor', kind: 'prompt', title: 'NPC立绘', subtitle: '赛博朋克写实', detail: 'Prompt 档案 · Version 1', prompt }
  ])
})

test('asset library still shows a saved NPC when no visual prompts exist', () => {
  assert.equal(buildAssetLibraryEntries(npc, []).length, 1)
  assert.equal(buildAssetLibraryEntries(npc, [])[0].kind, 'npc')
})

test('opening the NPC archive exposes the complete character and prompt history', () => {
  assert.deepEqual(buildAssetLibraryDetail('npc:npc-1', npc, [prompt]), {
    kind: 'npc',
    npc,
    prompts: [prompt]
  })
})

test('opening a prompt archive exposes that prompt without unrelated records', () => {
  assert.deepEqual(buildAssetLibraryDetail('prompt:underground cybernetic doctor', npc, [prompt]), {
    kind: 'prompt',
    prompt
  })
})
