import test from 'node:test'
import assert from 'node:assert/strict'
import { creationEditorFor, resumePromptData, resolveContentWorld } from '../src/content/archiveState.mjs'
import { generateContent } from '../src/server/contentGeneration.mjs'
test('nonhuman content archives stay in content editor while legacy NPC stays in NPC editor',()=>{
 assert.equal(creationEditorFor({category:'character',profile:{design:{fields:{entityKind:'plant',appearance:'古树'}}}}),null)
 assert.equal(creationEditorFor({category:'character',profile:{personality:['安静'],behaviorRules:['守门']}}),'character')
})
test('image prompt continuation preserves nested source context and old visual fields',()=>{
 const result=resumePromptData({id:'p',prompt:'tree',negativePrompt:'',snapshot:{mode:'edited',source:{context:{source:{worldId:'w',itemRevision:3}},design:{name:'古树'},asset:{style:'水彩'}}}})
 assert.equal(result.context.source.worldId,'w');assert.equal(result.design.name,'古树');assert.equal(result.asset.style,'水彩')
})
test('unavailable world is not replaced with old snapshot',()=>{
 assert.equal(resolveContentWorld([],{worldId:'gone',worldSnapshot:{id:'gone',name:'旧世界'}}),undefined)
})
test('content generation can ask targeted question without inventing complete design',async()=>{
 const result=await generateContent({category:'map',itemId:'m',name:'港口',requirements:'设计港口地图'},{requestStructured:async()=>({status:'needs_clarification',category:'map',question:'用于航海导航还是步行探索？',options:['航海导航','步行探索'],missingFields:['purpose']})})
 assert.equal(result.status,'needs_clarification');assert.equal(result.design,undefined);assert.equal(result.options[1],'步行探索')
})
test('continuing an edited image prompt uses submitted text rather than carried engineering text',()=>{
 const result=resumePromptData({prompt:'edited tree',negativePrompt:'new negative',snapshot:{source:{asset:{promptEn:'original tree',negativePrompt:'old negative',style:'水彩'}},mode:'edited'}})
 assert.equal(result.asset.promptEn,'edited tree');assert.equal(result.asset.negativePrompt,'new negative')
})
