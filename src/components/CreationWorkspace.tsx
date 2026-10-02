import { useRef, useState } from 'react'
import type { NPC, WorldProfile } from '../types/npc'
import type { AgentMessage } from '../agent/npcCreator'
import { createNPC } from '../agent/npcCreator'
import { createAssetApi } from '../agent/assetApi.mjs'
import { applyCharacterResult, applyWorldResult, copyDraftAsNew, createCharacterDraft, createWorldDraft, markDraftSaved, switchCreationKind, type CreationKind, type CreationSession } from '../agent/creationSession.mjs'
import { characterArchivePayload, shouldConfirmLeave, worldArchivePayload } from '../agent/creationWorkspaceState.mjs'
import { createRequestGuard } from '../agent/requestGuard.mjs'
import { WorldFieldsEditor } from './WorldFieldsEditor'
import { CharacterFieldsEditor } from './CharacterFieldsEditor'

export interface CreationWorkspaceProps {
  initialWorld?:WorldProfile|null
  initialNpc?:NPC|null
  onWorldChange:(world:WorldProfile|null)=>void
  onNpcChange:(npc:NPC|null)=>void
  onArchiveSaved?:()=>void
}

const statusLabel={unsaved:'未保存草稿',saved:'已保存',dirty:'有未保存更改'} as const
const withWorldId=(world:WorldProfile,id:string):WorldProfile=>({...world,id})
const initialSession=(world?:WorldProfile|null,npc?:NPC|null):CreationSession=>{
  const worldId=world?.id||crypto.randomUUID()
  const worldDraft=world?{...createWorldDraft(()=>worldId),value:withWorldId(world,worldId),saveState:'saved' as const}:createWorldDraft(()=>worldId)
  const characterId=npc?.id||crypto.randomUUID()
  const character=npc?{...createCharacterDraft(()=>characterId,worldDraft.value),value:{...npc,id:characterId},saveState:'saved' as const}:null
  return {activeKind:'world',world:worldDraft,character}
}

