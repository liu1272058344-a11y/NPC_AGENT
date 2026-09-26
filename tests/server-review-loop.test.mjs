import assert from 'node:assert/strict'
import test from 'node:test'
import { runReviewedGeneration } from '../server.mjs'

const world = (centralConflict) => ({
  name: '灰烬边城',
  genre: '末日废土',
  era: '灾变后第十年',
  atmosphere: '危险、克制但保留希望',
  coreRule: '净水和药品由城墙内的配给委员会统一控制',
  centralConflict,
  summary: '幸存者在资源配给与自由迁徙之间寻找新秩序。'
})

test('rejected world drafts feed private reviewer feedback into a later revision', async () => {
  const calls = []
  const request = async (input) => {
    calls.push(input)
    if (input.kind === 'generation') {
      return { status: 'world_ready', phase: 'world', world: world(calls.filter(({ kind }) => kind === 'generation').length === 1 ? '幸存者生活在一座城里。' : '药品配给委员会与地下互助网络争夺救命物资的控制权。') }
    }
    if (input.kind === 'review' && calls.filter(({ kind }) => kind === 'review').length === 1) {
      return { approved: false, issues: ['核心冲突过于笼统'], suggestions: ['明确配给委员会与互助网络的资源争夺'] }
    }
    return { approved: true, issues: [], suggestions: [] }
  }

  const result = await runReviewedGeneration({ phase: 'world', messages: [{ role: 'user', content: '末日废土药房前的急救员' }], model: 'fixture', provider: 'fixture', key: 'fixture', request })
  assert.equal(result.status, 'world_ready')
  assert.equal(calls.filter(({ kind }) => kind === 'generation').length, 2)
  assert.equal(calls.filter(({ kind }) => kind === 'review').length, 2)
  const secondGeneration = calls.filter(({ kind }) => kind === 'generation')[1]
  assert.match(secondGeneration.messages.at(-1).content, /核心冲突过于笼统/)
  assert.equal('issues' in result, false)
  assert.equal('suggestions' in result, false)
})

test('approved first world draft performs one generation and one review', async () => {
  const calls = []
  const request = async (input) => {
    calls.push(input)
    return input.kind === 'generation'
      ? { status: 'world_ready', phase: 'world', world: world('药房守门人必须在公开配给与私下救治家人之间作出选择。') }
      : { approved: true, issues: [], suggestions: [], score: 9 }
  }

  const result = await runReviewedGeneration({ phase: 'world', messages: [{ role: 'user', content: '末日废土药房前的急救员' }], model: 'fixture', provider: 'fixture', key: 'fixture', request })
  assert.equal(result.status, 'world_ready')
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(({ kind }) => kind), ['generation', 'review'])
  assert.equal('score' in result, false)
})
