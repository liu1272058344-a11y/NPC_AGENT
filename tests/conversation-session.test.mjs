import test from 'node:test'
import assert from 'node:assert/strict'
import {createConversationSession,beginConversationTurn,completeConversationTurn,failConversationTurn,retryConversationTurn,sessionFromArchive,conversationArchivePayload,restoreConversationSessions,conversationImageHandoff} from '../src/content/conversationSession.mjs'
const asset={promptEn:' tree \n',promptZh:'古树',negativePrompt:'',style:'水彩'}
test('retry never clears an edited unsent message',()=>{let s=createConversationSession('character',null,()=> 'retry');s=beginConversationTurn(s,'旧需求','r');s=failConversationTurn(s,'r','失败');s={...s,input:'新需求'};assert.equal(retryConversationTurn(s,'r2'),s)})
test('dirty saved archives remain saved targets rather than resurrectable new drafts',()=>{const s={...createConversationSession('character',null,()=> 'saved'),name:'树',asset,status:'dirty'};assert.equal(conversationImageHandoff(s).source.archiveSaved,true)})
test('selected historical prompt restores exact text rather than latest',()=>{
 const detail={archive:{id:'a',name:'树',category:'character',profile:{}},prompts:[{id:'new',prompt:'最新'},{id:'old',prompt:'旧文本\n原文',negativePrompt:'不要武器'}],images:[]}
 const s=sessionFromArchive(detail,'old');assert.equal(s.asset.promptEn,'旧文本\n原文');assert.equal(s.promptId,'old')
})
test('failed turns retry without duplicate messages and stale results never overwrite',()=>{
 let s=createConversationSession('character',null,()=> 'a');s={...s,asset,input:'古树'};s=beginConversationTurn(s,'古树','r1');s=failConversationTurn(s,'r1','失败');assert.equal(s.input,'古树');assert.equal(s.asset.promptEn,asset.promptEn)
 s=retryConversationTurn(s,'r2');assert.equal(s.messages.length,1);assert.equal(completeConversationTurn(s,'r1',{design:{name:'wrong'}}),s)
 s=completeConversationTurn(s,'r2',{design:{name:'记忆树',summary:'古老',fields:{appearance:'蓝叶'}},asset,assistantMessage:'已生成古树。'});assert.equal(s.name,'记忆树');assert.equal(s.messages.length,2);assert.equal(s.input,'')
})
test('archives preserve conversations and legacy NPC fields without fabricated dialogue',()=>{
 const s=sessionFromArchive({archive:{id:'c',name:'树',profile:{category:'character',worldId:'missing',background:'记忆',personality:['沉静'],goal:'守护',behaviorRules:['保护']}},prompts:[],images:[]})
 assert.equal(s.messages.length,0);assert.equal(s.originalProfile.background,'记忆');assert.equal(s.worldId,'missing');assert.equal(s.name,'树')
 const updated=completeConversationTurn(beginConversationTurn(s,'蓝叶','r'),'r',{design:{name:'树',summary:'古树',fields:{appearance:'蓝叶'}},asset})
 const payload=conversationArchivePayload(updated);assert.equal(payload.archive.id,'c');assert.equal(payload.archive.profile.background,'记忆');assert.equal(payload.archive.profile.conversation.messages.length,2)
})
test('restore keeps failed input, clears pending work, and language handoff keeps literal text',()=>{
 const s={...createConversationSession('character',null,()=> 'c'),name:'树',asset,input:'新的需求',pendingRequest:{id:'r',messageId:'u'},messages:[{id:'u',role:'user',content:'新的需求'}]}
 const restored=restoreConversationSessions({c:s}).c;assert.equal(restored.pendingRequest,undefined);assert.equal(restored.input,'新的需求');assert.equal(restored.failedMessageId,'u')
 assert.equal(conversationImageHandoff(s,'en').prompt,' tree \n');assert.equal(conversationImageHandoff(s,'zh').prompt,'古树')
})
import {conversationReply} from '../src/content/conversationSession.mjs'
test('preview replies stay readable and fresh prompt refers to produced revision',()=>{
 assert.match(conversationReply({status:'needs_clarification',question:'更偏向自然还是机械？'}),/自然/)
 assert.doesNotMatch(conversationReply({design:{name:'石头',summary:'保存记忆'}}),/^\{/)
 let s=beginConversationTurn(createConversationSession('prop',null,()=> 'p'),'石头','r')
 s=completeConversationTurn(s,'r',{design:{name:'石头',summary:'保存记忆',fields:{}},asset,context:{source:{itemId:'p',itemRevision:1,worldId:'',worldRevision:null,unavailable:false}}})
 assert.equal(s.context.source.itemRevision,s.revision)
 assert.throws(()=>conversationImageHandoff(createConversationSession('map')),/先生成/)
})
