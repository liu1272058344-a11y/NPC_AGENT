import test from 'node:test'
import assert from 'node:assert/strict'
import {contentCategories,categoryLabel,classifyLegacyAsset} from '../src/content/categories.mjs'
import {generateContent} from '../src/server/contentGeneration.mjs'
test('clothing is a first class category and accepts nonhuman display',async()=>{
 assert.equal(categoryLabel('clothing'),'服饰');assert.equal(classifyLegacyAsset({profile:{category:'clothing'}}),'clothing')
 assert.ok(contentCategories.clothing.fields.wearer)
 const result=await generateContent({category:'clothing',itemId:'c',name:'树衣',requirements:'树木保护套'}, {requestStructured:async request=>{
 assert.match(request.instructions,/非人/)
 return {status:'needs_clarification',category:'clothing',question:'需要什么材质？'}
 }})
 assert.equal(result.category,'clothing')
})
