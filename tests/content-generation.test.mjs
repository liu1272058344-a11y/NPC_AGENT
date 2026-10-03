import test from 'node:test'
import assert from 'node:assert/strict'
import { generateContent } from '../src/server/contentGeneration.mjs'

const asset = { type:'设计图', style:'写实', objects:['主体'], composition:'俯视', palette:'冷色', lighting:'自然', details:['细节'], format:'png', aspectRatio:'1:1', promptZh:'完整中文', promptEn:'complete prompt', negativePrompt:'' }
for (const category of ['character', 'map', 'scene', 'prop']) {
  test(`${category} generates without requiring an NPC and preserves user requirements`, async () => {
    const result = await generateContent({ category, itemId:'item-1', name:'测试', requirements:'完整需求', model:'chosen-model', key:'test', provider:'deepseek' }, { requestStructured: async (request) => {
      assert.equal(request.model, 'chosen-model')
      assert.equal(request.messages[0].content, '完整需求')
      const fields = request.schema.properties.design.properties.fields.required
      return { category, design:{ name:'测试', summary:'摘要', fields:Object.fromEntries(fields.map(field => [field, '具体内容'])) }, asset }
    } })
    assert.equal(result.itemId, 'item-1')
    assert.equal(result.category, category)
    assert.equal(result.asset.negativePrompt, '')
  })
}
test('invalid or mismatched categories are rejected', async () => {
  await assert.rejects(generateContent({ category:'invalid' }), { statusCode:400 })
  await assert.rejects(generateContent({ category:'map', itemId:'i', name:'n', requirements:'r', key:'k' }, { requestStructured:async () => ({ category:'character', design:{}, asset }) }), { statusCode:422 })
})
