import {useEffect,useMemo,useRef,useState} from 'react'
import type {Dispatch,SetStateAction} from 'react'
import {createAssetApi} from '../agent/assetApi.mjs'
import type {ContentWorld} from '../agent/assetApi.mjs'
import {contentCategories,libraryCategoryLabel} from '../content/categories.mjs'
import {beginConversationTurn,completeConversationTurn,conversationArchivePayload,conversationImageHandoff,createConversationSession,editConversationSession,failConversationTurn,retryConversationTurn} from '../content/conversationSession.mjs'
import type {ConversationSession} from '../content/conversationSession.mjs'
import {requestConversationTurn} from '../content/conversationApi.mjs'
import type {StudioHandoff} from '../content/studioHandoff.mjs'
import type {WorldProfile} from '../types/npc'
import {ContentConversation} from './ContentConversation'
import {ContentResultPreview} from './ContentResultPreview'
import {runPipeline} from '../agent/pipeline'
import {pipelineSessions} from '../content/builderState.mjs'

export type SessionDirectory=Record<string,ConversationSession>
type Props={active:boolean;sessions:SessionDirectory;setSessions:Dispatch<SetStateAction<SessionDirectory>>;selected:string;onSelect:(id:string)=>void;provider:string;model:string;onUseForImage:(handoff:StudioHandoff)=>void;onArchives:()=>void}
const errorMessage=(e:unknown)=>e instanceof Error?e.message:'操作失败，请重试。'
export function GameContentBuilder({active,sessions,setSessions,selected,onSelect,provider,model,onUseForImage,onArchives}:Props){
 const api=useMemo(()=>createAssetApi(),[]),[worlds,setWorlds]=useState<ContentWorld[]>([]),[saving,setSaving]=useState(false),[notice,setNotice]=useState(''),[worldError,setWorldError]=useState('')
 const requests=useRef(new Map<string,AbortController>()),[pipelineInput,setPipelineInput]=useState(''),[pipelineBusy,setPipelineBusy]=useState(false)
 const session=sessions[selected] || Object.values(sessions)[0]
 const refresh=async()=>{try{const result=await api.listRemoteAssets();setWorlds(result.worlds || []);setWorldError('')}catch(e){setWorldError(errorMessage(e))}}
 useEffect(()=>{const controllers=requests.current;return()=>{for(const controller of controllers.values())controller.abort()}},[])
 useEffect(()=>{if(!active)return;let cancelled=false;void api.listRemoteAssets().then(result=>{if(!cancelled){setWorlds(result.worlds || []);setWorldError('')}}).catch(e=>{if(!cancelled){setWorlds([]);setWorldError(errorMessage(e))}});return()=>{cancelled=true}},[api,active])
 const linked=worlds.find(w=>w.id===session?.worldId),localWorld=Object.values(sessions).find(s=>s.kind==='world'&&s.id===session?.worldId)
 const liveWorld=linked?{...linked.profile,id:linked.id,name:linked.name} as unknown as WorldProfile:localWorld?.status==='draft'?localWorld.worldValue:undefined
 const update=(id:string,fn:(s:ConversationSession)=>ConversationSession)=>setSessions(old=>old[id]?{...old,[id]:fn(old[id])}:old)
 const create=(kind:ConversationSession['kind'])=>{const world=session?.kind==='world'?session.worldValue:liveWorld;const next=createConversationSession(kind,world);setSessions(old=>({...old,[next.id]:next}));onSelect(next.id);setNotice('')}
 const send=async(text?:string,retry=false)=>{
  if(!session || session.pendingRequest)return
  if(session.kind==='unknown'){setNotice('请先选择内容类型，再继续设计。');return}
  const requestId=crypto.randomUUID(),controller=new AbortController(),next=retry?retryConversationTurn(session,requestId):beginConversationTurn(session,text ?? session.input,requestId)
  if(!next.pendingRequest)return
  requests.current.set(session.id,controller);update(session.id,()=>({...next,worldSnapshot:liveWorld || next.worldSnapshot}));setNotice('')
  try{let confirmedWorld=liveWorld
   if(session.worldId&&localWorld?.status!=='draft')try{const fetched=await api.getWorld(session.worldId);confirmedWorld={...fetched.profile,id:fetched.id,name:fetched.name} as unknown as WorldProfile;setWorlds(old=>[fetched,...old.filter(w=>w.id!==fetched.id)])}catch(e){confirmedWorld=undefined;setWorldError(errorMessage(e));setWorlds(old=>old.filter(w=>w.id!==session.worldId))}
   const result=await requestConversationTurn(next,{provider,model,world:confirmedWorld,requestId,signal:controller.signal});update(session.id,current=>completeConversationTurn({...current,worldSnapshot:confirmedWorld,promptProvider:provider,promptModel:model},requestId,result))}
  catch(e){update(session.id,current=>failConversationTurn(current,requestId,errorMessage(e)))}finally{requests.current.delete(session.id)}
 }
 const save=async()=>{if(!session)return;setSaving(true);setNotice('');try{
  if(session.worldId&&!linked)throw new Error(localWorld?.worldValue?'请先保存来源世界档案，或选择“不关联世界”。':'原关联世界暂不可用，请重新选择世界或取消关联。')
  const payload=conversationArchivePayload({...session,worldSnapshot:liveWorld || session.worldSnapshot})
  let revision=session.revision
  if(payload.world){const saved=await api.saveWorld(payload.world);revision=Number(saved.profile.revision || revision);setWorlds(old=>[saved,...old.filter(w=>w.id!==saved.id)])}
  else await api.saveRemoteArchive(payload)
  update(session.id,current=>current.revision===session.revision?{...current,status:'saved',revision,worldSnapshot:liveWorld || current.worldSnapshot}:current);setNotice('档案已保存。')
 }catch(e){setNotice(errorMessage(e))}finally{setSaving(false)}}
 if(!session)return null
 return <><section className="builder-heading"><div><h2>游戏内容构建</h2><p>选择要设计的内容，与 AI 一起完善想法，再把视觉提示词带到文生图。</p></div><button className="choice" onClick={onArchives}>查看档案</button></section><section className="panel builder-toolbar"><label>当前设计<select aria-label="当前设计" value={session.id} onChange={e=>{onSelect(e.target.value);setNotice('')}}>{Object.values(sessions).map((s,index)=><option key={s.id} value={s.id}>{s.name || `${libraryCategoryLabel(s.kind)}构思 ${index+1}`} · {s.status==='saved'?'已保存':s.status==='dirty'?'有修改':'草稿'}</option>)}</select></label><label>设计内容<select aria-label="设计内容" value="" onChange={e=>{if(e.target.value)create(e.target.value as ConversationSession['kind'])}}><option value="" disabled>选择要新建的内容</option><option value="world">世界观与游戏玩法</option>{Object.entries(contentCategories).map(([kind,value])=><option key={kind} value={kind}>{value.label}</option>)}</select></label>{session.kind!=='world'&&<label>来源世界<select aria-label="来源世界" disabled={saving || !!session.pendingRequest} value={session.worldId} onChange={e=>update(session.id,current=>editConversationSession(current,{worldId:e.target.value,worldSnapshot:undefined}))}><option value="">不关联世界（独立设计）</option>{worlds.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}{session.worldId&&!linked&&<option value={session.worldId}>{localWorld?.worldValue?.name || '原关联世界暂不可用'}{localWorld?.worldValue?'（尚未保存）':''}</option>}</select></label>}{worldError&&<p role="alert">世界列表加载失败：{worldError}<button className="choice" onClick={()=>void refresh()}>重试</button></p>}{session.kind==='unknown'&&<label>内容类型<select value="unknown" onChange={e=>update(session.id,current=>editConversationSession(current,{kind:e.target.value as ConversationSession['kind']}))}><option value="unknown">请确认旧资料的类型</option>{Object.entries(contentCategories).map(([kind,value])=><option key={kind} value={kind}>{value.label}</option>)}</select></label>}</section><div className="builder-layout"><ContentConversation session={session} busy={saving || !!session.pendingRequest} onInputChange={input=>update(session.id,current=>({...current,input}))} onSend={text=>void send(text)} onRetry={()=>void send(undefined,true)}/><ContentResultPreview key={session.id} session={session} world={liveWorld} saving={saving} notice={notice} onEdit={patch=>update(session.id,current=>editConversationSession(current,patch))} onSave={()=>void save()} onUseForImage={lang=>{try{onUseForImage(conversationImageHandoff(session,lang))}catch(e){setNotice(errorMessage(e))}}}/></div><details className="panel advanced-details"><summary>一键生成完整内容（Pipeline）</summary><p>一次生成世界、角色和视觉方案，结果会加入当前设计列表。</p><label>游戏想法<textarea value={pipelineInput} onChange={e=>setPipelineInput(e.target.value)} disabled={pipelineBusy}/></label><button className="choice" disabled={pipelineBusy || !pipelineInput.trim()} onClick={async()=>{setPipelineBusy(true);try{const result=await runPipeline(pipelineInput);const imported=pipelineSessions(result);setSessions(old=>({...old,...Object.fromEntries(imported.map(s=>[s.id,s]))}));onSelect(imported[0].id);setNotice('完整生成结果已加入设计列表。')}catch(e){setNotice(errorMessage(e))}finally{setPipelineBusy(false)}}}>{pipelineBusy?'正在生成…':'一键完整生成'}</button></details></>
}
