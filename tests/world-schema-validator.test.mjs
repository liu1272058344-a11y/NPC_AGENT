import assert from 'node:assert/strict'
import test from 'node:test'
import { validateWorldSchema } from '../src/server/worldSchemaValidator.mjs'

const completeWorld = {
  name: '灰烬边城', genre: '末日废土', era: '灾变后第十年', atmosphere: '危险而克制',
  coreRule: '净水由配给委员会控制', centralConflict: '委员会与互助网络争夺药品', summary: '幸存者寻找新秩序。'
}

test('world validator derives success from a complete world object without model status fields', () => {
  assert.deepEqual(validateWorldSchema(completeWorld), { status: 'SUCCESS', phase: 'world', world: completeWorld })
})

test('world validator reports missing schema fields as a failed business result', () => {
  assert.deepEqual(validateWorldSchema({ name: '灰烬边城', genre: '末日废土' }), {
    status: 'FAILED', code: 'INVALID_SCHEMA', message: '世界观信息不完整，缺少或格式错误：时代背景、整体氛围、核心规则、主要冲突、世界概述。',
    missingFields: ['era', 'atmosphere', 'coreRule', 'centralConflict', 'summary']
  })
})
