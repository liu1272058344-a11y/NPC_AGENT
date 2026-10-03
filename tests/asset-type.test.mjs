import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAssetType } from '../src/server/assetType.mjs'
import { classifyLegacyAsset, libraryCategoryLabel } from '../src/content/categories.mjs'

test('asset type variants map to the stable product vocabulary', () => {
  const cases = [
    ['NPC立绘', 'NPC立绘'],
    ['全身角色立绘', 'NPC立绘'],
    ['角色立绘（全身）', 'NPC立绘'],
    ['环境概念图', '场景概念图'],
    ['concept art', '场景概念图'],
    ['character turnaround', '角色三视图'],
    ['表情动作参考表', '表情动作表'],
    ['UI icon', 'UI图标'],
    ['icon', 'UI图标'],
    ['完全未知的输出', '其他美术资源']
  ]
  for (const [input, expected] of cases) assert.equal(normalizeAssetType(input), expected, input)
})

test('world archives have a browsable category without becoming image-generation content', () => {
  assert.equal(classifyLegacyAsset({ profile: { category: 'world' } }), 'world')
  assert.equal(libraryCategoryLabel('world'), '世界观')
})
