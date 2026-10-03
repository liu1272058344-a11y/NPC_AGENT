import {categoryLabel} from './categories.mjs'
import {resumePromptData} from './archiveState.mjs'
import {createStudioHandoff} from './studioHandoff.mjs'
export const conversationStorageKey='npc-forge-conversation-sessions-v1'
export function createConversationSession(kind='world',world=null,idFactory=()=>crypto.randomUUID()){
 return {id:idFactory(),kind,worldId:kind==='world'?'':world?.id || '',worldSnapshot:world || undefined,messages:[],input:'',name:'',revision:1,status:'draft',updatedAt:new Date().toISOString()}
}
export function beginConversationTurn(session,text,requestId){
 if(session.pendingRequest || !text?.trim())return session
 const message={id:`user:${requestId}`,role:'user',content:text}
 return {...session,input:text,messages:[...session.messages,message],pendingRequest:{id:requestId,messageId:message.id},failedMessageId:undefined,error:undefined,options:[],status:session.status==='saved'?'dirty':session.status,updatedAt:new Date().toISOString()}
}
export function retryConversationTurn(session,requestId){
 if(session.pendingRequest || !session.failedMessageId)return session
 return {...session,pendingRequest:{id:requestId,messageId:session.failedMessageId},error:undefined}
}
export function conversationReply(result){return result.status==='needs_clarification'?result.question || result.assistantMessage || '请补充希望达到的用途和画面方向。':result.assistantMessage || (result.world?`已整理「${result.world.name}」的世界设定。${result.world.summary}`:`已整理「${result.design?.name || '内容'}」的设计和视觉提示词。${result.design?.summary || ''}`)}
export function completeConversationTurn(session,requestId,result){
 if(session.pendingRequest?.id!==requestId)return session
 const messages=[...session.messages,{id:`assistant:${requestId}`,role:'assistant',content:conversationReply(result)}]
 const base={...session,messages,pendingRequest:undefined,failedMessageId:undefined,error:undefined,input:'',options:result.options || result.suggestions || [],updatedAt:new Date().toISOString()}
 if(result.status==='needs_clarification')return base
 const revision=session.revision+1,worldValue=result.world?{...result.world,id:session.id}:session.worldValue
 const design=result.design?{...result.design,fields:{...session.design?.fields,...result.design.fields}}:session.design
 return {...base,revision,name:result.world?.name || design?.name || session.name,worldValue,design,asset:result.asset || session.asset,context:result.context || session.context,promptId:result.asset?`prompt:${requestId}`:session.promptId,promptMode:result.asset?'generated':session.promptMode,promptSnapshot:result.asset?structuredClone({category:session.kind,mode:'generated',design,asset:result.asset,context:result.context,world:result.context?.confirmed?.world,messages}):session.promptSnapshot,status:session.status==='saved'?'dirty':session.status}
}
export function failConversationTurn(session,requestId,error){
 if(session.pendingRequest?.id!==requestId)return session
 return {...session,failedMessageId:session.pendingRequest.messageId,pendingRequest:undefined,error}
}
export function restoreConversationSessions(values){return Object.fromEntries(Object.entries(values || {}).filter(([,s])=>s && typeof s.id==='string' && Array.isArray(s.messages)).map(([id,s])=>[id,{...s,pendingRequest:undefined,...(s.pendingRequest?{failedMessageId:s.pendingRequest.messageId,error:'上次生成已中断，可以重试。'}:{})}]))}
export function sessionFromArchive(detail){
 const a=detail.archive,p=a.profile || {},kind=a.category || p.category || 'unknown',history=p.conversation?.messages
 const record=detail.prompts?.[0],resumed=resumePromptData(record)
 const raw=p.design || (kind==='world'?undefined:{name:a.name,summary:a.summary || '',fields:p.fields || {}})
 const asset=resumed.asset || (record?{type:categoryLabel(kind),style:'',objects:[],composition:'',palette:'',lighting:'',details:[],format:'png',aspectRatio:'1:1',promptZh:record.promptZh || '',promptEn:record.prompt,negativePrompt:record.negativePrompt || ''}:p.asset)
 const worldValue=kind==='world'?Object.fromEntries(['id','name','genre','era','atmosphere','coreRule','centralConflict','summary','visualDirection','revision'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]])):undefined
 return {...createConversationSession(kind),id:a.id,name:a.name,worldId:kind==='world'?'':p.worldId || '',worldSnapshot:p.world || undefined,worldValue:worldValue?{...worldValue,id:a.id,name:a.name}:undefined,messages:Array.isArray(history)?history.filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string'):[],input:'',revision:p.revision || 1,status:'saved',originalProfile:p,design:raw,asset,context:resumed.context,promptId:record?.id,promptSnapshot:record?.snapshot,promptMode:resumed.mode,tags:p.tags || [],visualBrief:p.visualBrief || '',overrides:p.overrides || {},updatedAt:a.updatedAt || new Date().toISOString()}
}
export function conversationArchivePayload(session){
 if(!session.name?.trim())throw new Error('请先为档案填写名称。')
 const conversation={messages:session.messages},profile={...session.originalProfile,category:session.kind,revision:session.revision,worldId:session.worldId,world:session.worldSnapshot || null,conversation,design:session.design,visualBrief:session.visualBrief || '',overrides:session.overrides || {},tags:session.tags || [],requirements:session.messages.filter(m=>m.role==='user').map(m=>m.content).join('\n')}
 if(session.kind==='world')return {world:{id:session.id,name:session.name,profile:{...session.originalProfile,...session.worldValue,id:session.id,name:session.name,conversation}}}
 const archive={id:session.id,name:session.name,summary:session.design?.summary || profile.requirements,profile}
 const prompts=session.asset?[{id:session.promptId || `prompt:${session.id}:${session.revision}`,prompt:session.asset.promptEn,promptZh:session.asset.promptZh || '',negativePrompt:session.asset.negativePrompt || '',provider:session.promptProvider || '',modelId:session.promptModel || '',snapshot:session.promptSnapshot || {asset:session.asset,design:session.design,context:session.context,mode:session.promptMode || 'manual'}}]:[]
 return {archive,prompts}
}
export function editConversationSession(session,patch,idFactory=()=>crypto.randomUUID()){
 const next={...session,...patch,revision:session.revision+1,status:session.status==='draft'?'draft':'dirty',updatedAt:new Date().toISOString()}
 if(patch.asset){next.promptId=`prompt:${idFactory()}`;next.promptMode='edited';next.promptSnapshot=structuredClone({asset:patch.asset,design:next.design,context:next.context,mode:'edited'})}
 return next
}
export function conversationImageHandoff(session,language='en'){
 if(!session.asset)throw new Error('请先生成视觉提示词。')
 return createStudioHandoff({prompt:language==='zh'?session.asset.promptZh:session.asset.promptEn,negativePrompt:session.asset.negativePrompt,source:{...session.context,itemId:session.id,name:session.name,category:session.kind,archiveSaved:session.status==='saved',revision:session.revision},target:conversationArchivePayload(session).archive,mode:session.promptMode || 'generated'})
}
export function sessionFromLegacyDraft(draft){return {...sessionFromArchive({archive:{id:draft.id,name:draft.name || '',profile:{...draft.originalProfile,category:draft.category,worldId:draft.worldId,world:draft.worldSnapshot,design:draft.design || {name:draft.name || '',summary:draft.requirements || '',fields:draft.fields || {}},asset:draft.asset,visualBrief:draft.visualBrief,overrides:draft.overrides,requirements:draft.requirements}},prompts:[],images:[]}),status:draft.saved && !draft.dirty?'saved':'draft',input:draft.requirements || '',asset:draft.asset}}
