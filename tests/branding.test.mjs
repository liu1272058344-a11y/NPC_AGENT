import test from 'node:test'
import assert from 'node:assert/strict'
import { getProductBranding } from '../src/agent/branding.mjs'

test('internal beta uses the current AI game content product name', () => {
  const branding = getProductBranding()
  assert.equal(branding.productName, 'AI 游戏内容生产智能体')
  assert.equal(branding.internalBetaTitle, 'AI 游戏内容生产智能体 · 内测')
  assert.equal(branding.internalBetaTitle.includes('NPC Forge'), false)
})
