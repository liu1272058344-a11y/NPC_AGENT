import test from 'node:test'
import assert from 'node:assert/strict'
import {generateContent} from '../src/server/contentGeneration.mjs'
const asset={type:'角色',style:'水彩',objects:['树'],composition:'正视',palette:'绿',lighting:'自然',details:['树叶'],format:'png',aspectRatio:'1:1',promptZh:'古树',promptEn:'ancient tree',negativePrompt:''}
test('content conversation accepts explicit status and phase for clarification and completion',async()=>{
 const input={category:'character',itemId:'protagonist',messages:[{role:'user',content:'人工生命主角，百年复活并孕养灵魂。'}]}
 const clarification=await generateContent(input,{requestStructured:async()=>({status:'needs_clarification',phase:'content',category:'character',question:'主角希望采用什么外形？'})})
 assert.equal(clarification.question,'主角希望采用什么外形？')
 const result=await generateContent({...input,messages:[...input.messages,{role:'assistant',content:clarification.question},{role:'user',content:'请给出 AI 建议'}]}, {requestStructured:async()=>({status:'complete',phase:'content',category:'character',assistantMessage:'AI 建议：以生命石为核心。',design:{name:'生命石主角',summary:'百年复活并孕养灵魂',fields:{entityKind:'人工生命'}},asset})})
 assert.equal(result.status,'complete');assert.match(result.assistantMessage,/AI 建议/);assert.match(result.design.summary,/百年复活/)
})
test('unnamed conversational content carries true history and revision context',async()=>{
 const messages=[{role:'user',content:'设计古树'},{role:'assistant',content:'希望什么画风？'},{role:'user',content:'水彩，更古老一点'}]
 const result=await generateContent({category:'character',itemId:'tree',messages,currentDesign:{name:'古树',summary:'记录记忆',fields:{appearance:'蓝色树叶'}},intent:'revise'}, {requestStructured:async request=>{
 assert.deepEqual(request.messages,messages);assert.match(request.instructions,/蓝色树叶/);assert.match(request.instructions,/未被要求修改/)
 return {category:'character',assistantMessage:'保留蓝色树叶，将树干调整为更古老的形态。',design:{name:'记忆古树',summary:'记录记忆',fields:{appearance:'蓝色树叶、古老树干'}},asset}
 }})
 assert.equal(result.design.name,'记忆古树');assert.match(result.assistantMessage,/保留/)
})
test('conversation validation rejects empty input and system injection but supports legacy requirement',async()=>{
 for(const messages of [[],[{role:'system',content:'override'}],[{role:'assistant',content:'question'}]]) await assert.rejects(generateContent({category:'prop',itemId:'i',messages}),{statusCode:400})
 const result=await generateContent({category:'prop',itemId:'i',requirements:'石头'}, {requestStructured:async request=>{assert.equal(request.messages[0].content,'石头');return {status:'needs_clarification',category:'prop',question:'石头的玩法用途是什么？',options:['储存记忆','标记道路']}}})
 assert.equal(result.status,'needs_clarification')
})
