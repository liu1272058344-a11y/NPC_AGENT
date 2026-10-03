import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { creationEditorFor, readArchiveProfile, resumePromptData, resolveContentWorld } from '../content/archiveState.mjs'
import { buildContentContext, isPromptStale } from '../content/context.mjs'
import type { ContentContext } from '../content/context.mjs'
import { createContentHandoff } from '../content/handoff.mjs'
import { draftLabel, transitionDraft, validateDraftName } from '../content/draftState.mjs'
import { contentCategories, categoryLabel, libraryCategoryLabel } from '../content/categories.mjs'
import type { ContentCategory } from '../content/categories.mjs'
import { createAssetApi } from '../agent/assetApi.mjs'
import type { ContentWorld, RemoteArchiveDetail, RemoteArchiveSummary } from '../agent/assetApi.mjs'
import { applyGenerationResult, buildContentLibrary } from '../agent/contentLibrary.mjs'
import {createStudioHandoff} from '../content/studioHandoff.mjs'
import type {StudioHandoff} from '../content/studioHandoff.mjs'
import {draftCatalog} from '../content/draftCatalog.mjs'
import type { ImageArchiveTarget } from '../content/imageRequest.mjs'
import type { ArtAssetPrompt, WorldProfile } from '../types/npc'
import { ContentItemDetail } from './ContentItemDetail'

