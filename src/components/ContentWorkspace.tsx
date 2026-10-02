import { useEffect, useMemo, useState } from 'react'
import { contentCategories, categoryLabel } from '../content/categories.mjs'
import type { ContentCategory } from '../content/categories.mjs'
import { createAssetApi } from '../agent/assetApi.mjs'
import type { ContentWorld, RemoteArchiveDetail, RemoteArchiveSummary } from '../agent/assetApi.mjs'
import { applyGenerationResult, buildContentLibrary } from '../agent/contentLibrary.mjs'
import { generateImage } from '../agent/image'
import type { ArtAssetPrompt, WorldProfile } from '../types/npc'
import { ContentItemDetail } from './ContentItemDetail'

type Draft = { id:string; category:ContentCategory;name:string;requirements:string;worldId:string;tags:string;relatedIds?:string[];fields:Record<string,string>;design?:{name:string;summary:string;fields:Record<string,string>};asset?:ArtAssetPrompt;requestId?:string;promptId?:string;promptProvider?:string;promptModel?:string;busy?:boolean;error?:string;notice?:string;image?:{url:string;model:string;size:string};imagePrompt?:string;imageNegative?:string;imagePromptId?:string;imageProvider?:string;imageModel?:string;imageId?:string;imageDesignSnapshot?:Draft['design'] }
type Props={mode:'studio'|'images'|'library';world:WorldProfile|null;provider:string;model:string;imageProvider:string;imageModel:string;imageEndpoint:string}
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
 const draft=drafts[selected]
 const update=(id:string,patch:Partial<Draft>)=>setDrafts(old=>({...old,[id]:{...old[id],...patch}}))
 useEffect(()=>{try{const compact=Object.fromEntries(Object.entries(drafts).map(([id,item])=>[id,item.image?.url.startsWith('data:')?{...item,image:undefined}:item]));localStorage.setItem(storageKey,JSON.stringify(compact))}catch{setError('浏览器草稿空间不足，请先保存到资产库。')}},[drafts])
 const reload=async()=>{setLoading(true);setError('');try{const [assets,items]=await Promise.all([api.listRemoteAssets(),api.listWorlds()]);setArchives(assets.archives);setWorlds(items)}catch(e){setError(message(e))}finally{setLoading(false)}}
 useEffect(()=>{setEditorOpen(false);void reload()},[props.mode])
 const create=(type:ContentCategory=category)=>{const id=crypto.randomUUID();setDrafts(old=>({...old,[id]:{id,category:type,name:'',requirements:'',worldId:'',tags:'',fields:{}}}));setCategory(type);setSelected(id);setDetail(null)}
 const open=async(id:string)=>{setLoading(true);setError('');try{setDetail(await api.getRemoteArchive(id))}catch(e){setError(message(e))}finally{setLoading(false)}}
 const worldFor=(item:Draft)=>worlds.find(w=>w.id===item.worldId)
 const archiveFor=(item:Draft)=>({id:item.id,name:item.name,summary:item.design?.summary || item.requirements,profile:{category:item.category,worldId:item.worldId,world:worldFor(item)?.profile || null,tags:item.tags.split(/[,，]/).map(x=>x.trim()).filter(Boolean),relatedIds:item.relatedIds || [],design:item.design || {name:item.name,summary:item.requirements,fields:item.fields},requirements:item.requirements}})
 const save=async(item:Draft)=>{
   const prompt=item.asset && {id:item.promptId || `prompt:${item.id}`,prompt:item.asset.promptEn,promptZh:item.asset.promptZh,negativePrompt:item.asset.negativePrompt,provider:item.promptProvider || props.provider,modelId:item.promptModel || props.model,snapshot:{category:item.category,design:item.design,asset:item.asset,world:worldFor(item)}}
   await api.saveRemoteArchive({archive:archiveFor(item),prompts:prompt?[prompt]:[]})
 }
 const saveDraft=async()=>{if(!draft)return;update(draft.id,{busy:true,error:'',notice:''});try{await save(draft);update(draft.id,{notice:'已保存到资产库'});await reload()}catch(e){update(draft.id,{error:message(e)})}finally{update(draft.id,{busy:false})}}
 const generate=async()=>{
  if(!draft || draft.busy)return
  const item={...draft},requestId=crypto.randomUUID()
  update(item.id,{requestId,busy:true,error:'',notice:''})
  try{
   const response=await fetch('/api/npc',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({phase:'content',provider:props.provider==='backend'?'openai':props.provider,model:props.model,requestId,messages:[{role:'user',content:item.requirements}],world:worldFor(item)?.profile,contentProfile:{category:item.category,itemId:item.id,name:item.name,requirements:item.requirements,design:item.fields}})})
   const result=await response.json()
   if(!response.ok)throw new Error(result.message || result.error?.message || '内容生成失败')
   if(result.itemId!==item.id || result.category!==item.category)throw new Error('生成结果归属不一致，请重试。')
   setDrafts(old=>applyGenerationResult(old,{itemId:item.id,requestId},{design:result.design,asset:result.asset,promptId:requestId,promptProvider:props.provider,promptModel:props.model,busy:false}))
  }catch(e){setDrafts(old=>applyGenerationResult(old,{itemId:item.id,requestId},{busy:false,error:message(e)}))}
 }
 const makeImage=async()=>{
  if(!draft?.asset || draft.busy)return
  const item={...draft},requestId=crypto.randomUUID(),promptId=crypto.randomUUID()
  update(item.id,{requestId,busy:true,error:'',notice:''})
  try{
   const image=await generateImage(item.asset!.promptEn,item.asset!.negativePrompt,'',{provider:props.imageProvider,model:props.imageModel,endpoint:props.imageEndpoint})
   setDrafts(old=>applyGenerationResult(old,{itemId:item.id,requestId},{image,imagePrompt:item.asset!.promptEn,imageNegative:item.asset!.negativePrompt,imagePromptId:promptId,imageId:requestId,imageProvider:props.imageProvider,imageModel:props.imageModel,imageDesignSnapshot:item.design,busy:false}))
  }catch(e){setDrafts(old=>applyGenerationResult(old,{itemId:item.id,requestId},{busy:false,error:message(e)}))}
 }
 const saveImage=async()=>{
  if(!draft?.image)return
  const item={...draft};update(item.id,{busy:true,error:'',notice:''})
  try{await api.saveRemoteImage({archive:archiveFor(item),idempotencyKey:`content-image:${item.imageId}`,sourceUrl:item.image!.url,prompt:{id:item.imagePromptId,prompt:item.imagePrompt,promptZh:item.asset?.promptZh || '',negativePrompt:item.imageNegative,provider:item.imageProvider,modelId:item.imageModel,snapshot:{category:item.category,design:item.imageDesignSnapshot,asset:item.asset,size:item.image!.size}},provider:item.imageProvider,modelId:item.imageModel});update(item.id,{notice:'图片与生成 Prompt 已保存'});await reload()}catch(e){update(item.id,{error:message(e)})}finally{update(item.id,{busy:false})}
 }
 const saveCurrentWorld=async()=>{
  if(!props.world)return
  try{
   const key='npc-forge-current-world-id';let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}
   await api.saveWorld({id,name:props.world.name,profile:{...props.world}});await reload();if(draft)update(draft.id,{worldId:id})
  }catch(e){setError(message(e))}
 }
 const resume=(item:RemoteArchiveDetail,promptId?:string)=>{
  const profile=item.archive.profile,record=item.prompts.find(p=>p.id===promptId)||item.prompts[0]
  const cat=(item.archive.category || profile.category) as ContentCategory
  if(!contentCategories[cat]){setError('请先为旧条目设置类别。');return}
  const design=profile.design as Draft['design']
  const snapshot=record?.snapshot?.asset as ArtAssetPrompt|undefined
  const asset=snapshot || (record?{type:categoryLabel(cat),style:'',objects:[],composition:'',palette:'',lighting:'',details:[],format:'png',aspectRatio:'1:1',promptZh:record.promptZh || '',promptEn:record.prompt,negativePrompt:record.negativePrompt}:undefined)
  const value:Draft={id:item.archive.id,name:item.archive.name,category:cat,requirements:String(profile.requirements || item.archive.summary),worldId:item.archive.worldId || '',tags:(item.archive.tags || []).join('，'),relatedIds:item.archive.relatedIds || [],fields:design?.fields || {},design,asset,promptId:crypto.randomUUID(),promptProvider:record?.provider,promptModel:record?.modelId}
  setDrafts(old=>({...old,[value.id]:value}));setSelected(value.id);setCategory(cat);setDetail(null);setEditorOpen(true)
 }
 const library=buildContentLibrary(archives,{category:filter,worldId:worldFilter,query,status})
 return <div className="content-workspace">
  <section className="hero-card"><div><div className="panel-label">GAME CONTENT</div><h2>{props.mode==='library'?'游戏资产库':props.mode==='images'?'分类文生图':'游戏内容工作室'}</h2><p>角色、地图、场景和道具，按世界与条目保存设计和生成历史。</p></div></section>
  {error && <div className="error-box" role="alert">{error}<button className="choice" onClick={()=>void reload()}>重试加载</button></div>}
  {detail ? <ContentItemDetail key={detail.archive.id} detail={detail} worlds={worlds} archives={archives} api={api} onBack={()=>{setDetail(null);void reload()}} onReload={()=>open(detail.archive.id)} onResume={resume}/> : <>
   {(props.mode!=='library' || editorOpen) && <section className="panel content-editor">
    <nav className="content-category-picker" aria-label="内容类别">{Object.entries(contentCategories).map(([id,value])=><button key={id} type="button" className={`choice ${category===id?'is-active':''}`} onClick={()=>{setCategory(id as ContentCategory);const match=Object.values(drafts).find(d=>d.category===id);if(match)setSelected(match.id);else create(id as ContentCategory)}}>{value.label}</button>)}</nav>
    <div className="content-toolbar"><select aria-label="当前内容条目" value={selected} onChange={e=>{setSelected(e.target.value);setCategory(drafts[e.target.value].category)}}><option value="" disabled>选择草稿或新建条目</option>{Object.values(drafts).filter(d=>d.category===category).map(d=><option key={d.id} value={d.id}>{d.name || '未命名草稿'}{d.busy?' · 生成中':''}</option>)}</select><button className="choice" onClick={()=>create()}>新建{categoryLabel(category)}</button></div>
    {!draft?<p>选择类别并新建条目，开始设计。</p>:<>
     <label>条目名称<input value={draft.name} disabled={draft.busy} onChange={e=>update(draft.id,{name:e.target.value})}/></label>
     <label>所属世界<select value={draft.worldId} disabled={draft.busy} onChange={e=>update(draft.id,{worldId:e.target.value})}><option value="">独立素材</option>{worlds.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
     {props.world && <button className="choice" onClick={()=>void saveCurrentWorld()}>使用当前世界：{props.world.name}</button>}
     <label>设计需求<textarea value={draft.requirements} disabled={draft.busy} onChange={e=>update(draft.id,{requirements:e.target.value})} placeholder={`描述${categoryLabel(draft.category)}的用途、风格和具体要求…`}/></label>
     <details><summary>补充{categoryLabel(draft.category)}设计细节（可选）</summary>{Object.entries(contentCategories[draft.category].fields).map(([key,label])=><label key={key}>{label}<textarea disabled={draft.busy} value={draft.fields[key] || ''} onChange={e=>update(draft.id,{fields:{...draft.fields,[key]:e.target.value}})}/></label>)}</details>
     <label>标签（逗号分隔）<input value={draft.tags} onChange={e=>update(draft.id,{tags:e.target.value})}/></label>
     <div className="export-actions"><button className="primary-button" disabled={draft.busy || !draft.name.trim() || !draft.requirements.trim()} onClick={()=>void generate()}>{draft.busy?'处理中…':'生成设计与 Prompt'}</button><button className="choice" disabled={draft.busy || !draft.name.trim()} onClick={()=>void saveDraft()}>保存条目</button></div>
     {draft.error && <p className="error-message" role="alert">{draft.error}</p>}{draft.notice && <p role="status">{draft.notice}</p>}
     {draft.design && <section><h3>{draft.design.name}</h3><p>{draft.design.summary}</p><dl>{Object.entries(draft.design.fields).map(([key,value])=><div key={key}><dt>{contentCategories[draft.category].fields[key] || key}</dt><dd>{value}</dd></div>)}</dl></section>}
     {draft.asset ? <section><h3>生成 Prompt</h3><label>中文<textarea value={draft.asset.promptZh} onChange={e=>update(draft.id,{asset:{...draft.asset!,promptZh:e.target.value},promptId:crypto.randomUUID()})}/></label><label>英文 / 生图输入<textarea value={draft.asset.promptEn} onChange={e=>update(draft.id,{asset:{...draft.asset!,promptEn:e.target.value},promptId:crypto.randomUUID()})}/></label><label>反向提示词<textarea value={draft.asset.negativePrompt} onChange={e=>update(draft.id,{asset:{...draft.asset!,negativePrompt:e.target.value},promptId:crypto.randomUUID()})}/></label><button className="primary-button" disabled={draft.busy || !draft.asset.promptEn.trim()} onClick={()=>void makeImage()}>生成{categoryLabel(draft.category)}图片</button><button className="choice" onClick={()=>void navigator.clipboard.writeText(draft.asset!.promptEn)}>复制 Prompt</button></section>:props.mode==='images' && <button className="choice" onClick={()=>update(draft.id,{asset:{type:categoryLabel(category),style:'',objects:[],composition:'',palette:'',lighting:'',details:[],format:'png',aspectRatio:'1:1',promptZh:'',promptEn:draft.requirements,negativePrompt:''},promptId:crypto.randomUUID()})}>直接填写生图 Prompt</button>}
     {draft.image && <section><img className="generated-image" src={draft.image.url} alt={draft.name}/><p>{draft.image.model} · {draft.image.size}</p><button className="primary-button" disabled={draft.busy || !draft.name.trim()} onClick={()=>void saveImage()}>保存图片到当前条目</button></section>}
    </>}
   </section>}
   <section className="panel"><h3>已保存资产</h3><div className="content-toolbar"><input aria-label="搜索资产" placeholder="搜索名称、摘要、标签" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="世界筛选" value={worldFilter} onChange={e=>setWorldFilter(e.target.value)}><option value="">全部世界</option><option value="independent">独立素材</option>{worlds.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><select aria-label="生产状态" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部状态</option><option value="design">仅设计</option><option value="prompt">已有 Prompt</option><option value="image">已有图片</option></select></div>
    <nav className="content-category-picker" aria-label="资产类别筛选"><button className={`choice ${!filter?'is-active':''}`} onClick={()=>setFilter('')}>全部</button>{['character','map','scene','prop','unknown'].map(c=><button key={c} className={`choice ${filter===c?'is-active':''}`} onClick={()=>setFilter(c)}>{categoryLabel(c)} {library.counts[c]}</button>)}</nav>
    {loading?<p>正在加载资产…</p>:error?<p>资产暂时无法加载，请重试。</p>:!library.items.length?<p>当前筛选下没有资产。</p>:<div className="library-grid">{library.items.map(item=><button type="button" className="asset-card content-asset-card" key={item.id} onClick={()=>void open(item.id)}>{item.coverUrl?<img className="asset-preview asset-image-preview" src={item.coverUrl} alt={item.name}/>:<div className="asset-preview">{categoryLabel(item.category || '')}</div>}<h3>{item.name}</h3><small>{categoryLabel(item.category || '')} · {worlds.find(w=>w.id===item.worldId)?.name || item.worldName || '独立素材'}</small><p>{item.summary}</p><small>{item.promptCount || 0} 条 Prompt · {item.imageCount} 张图片</small>{item.nearestExpiry && <small>{new Date(item.nearestExpiry).toLocaleDateString('zh-CN')} 起清理图片</small>}</button>)}</div>}
   </section>
  </>}
 </div>
}
