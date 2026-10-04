import {createConversationSession,restoreConversationSessions,sessionFromArchive,sessionFromLegacyDraft} from './conversationSession.mjs'
import {stableLegacyId} from '../agent/assetMigration.mjs'
import {readCreationSaveStates,readCharacterWorldContext} from '../agent/creationWorkspaceState.mjs'
import {readDeletedDraftIds,readStoredBuilderSessions} from './draftManagement.mjs'
const read=(storage,key,fallback=null)=>{try{return JSON.parse(storage.getItem(key) || 'null') || fallback}catch{return fallback}}
export function readBuilderSessions(storage,idFactory=()=>crypto.randomUUID()){
 const existing=restoreConversationSessions(readStoredBuilderSessions(storage))
 const deleted=readDeletedDraftIds(storage)
 for(const id of deleted)delete existing[id]
 for(const draft of Object.values(read(storage,'npc-forge-content-drafts-v1',{}))){if(draft?.id&&!deleted.has(draft.id)&&!existing[draft.id])existing[draft.id]=sessionFromLegacyDraft(draft)}
 for(const [key,kind] of [['npc-forge-current-world','world'],['npc-forge-current-npc','character']]){
  const value=read(storage,key);if(!value)continue
  const id=value.id || stableLegacyId(kind,storage.getItem('npc-forge-workspace-id') || 'default',value)
  if(deleted.has(id))continue
  if(!value.id)storage.setItem(key,JSON.stringify({...value,id}))
  const state=readCreationSaveStates(storage)[kind==='world'?'world':'character']
  if(!existing[id])existing[id]={...sessionFromArchive({archive:{id,name:value.name || '',summary:value.summary || '',category:kind,profile:{...value,category:kind,...(kind==='character'?{worldId:readCharacterWorldContext(storage).worldId || value.worldId || ''}:{})},imageCount:0},prompts:[],images:[]}),status:state==='saved'?'saved':state==='dirty'?'dirty':'draft'}
 }
 if(!Object.keys(existing).length){const next=createConversationSession('world',null,idFactory);existing[next.id]=next}
 return existing
}
export function pipelineSessions(result,idFactory=()=>crypto.randomUUID()){
 const world={...createConversationSession('world',null,idFactory),name:result.project.name,worldValue:{...result.project.world,name:result.project.world.name || result.project.name},originalProfile:{...result.project.world,origin:'pipeline',pipelineOutput:result}};world.worldValue.id=world.id
 const characters=(result.project.characters || []).map((p,index)=>({...sessionFromArchive({archive:{id:idFactory(),name:p.name || '',summary:p.summary || '',category:'character',profile:{...p,category:'character',worldId:world.id,origin:'pipeline'},imageCount:0},prompts:[],images:[]}),status:'draft',worldSnapshot:world.worldValue,...(index===0?{asset:{type:'角色',style:'',objects:[],composition:'',palette:'',lighting:'',details:[],format:'png',aspectRatio:'1:1',promptZh:'',promptEn:result.visual.visual_prompt,negativePrompt:result.visual.negative_prompt || ''},promptMode:'generated'}:{})}))
 if(!characters.length&&result.visual?.visual_prompt)characters.push({...createConversationSession('scene',world.worldValue,idFactory),name:result.project.name,asset:{type:'场景',style:'',objects:[],composition:'',palette:'',lighting:'',details:[],format:'png',aspectRatio:'1:1',promptZh:'',promptEn:result.visual.visual_prompt,negativePrompt:result.visual.negative_prompt || ''},originalProfile:{origin:'pipeline',assets:result.project.assets}})
 return [world,...characters]
}