export function CreationWorkspace({initialWorld,initialNpc,onWorldChange,onNpcChange,onArchiveSaved}:CreationWorkspaceProps){
  const [session,setSession]=useState<CreationSession>(()=>initialSession(initialWorld,initialNpc))
  const [messages,setMessages]=useState<Record<CreationKind,AgentMessage[]>>({world:[],character:[]})
  const [input,setInput]=useState('')
  const [options,setOptions]=useState<string[]>([])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const api=useRef(createAssetApi())
  const guard=useRef(createRequestGuard())
  const activeDraft=session.activeKind==='world'?session.world:session.character
  const confirmReplace=()=>!shouldConfirmLeave(activeDraft)||window.confirm('当前档案有未保存更改，仍要继续吗？')
  const publish=(next:CreationSession)=>{setSession(next);onWorldChange(next.world.value);onNpcChange(next.character?.value||null)}
  const editWorld=(value:WorldProfile)=>publish({...session,world:{...session.world,value:withWorldId(value,session.world.id),saveState:session.world.saveState==='unsaved'?'unsaved':'dirty'}})
  const editCharacter=(value:NPC)=>{if(!session.character)return;publish({...session,character:{...session.character,value:{...value,id:session.character.id},saveState:session.character.saveState==='unsaved'?'unsaved':'dirty'}})}
  const send=async(intent:'create'|'revise'|'regenerate'='create',provided?:string)=>{
    const content=(provided||input||(intent==='regenerate'?'根据当前需求重新生成完整草案':'')).trim();if(!content||busy)return
    const request=guard.current.begin();if(!request)return
    const kind=session.activeKind,nextMessages=[...messages[kind],{role:'user' as const,content}]
    setBusy(true);setError('');setOptions([])
    try{
      const result=await createNPC(nextMessages,{phase:kind==='world'?'world':'npc',intent,currentWorld:session.world.value||undefined,currentNpc:session.character?.value||undefined,world:kind==='character'?session.world.value||undefined:undefined,signal:request.controller.signal,requestId:String(request.id)})
      if(!guard.current.isCurrent(request))return
      let next=session;let assistant=''
      if(result.status==='world_ready'&&result.world){next=applyWorldResult(session,result.world);onWorldChange(next.world.value)}
      else if(result.status==='complete'&&result.npc){next=applyCharacterResult(session,result.npc);onNpcChange(next.character?.value||null)}
      else {assistant=result.question||'';setOptions(result.options||[])}
      setSession(next);setMessages(old=>({...old,[kind]:[...nextMessages,...(assistant?[{role:'assistant' as const,content:assistant}]:[])]}));setInput('')
    }catch(value){if(guard.current.isCurrent(request)&&(value as Error)?.name!=='AbortError')setError(value instanceof Error?value.message:'生成失败，请重试。')}
    finally{if(guard.current.isCurrent(request)){guard.current.finish(request);setBusy(false)}}
  }
  const save=async(asNew=false)=>{
    if(!activeDraft?.value||busy)return
    setBusy(true);setError('')
    try{
      let next=session
      if(session.activeKind==='world'){
        const source=asNew?copyDraftAsNew(session.world):session.world;const draft={...source,value:withWorldId(source.value!,source.id)}
        const saved=await api.current.saveWorld(worldArchivePayload(draft));next={...session,world:markDraftSaved(draft,saved.updatedAt||new Date().toISOString())};onWorldChange(next.world.value)
      }else if(session.character){
        const source=asNew?copyDraftAsNew(session.character):session.character;const draft={...source,value:{...source.value!,id:source.id}}
        const result=await api.current.saveRemoteArchive(characterArchivePayload(draft));next={...session,character:markDraftSaved(draft,result.archive.updatedAt||new Date().toISOString())};onNpcChange(next.character!.value!)
      }
      setSession(next);onArchiveSaved?.()
    }catch(value){setError(value instanceof Error?value.message:'保存失败，请重试。')}finally{setBusy(false)}
  }
  const enterCharacter=()=>{const character=session.character||createCharacterDraft(undefined,session.world.value);publish(switchCreationKind({...session,character},'character'));setInput('');setOptions([])}
  const returnWorld=()=>{publish(switchCreationKind(session,'world'));setInput('');setOptions([])}
  const newWorld=()=>{if(!confirmReplace())return;const next:CreationSession={activeKind:'world',world:createWorldDraft(),character:session.character};publish(next);setMessages(old=>({...old,world:[]}));setInput('');setOptions([])}
  const newCharacter=()=>{if(!confirmReplace())return;const next={...session,activeKind:'character' as const,character:createCharacterDraft(undefined,session.world.value)};publish(next);setMessages(old=>({...old,character:[]}));setInput('');setOptions([])}
  const log=messages[session.activeKind]
  return <div className="creation-workspace"><section className="hero-card creation-hero"><div><h2>世界观与角色工作区</h2><p>Agent 只生成或修改当前草案；是否保存、重设或进入其他阶段由你决定。</p></div><div className="creation-kind-tabs"><button className={`choice ${session.activeKind==='world'?'is-active':''}`} onClick={returnWorld}>世界观</button><button className={`choice ${session.activeKind==='character'?'is-active':''}`} onClick={enterCharacter} disabled={!session.world.value}>角色</button></div></section><section className="panel creation-panel"><div className="result-heading"><div><div className="panel-label">{session.activeKind==='world'?'WORLD ARCHIVE':'CHARACTER ARCHIVE'}</div><h3>{activeDraft?.value?.name||'新建草案'}</h3></div><span className={`status-chip ${activeDraft?.saveState==='saved'?'primary':''}`}>{activeDraft?statusLabel[activeDraft.saveState]:'未保存草稿'}</span></div>{log.length>0&&<div className="conversation-log">{log.map((message,index)=><div className={`chat-line ${message.role}`} key={`${message.role}-${index}`}><span>{message.role==='user'?'你':'Agent'}</span><p>{message.content}</p></div>)}</div>}{options.length>0&&<div className="question-options">{options.map(option=><button className="choice" key={option} disabled={busy} onClick={()=>void send(activeDraft?.value?'revise':'create',option)}>{option}</button>)}</div>}<label>继续补充或修改<textarea aria-label="继续补充或修改" value={input} disabled={busy} onChange={event=>setInput(event.target.value)} placeholder={activeDraft?.value?'例如：把时代改成灾后五十年，其他设定保持不变…':'描述你想创建的内容…'}/></label><div className="export-actions"><button className="primary-button" disabled={busy||!input.trim()} onClick={()=>void send(activeDraft?.value?'revise':'create')}>{busy?'处理中…':activeDraft?.value?'应用修改':'生成草案'}</button><button className="choice" disabled={busy||!activeDraft?.value} onClick={()=>void send('regenerate')}>重新生成</button></div>{error&&<p className="error-message" role="alert">{error}</p>}</section>{activeDraft?.value&&<section className="panel creation-editor"><h3>直接编辑字段</h3>{session.activeKind==='world'?<WorldFieldsEditor value={session.world.value!} disabled={busy} onChange={editWorld}/>:<CharacterFieldsEditor value={session.character!.value!} disabled={busy} onChange={editCharacter}/>}<div className="export-actions"><button className="primary-button" disabled={busy} onClick={()=>void save(false)}>保存档案</button><button className="choice" disabled={busy} onClick={()=>void save(true)}>{session.activeKind==='world'?'另存为新世界':'另存为新角色'}</button>{session.activeKind==='world'?<button className="choice" disabled={busy} onClick={enterCharacter}>进入角色设计</button>:<><button className="choice" disabled={busy} onClick={returnWorld}>返回世界观</button><button className="choice" disabled={busy} onClick={newCharacter}>新建角色</button></>}</div></section>}<section className="panel"><button className="choice" disabled={busy} onClick={session.activeKind==='world'?newWorld:newCharacter}>{session.activeKind==='world'?'新建世界观':'新建角色'}</button></section></div>
}
