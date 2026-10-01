import test from 'node:test'
import assert from 'node:assert/strict'
import { assetGenerationButton, characterArchiveStatus } from '../src/agent/generationView.mjs'

test('asset generation button exposes progress and blocks duplicate submission', () => {
  assert.deepEqual(assetGenerationButton({ generating: true, hasAsset: false, ready: true }), { label: '生成中…', disabled: true })
  assert.deepEqual(assetGenerationButton({ generating: false, hasAsset: true, ready: true }), { label: '重新拆解资源提示词', disabled: false })
  assert.deepEqual(assetGenerationButton({ generating: false, hasAsset: false, ready: false }), { label: '生成资源提示词', disabled: true })
})

test('a local character archive is described as browser storage, not remote storage', () => {
  assert.equal(characterArchiveStatus(), '已保存到当前浏览器')
})