type Draft = { originalProfile?:Record<string,unknown>; question?:string;options?:string[];promptDesign?:Draft['design'];revision?:number;visualBrief?:string;overrides?:Record<string,string>;fieldStatus?:Record<string,string>;worldSnapshot?:WorldProfile;promptContext?:ContentContext;promptMode?:'generated'|'edited'|'manual'; saved?:boolean;dirty?:boolean;savedSnapshot?:Draft; id:string; category:ContentCategory;name:string;requirements:string;worldId:string;tags:string;relatedIds?:string[];fields:Record<string,string>;design?:{name:string;summary:string;fields:Record<string,string>};asset?:ArtAssetPrompt;requestId?:string;promptId?:string;promptProvider?:string;promptModel?:string;busy?:boolean;error?:string;notice?:string;image?:{url:string;model:string;size:string};imagePrompt?:string;imageNegative?:string;imagePromptId?:string;imageProvider?:string;imageModel?:string;imageId?:string;imageDesignSnapshot?:Draft['design'] }
type Props={initialDesign?:{id:string;archive:ImageArchiveTarget}|null;onUseForImage?:(handoff:StudioHandoff)=>void;onDesignConsumed?:()=>void;initialContent?:{id:string;category:ContentCategory}|null;onCreateWorld?:()=>void;mode:'studio'|'library';world:WorldProfile|null;provider:string;model:string;imageProvider:string;imageModel:string;imageEndpoint:string;onEditCreationArchive?:(kind:'world'|'character',id:string)=>void}
const storageKey='npc-forge-content-drafts-v1'
const readDrafts=():Record<string,Draft>=>{try{return Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(storageKey)||'{}')).map(([id,value])=>[id,{...(value as Draft),busy:false}]))}catch{return {}}}
const message=(error:unknown)=>error instanceof Error?error.message:'操作失败，请重试。'
export function ContentWorkspace(props:Props) {
 const api=useMemo(()=>createAssetApi(),[])
 const [drafts,setDrafts]=useState<Record<string,Draft>>(readDrafts)
 const [selected,setSelected]=useState('')
 const [category,setCategory]=useState<ContentCategory>('character')
 const [archives,setArchives]=useState<RemoteArchiveSummary[]>([])
 const [worlds,setWorlds]=useState<ContentWorld[]>([])
 const [detail,setDetail]=useState<RemoteArchiveDetail|null>(null)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState('')
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState('')
 const [worldFilter,setWorldFilter]=useState('')
 const [status,setStatus]=useState('')
 const [editorOpen,setEditorOpen]=useState(false)
 const [pendingSwitch,setPendingSwitch]=useState<{targetId:string;category:ContentCategory;fresh?:Draft}|null>(null)
 const catalog=draftCatalog(drafts)
 const draft=drafts[selected]
 const update=(id:string,patch:Partial<Draft>)=>setDrafts(old=>({...old,[id]:{...old[id],...patch,...(Object.keys(patch).some(k=>['name','requirements','worldId','tags','fields','asset','visualBrief','overrides'].includes(k))?{dirty:true}:{}),...(Object.keys(patch).some(k=>['name','requirements','worldId','fields','visualBrief','overrides'].includes(k))?{revision:(old[id].revision || 1)+1}:{})}}))
 const switchDraft=(targetId:string,nextCategory:ContentCategory,fresh?:Draft,decision?:'keep'|'discard'|'cancel')=>{const result=transitionDraft({selected,drafts},{targetId,decision,replacement:!!fresh && targetId===selected});if(result.needsDecision){setPendingSwitch({targetId,category:nextCategory,fresh});return}if(decision==='cancel'){setPendingSwitch(null);return}setDrafts(fresh && !(decision==='keep' && targetId===selected)?{...result.state.drafts,[fresh.id]:fresh}:result.state.drafts);setSelected(targetId);setCategory(nextCategory);setDetail(null);setPendingSwitch(null)}
 useEffect(()=>{try{const compact=Object.fromEntries(Object.entries(drafts).map(([id,item])=>[id,item.image?.url.startsWith('data:')?{...item,image:undefined}:item]));localStorage.setItem(storageKey,JSON.stringify(compact))}catch{setError('浏览器草稿空间不足，请先保存到资产库。')}},[drafts])
 const reload=useCallback(async()=>{setLoading(true);setError('');try{const assets=await api.listRemoteAssets();setArchives(assets.archives);setWorlds(assets.worlds||[])}catch(e){setError(message(e))}finally{setLoading(false)}},[api])
 useEffect(()=>{setEditorOpen(false);void reload()},[props.mode,reload])
 const create=(type:ContentCategory=category)=>{const id=crypto.randomUUID();switchDraft(id,type,{id,category:type,name:'',requirements:'',worldId:props.world?.id || '',worldSnapshot:props.world || undefined,tags:'',fields:{},revision:1,dirty:false})}
 const open=async(id:string)=>{setLoading(true);setError('');try{setDetail(await api.getRemoteArchive(id))}catch(e){setError(message(e))}finally{setLoading(false)}}
 const worldFor=(item:Draft)=>resolveContentWorld(worlds,item)
 const consumedDesign=useRef('')
 useEffect(()=>{const incoming=props.initialDesign;if(!incoming || consumedDesign.current===incoming.id)return;consumedDesign.current=incoming.id;const a=incoming.archive,p=a.profile;const cat=(p.category || 'character') as ContentCategory;const fields=(p.design as Draft['design'])?.fields || {identity:String(p.role || ''),background:String(p.background || ''),behavior:Array.isArray(p.personality)?p.personality.join('、'):''};const value:Draft={id:a.id,name:a.name,category:cat,requirements:String(p.requirements || p.sourcePrompt || a.summary || ''),worldId:String(p.worldId || ''),tags:'',fields,originalProfile:p,revision:Number(p.revision || 1),dirty:false};switchDraft(value.id,cat,value);setEditorOpen(true);props.onDesignConsumed?.()},[props.initialDesign])
 const consumedHandoff=useRef('')
 const contextFor=(item:Draft)=>buildContentContext({world:worldFor(item)?{...worldFor(item)!.profile,id:item.worldId}:undefined,item,overrides:item.overrides})
 useEffect(()=>{
  if(!props.initialContent || !props.world || consumedHandoff.current===props.initialContent.id)return
  consumedHandoff.current=props.initialContent.id
  const existing=drafts[props.initialContent.id]
  if(existing){setSelected(existing.id);setCategory(existing.category);return}
  const initial=createContentHandoff(props.world,props.initialContent.category,()=>props.initialContent!.id)
  setDrafts(old=>({...old,[initial.id]:initial}));setSelected(initial.id);setCategory(initial.category)
  void api.saveWorld({id:props.world.id!,name:props.world.name,profile:{...props.world}}).then(saved=>{setWorlds(old=>[...old.filter(w=>w.id!==saved.id),saved]);setDrafts(old=>({...old,[initial.id]:{...old[initial.id],worldSnapshot:{...saved.profile,id:saved.id} as WorldProfile}}))}).catch(e=>setError(`当前世界尚未保存：${message(e)}。可重试使用当前世界，或选择暂不关联世界。`))
 },[api,props.initialContent,props.world,drafts])
 const archiveFor=(item:Draft)=>({id:item.id,name:item.name,summary:item.design?.summary || item.requirements,profile:{...item.originalProfile,revision:item.revision || 1,visualBrief:item.visualBrief || '',fieldStatus:item.fieldStatus || {},entityKind:item.fields.entityKind,overrides:item.overrides || {},category:item.category,worldId:item.worldId,world:worldFor(item)?.profile || null,tags:item.tags.split(/[,，]/).map(x=>x.trim()).filter(Boolean),relatedIds:item.relatedIds || [],design:{name:item.name,summary:item.design?.summary || item.requirements,fields:{...item.design?.fields,...item.fields}},requirements:item.requirements}})
 const save=async(item:Draft)=>{
   const prompt=item.asset && {id:item.promptId || `prompt:${item.id}`,prompt:item.asset.promptEn,promptZh:item.asset.promptZh,negativePrompt:item.asset.negativePrompt,provider:item.promptProvider || props.provider,modelId:item.promptModel || props.model,snapshot:{mode:item.promptMode || 'generated',context:item.promptContext,category:item.category,design:item.promptDesign || item.design,asset:item.asset,world:item.promptContext?.confirmed.world || null}}
   await api.saveRemoteArchive({archive:archiveFor(item),prompts:prompt?[prompt]:[]})
 }
 const saveDraft=async()=>{if(!draft)return;const validation=validateDraftName(draft.name);if(!validation.valid){update(draft.id,{error:validation.message});return}update(draft.id,{busy:true,error:'',notice:''});try{await save(draft);update(draft.id,{notice:'已保存到资产库',saved:true,dirty:false,savedSnapshot:{...draft,savedSnapshot:undefined,dirty:false,saved:true}});await reload()}catch(e){update(draft.id,{error:message(e)})}finally{update(draft.id,{busy:false})}}
 const generate=async(answer?:string)=>{
  if(!draft || draft.busy)return
  const item={...draft,requirements:answer?`${draft.requirements}\n补充：${answer}`:draft.requirements},requestId=crypto.randomUUID()
  update(item.id,{requestId,busy:true,error:'',notice:'',question:'',options:[]})
  try{
   const response=await fetch('/api/npc',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({phase:'content',provider:props.provider==='backend'?'openai':props.provider,model:props.model,requestId,messages:[{role:'user',content:item.requirements}],world:worldFor(item)?.profile,contentProfile:{category:item.category,itemId:item.id,name:item.name,requirements:item.requirements,design:{...item.design?.fields,...item.fields},revision:item.revision || 1,visualBrief:item.visualBrief,overrides:item.overrides,fieldStatus:item.fieldStatus,worldId:item.worldId}})})
   const result=await response.json()
   if(!response.ok)throw new Error(result.message || result.error?.message || '内容生成失败')
   if(result.status==='needs_clarification'){setDrafts(old=>applyGenerationResult(old,{itemId:item.id,requestId},{requirements:item.requirements,question:result.question,options:result.options || [],busy:false}));return}
   if(result.itemId!==item.id || result.category!==item.category)throw new Error('生成结果归属不一致，请重试。')
   setDrafts(old=>applyGenerationResult(old,{itemId:item.id,requestId},{requirements:item.requirements,promptDesign:result.design,design:result.design,fields:{...item.fields,...result.design.fields},asset:result.asset,dirty:true,promptContext:result.context,promptMode:'generated',promptId:requestId,promptProvider:props.provider,promptModel:props.model,busy:false}))
  }catch(e){setDrafts(old=>applyGenerationResult(old,{itemId:item.id,requestId},{busy:false,error:message(e)}))}
 }
 const bringPrompt=(item:Draft)=>{if(!item.asset)return;props.onUseForImage?.(createStudioHandoff({prompt:item.asset.promptEn,negativePrompt:item.asset.negativePrompt,source:{...item.promptContext,itemId:item.id,name:item.name,category:item.category,archiveSaved:!!item.saved},target:archiveFor(item),mode:item.promptMode || 'generated'}))}
 const saveImage=async()=>{
  if(!draft?.image)return
  const item={...draft};update(item.id,{busy:true,error:'',notice:''})
  try{await api.saveRemoteImage({archive:archiveFor(item),idempotencyKey:`content-image:${item.imageId}`,sourceUrl:item.image!.url,prompt:{id:item.imagePromptId,prompt:item.imagePrompt,promptZh:'',negativePrompt:item.imageNegative,provider:item.imageProvider,modelId:item.imageModel,snapshot:{category:item.category,design:item.imageDesignSnapshot,size:item.image!.size}},provider:item.imageProvider,modelId:item.imageModel});update(item.id,{notice:'图片与生成 Prompt 已保存'});await reload()}catch(e){update(item.id,{error:message(e)})}finally{update(item.id,{busy:false})}
 }
 const saveCurrentWorld=async()=>{
  if(!props.world)return
  try{
   const key='npc-forge-current-world-id';let id=props.world.id || localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}
   await api.saveWorld({id,name:props.world.name,profile:{...props.world}});await reload();if(draft)update(draft.id,{worldId:props.world.id || id,worldSnapshot:props.world})
  }catch(e){setError(message(e))}
 }
 const resume=(item:RemoteArchiveDetail,promptId?:string)=>{
  const profile=item.archive.profile,normalized=readArchiveProfile(item.archive),record=item.prompts.find(p=>p.id===promptId)||item.prompts[0]
  const cat=(item.archive.category || profile.category) as ContentCategory
  if(!contentCategories[cat]){if(record){props.onUseForImage?.(createStudioHandoff({prompt:record.prompt,negativePrompt:record.negativePrompt,source:record.snapshot || null,target:item.archive}));return}setError('尚无视觉提示词，请先完成内容设计。');return}
  const design=profile.design as Draft['design']
  const promptData=resumePromptData(record)
  const snapshot=promptData.asset
  const asset=snapshot || (record?{type:categoryLabel(cat),style:'',objects:[],composition:'',palette:'',lighting:'',details:[],format:'png',aspectRatio:'1:1',promptZh:record.promptZh || '',promptEn:record.prompt,negativePrompt:record.negativePrompt}:undefined)
  const value:Draft={revision:normalized.revision,visualBrief:String(profile.visualBrief || ''),overrides:profile.overrides as Record<string,string>|undefined,fieldStatus:profile.fieldStatus as Record<string,string>|undefined,promptDesign:promptData.design || design,promptContext:promptData.context,promptMode:promptData.mode,id:item.archive.id,name:item.archive.name,category:cat,requirements:String(profile.requirements || item.archive.summary),worldId:item.archive.worldId || '',tags:(item.archive.tags || []).join('，'),relatedIds:item.archive.relatedIds || [],fields:normalized.fields,design,asset,promptId:crypto.randomUUID(),promptProvider:record?.provider,promptModel:record?.modelId}
  value.saved=true;value.dirty=false;value.savedSnapshot={...value};switchDraft(value.id,cat,value);setEditorOpen(true)
 }
 const worldEntries=worlds.map(item=>({id:item.id,name:item.name,summary:String(item.profile.summary||''),profile:{...item.profile,category:'world'},category:'world',worldId:item.id,worldName:item.name,tags:[],updatedAt:item.updatedAt,promptCount:0,imageCount:0,byteCount:0}))
 const library=buildContentLibrary([...worldEntries,...archives],{category:filter,worldId:worldFilter,query,status})
 const openLibraryItem=async(item:any)=>{const editor=creationEditorFor(item);if(editor && props.onEditCreationArchive){props.onEditCreationArchive(editor,item.id);return}await open(item.id)}
 const deleteWorldEntry=async(item:any)=>{const count=archives.filter(archive=>archive.worldId===item.id&&archive.category==='character').length;if(!window.confirm(`删除世界观“${item.name}”？${count} 个关联角色将保留并转为独立角色。`))return;setLoading(true);setError('');try{await api.deleteWorld(item.id);await reload()}catch(e){setError(message(e));setLoading(false)}}
 return <div className="content-workspace">
  <section className="hero-card"><div><div className="panel-label">GAME CONTENT</div><h2>{props.mode==='library'?'游戏资产库':'游戏内容工作室'}</h2><p>角色、地图、场景和道具，按世界与条目保存设计和生成历史。</p></div></section>
  {pendingSwitch && <section className="panel" role="dialog" aria-modal="true" aria-label="未保存的条目"><h3>当前条目有未保存修改</h3><p>保留会留在本地草稿；保存到资产库需要点击“保存条目”。</p>{(['keep','discard','cancel'] as const).map((decision,index)=><button key={decision} className="choice" onClick={()=>switchDraft(pendingSwitch.targetId,pendingSwitch.category,pendingSwitch.fresh,decision)}>{['保留草稿并切换','放弃修改并切换','取消切换'][index]}</button>)}</section>}
  {error && <div className="error-box" role="alert">{error}<button className="choice" onClick={()=>void reload()}>重试加载</button></div>}
  {detail ? <ContentItemDetail key={detail.archive.id} detail={detail} worlds={worlds} archives={archives} api={api} onBack={()=>{setDetail(null);void reload()}} onReload={async()=>{await open(detail.archive.id);await reload()}} onResume={resume} onUseForImage={props.onUseForImage}/> : <>
   {(props.mode!=='library' || editorOpen) && <section className="panel content-editor">
    <nav className="content-category-picker" aria-label="内容类别">{Object.entries(contentCategories).map(([id,value])=><button key={id} type="button" className={`choice ${category===id?'is-active':''}`} onClick={()=>{const match=Object.values(drafts).find(d=>d.category===id);if(match)switchDraft(match.id,id as ContentCategory);else switchDraft('',id as ContentCategory)}}>{value.label}</button>)}</nav>
    <div className="content-toolbar"><select aria-label="当前内容条目" value={selected} onChange={e=>{switchDraft(e.target.value,drafts[e.target.value].category)}}><option value="" disabled>选择已命名条目</option>{catalog.named.filter(d=>d.category===category).map(d=><option key={d.id} value={d.id}>{draftLabel(d)}{d.busy?' · 生成中':''}</option>)}</select><button className="choice" onClick={()=>create()}>新建{categoryLabel(category)}</button></div>
    {catalog.recoverable.some(d=>d.category===category) && <details><summary>恢复旧草稿</summary>{catalog.recoverable.filter(d=>d.category===category).map((d,index)=><button key={d.id} className="choice" onClick={()=>switchDraft(d.id,d.category)}>未命名{categoryLabel(d.category)}草稿 {index+1} · {d.requirements.slice(0,35)}</button>)}</details>}
    {!draft?<p>选择类别并新建条目，开始设计。</p>:<>
     <label>条目名称<input placeholder={`为这个${categoryLabel(draft.category)}起一个名称`} value={draft.name} disabled={draft.busy} onChange={e=>update(draft.id,{name:e.target.value})}/></label>
     <p className="section-hint">在上方填写名称即可命名；保存条目后进入资产库，之后仍可重命名。{draft.busy?'生成中，完成后可修改。':''}</p>
     <label>所属世界<select value={draft.worldId} disabled={draft.busy} onChange={e=>update(draft.id,{worldId:e.target.value,worldSnapshot:undefined})}><option value="">暂不关联世界</option>{draft.worldId && !worlds.some(w=>w.id===draft.worldId) && <option value={draft.worldId}>{draft.worldSnapshot?.name || '原关联世界'}（尚未加载或保存）</option>}{worlds.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
     <p className="section-hint">{draft.worldId?'生成将继承所选世界的规则与视觉方向。':'可先单独创作，之后再关联世界。'}{!worlds.length && !props.world?' 暂无可选世界，请先前往世界构建创建并保存世界。':''}</p>{!worlds.length && !props.world && <button className="choice" onClick={props.onCreateWorld}>创建世界</button>}
     {props.world && <button className="choice" onClick={()=>void saveCurrentWorld()}>使用当前世界：{props.world.name}</button>}
     {draft.worldId && <details open><summary>继承来源：{worldFor(draft)?.name || '世界暂不可用'}</summary><p>世界规则：{String(worldFor(draft)?.profile.coreRule || '待完善')}</p><p>时代与氛围：{String(worldFor(draft)?.profile.era || '')} · {String(worldFor(draft)?.profile.atmosphere || '')}</p><p>视觉方向：{String(worldFor(draft)?.profile.visualDirection || '尚未确定')}</p></details>}
     <label>视觉简报<textarea disabled={draft.busy} value={draft.visualBrief || ''} onChange={e=>update(draft.id,{visualBrief:e.target.value})} placeholder="明确形态、材质、色彩、构图和输出用途；留空项可在后续完善。"/></label>
     <details><summary>覆盖继承的视觉方向（可选）</summary><label>本条目的视觉方向<input disabled={draft.busy} value={draft.overrides?.visualDirection || ''} onChange={e=>update(draft.id,{overrides:e.target.value?{visualDirection:e.target.value}:{}})}/></label>{contextFor(draft).conflicts.length>0 && <p role="status">与世界视觉方向不同，将作为此条目的明确覆盖保存，世界设定保持原值。</p>}</details>
     <label>设计需求<textarea value={draft.requirements} disabled={draft.busy} onChange={e=>update(draft.id,{requirements:e.target.value})} placeholder={`描述${categoryLabel(draft.category)}的用途、风格和具体要求…`}/></label>
     <details><summary>补充{categoryLabel(draft.category)}设计细节（可选）</summary>{Object.entries(contentCategories[draft.category].fields).map(([key,label])=><label key={key}>{label}<textarea disabled={draft.busy} value={draft.fields[key] || ''} onChange={e=>update(draft.id,{fields:{...draft.fields,[key]:e.target.value}})}/></label>)}</details>
     <label>标签（逗号分隔）<input value={draft.tags} onChange={e=>update(draft.id,{tags:e.target.value})}/></label>
     <div className="export-actions"><button className="primary-button" disabled={draft.busy || !draft.name.trim() || !draft.requirements.trim()} onClick={()=>void generate()}>{draft.busy?'处理中…':'生成设计与 Prompt'}</button><button className="choice" disabled={draft.busy || !draft.name.trim()} onClick={()=>void saveDraft()}>保存条目</button></div>
     {draft.question && <section><h3>补充关键信息</h3><p>{draft.question}</p>{draft.options?.map(option=><button key={option} className="choice" disabled={draft.busy} onClick={()=>void generate(option)}>{option}</button>)}<p>也可以在设计需求中补充答案，再点击生成。</p></section>}
     {draft.error && <p className="error-message" role="alert">{draft.error}</p>}{draft.notice && <p role="status">{draft.notice}</p>}
     {draft.design && <section><h3>{draft.name}</h3><p>{draft.design.summary}</p><dl>{Object.entries(draft.design.fields).map(([key,value])=><div key={key}><dt>{contentCategories[draft.category].fields[key] || key}</dt><dd>{value}</dd></div>)}</dl></section>}
     {draft.asset ? <section><h3>美术 Prompt（可自行修改）</h3>{draft.promptContext && isPromptStale(draft.promptContext.source,worldFor(draft)?{...worldFor(draft)!.profile,id:draft.worldId}:undefined,draft) && <p role="status">来源设定已有变化。可重新生成 Prompt，旧版本仍保留；也可继续使用当前文本生图。</p>}{draft.promptContext?.pending.length ? <p>待完善：{draft.promptContext.pending.join('、')}</p>:null}<label>中文<textarea value={draft.asset.promptZh} onChange={e=>update(draft.id,{asset:{...draft.asset!,promptZh:e.target.value},promptMode:'edited',promptId:crypto.randomUUID()})}/></label><label>英文 / 生图输入<textarea value={draft.asset.promptEn} onChange={e=>update(draft.id,{asset:{...draft.asset!,promptEn:e.target.value},promptMode:'edited',promptId:crypto.randomUUID()})}/></label><label>反向提示词<textarea value={draft.asset.negativePrompt} onChange={e=>update(draft.id,{asset:{...draft.asset!,negativePrompt:e.target.value},promptMode:'edited',promptId:crypto.randomUUID()})}/></label><button className="primary-button" disabled={draft.busy || !draft.asset.promptEn.trim()} onClick={()=>bringPrompt(draft)}>一键用于文生图</button><button className="choice" onClick={()=>void navigator.clipboard.writeText(draft.asset!.promptEn)}>复制 Prompt</button></section>:null}
     {draft.image && <section><img className="generated-image" src={draft.image.url} alt={draft.name}/><p>{draft.image.model} · {draft.image.size}</p><button className="primary-button" disabled={draft.busy || !draft.name.trim()} onClick={()=>void saveImage()}>保存图片到当前条目</button></section>}
    </>}
   </section>}
   <section className="panel"><h3>已保存资产</h3><div className="content-toolbar"><input aria-label="搜索资产" placeholder="搜索名称、摘要、标签" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="世界筛选" value={worldFilter} onChange={e=>setWorldFilter(e.target.value)}><option value="">全部世界</option><option value="independent">暂未关联世界</option>{worlds.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><select aria-label="生产状态" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option><option value="design">仅设计</option><option value="prompt">已有 Prompt</option><option value="image">已有图片</option></select></div>
    <nav className="content-category-picker" aria-label="资产类别筛选"><button className={`choice ${!filter?'is-active':''}`} onClick={()=>setFilter('')}>全部</button>{['world','character','map','scene','prop','clothing','unknown'].map(c=><button key={c} className={`choice ${filter===c?'is-active':''}`} onClick={()=>setFilter(c)}>{libraryCategoryLabel(c)} {library.counts[c]}</button>)}</nav>
    {loading?<p>正在加载资产…</p>:error?<p>资产暂时无法加载，请重试。</p>:!library.items.length?<p>当前筛选下没有资产。</p>:<div className="library-grid">{library.items.map((item:any)=><article className="asset-card content-asset-card asset-card-button" key={item.id} role="button" tabIndex={0} onClick={()=>void openLibraryItem(item)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' ')void openLibraryItem(item)}}>{item.coverUrl?<img className="asset-preview asset-image-preview" src={item.coverUrl} alt={item.name}/>:<div className="asset-preview">{libraryCategoryLabel(item.category||'')}</div>}<h3>{item.name}</h3><small>{libraryCategoryLabel(item.category||'')} · {item.category==='world'?`${String(item.profile?.genre||'未设置类型')} · ${String(item.profile?.era||'未设置时代')}`:worlds.find(w=>w.id===item.worldId)?.name||item.worldName||'暂未关联世界'}</small><p>{item.summary}</p>{item.category==='world'?<><small>{archives.filter(archive=>archive.worldId===item.id&&archive.category==='character').length} 个关联角色</small><button className="choice asset-delete" onClick={event=>{event.stopPropagation();void deleteWorldEntry(item)}}>删除世界观</button></>:<small>{item.promptCount||0} 条 Prompt · {item.imageCount} 张图片</small>}{item.nearestExpiry&&<small>{new Date(item.nearestExpiry).toLocaleDateString('zh-CN')} 起清理图片</small>}</article>)}</div>}
   </section>
  </>}
 </div>
}
