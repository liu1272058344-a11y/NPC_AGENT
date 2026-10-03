import { useEffect, useRef, useState } from 'react'
import { generateImage } from '../agent/image'
import type { ImageResult } from '../agent/image'
import { captureImageRequest, imageSavePayload, canGenerateImage, canSaveImage } from '../content/imageRequest.mjs'
import type { ImageArchiveTarget, ImageRequestSnapshot } from '../content/imageRequest.mjs'
import {receiveStudioHandoff} from '../content/studioHandoff.mjs'
import type {StudioHandoff} from '../content/studioHandoff.mjs'
import type { createAssetApi } from '../agent/assetApi.mjs'

export interface ImageEditorInput { id:string;prompt:string;negativePrompt:string;source:Record<string,unknown>|null;mode:ImageRequestSnapshot['mode'];targetId?:string;target?:ImageArchiveTarget|null }
type Props={provider:string;model:string;endpoint:string;api:ReturnType<typeof createAssetApi>;targets:ImageArchiveTarget[];initial?:ImageEditorInput|null;onSaved:()=>Promise<void>}
export function ContentImageEditor({provider,model,endpoint,api,targets,initial,onSaved}:Props) {
 const [prompt,setPrompt]=useState(''),[negative,setNegative]=useState(''),[source,setSource]=useState<Record<string,unknown>|null>(null),[mode,setMode]=useState<ImageRequestSnapshot['mode']>('manual')
 const [targetId,setTargetId]=useState(''),[name,setName]=useState(''),[size,setSize]=useState('1024x1024')
 const [result,setResult]=useState<{image:ImageResult;requestSnapshot:ImageRequestSnapshot}|null>(null)
 const [busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('')
 const [pending,setPending]=useState<ImageEditorInput|null>(null)
 const consumed=useRef(''),dirty=useRef(false),unsavedImage=useRef(false)
 const lock=useRef(false),saveLock=useRef(false),mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 const accept=(value:ImageEditorInput)=>{setPrompt(value.prompt);setNegative(value.negativePrompt);setSource(value.source);setMode(value.mode);setTargetId(value.targetId || '');setError('');setResult(null);setSaved(false);dirty.current=false;unsavedImage.current=false;consumed.current=value.id;setPending(null)}
 useEffect(()=>{if(!initial || consumed.current===initial.id)return;const received=receiveStudioHandoff({prompt,generating:lock.current,saving:saveLock.current,dirty:dirty.current,hasUnsavedImage:unsavedImage.current,consumedId:consumed.current},{...initial,target:initial.target || null} as StudioHandoff);if(received.needsDecision)setPending(initial);else accept(initial)},[initial])
 const manual=()=>{setSource(null);setMode('manual');setTargetId('');setError('');dirty.current=true}
 const generate=async()=>{
  if(!canGenerateImage({generating:lock.current,saving:saveLock.current,prompt}))return
  let request:ImageRequestSnapshot
  try{request=captureImageRequest({prompt,negativePrompt:negative,provider,model,parameters:{size},source,mode})}catch(e){setError((e as Error).message);return}
  lock.current=true;setBusy(true);setError('')
  try{const image=await generateImage(request.prompt,request.negativePrompt,'',{provider:request.provider,model:request.model,endpoint,size:request.parameters.size});if(mounted.current){setResult({image,requestSnapshot:request});setSaved(false);unsavedImage.current=true}}catch(e){if(mounted.current)setError((e as Error).message)}finally{lock.current=false;if(mounted.current)setBusy(false)}
 }
 const save=async()=>{
  if(!result || saveLock.current || lock.current || saved)return
  const target=targetId?targets.find(item=>item.id===targetId):null
  if(targetId && !target){setError('所选条目已不可用，请重新选择保存归属。');return}
  saveLock.current=true;setSaving(true);setError('')
  try{await api.saveRemoteImage(imageSavePayload(result,target,name));if(mounted.current){setSaved(true);unsavedImage.current=false;await onSaved()}}catch(e){if(mounted.current)setError((e as Error).message)}finally{saveLock.current=false;if(mounted.current)setSaving(false)}
 }
 return <section className="panel content-editor image-free-editor"><div className="result-heading"><div><h2>图片生成</h2></div><button className="choice" disabled={busy || saving} onClick={manual}>使用自己的提示词</button></div>
 {pending && <div role="dialog" aria-label="新的生图提示词"><p>当前有编辑内容或未保存图片，要使用新提示词吗？</p><button className="choice" disabled={busy || saving} onClick={()=>{consumed.current=pending.id;setPending(null)}}>继续编辑当前内容</button><button className="primary-button" disabled={busy || saving} onClick={()=>accept(pending)}>使用新提示词</button></div>}
 {source && <p className="section-hint">已带入内容条目：{String(source.name || source.itemId || '')}。可以自由修改文本，不会自动追加世界或风格要求。</p>}
 <label>生图提示词（中文或英文）<textarea aria-label="自由生图提示词" value={prompt} disabled={busy} onChange={e=>{setPrompt(e.target.value);dirty.current=true;if(source)setMode('edited')}} placeholder="例如：一棵长着蓝色晶体叶片的古树，水彩插画…"/></label>
 <details className="image-advanced"><summary>更多设置</summary><label>反向提示词（可选）<textarea value={negative} disabled={busy} onChange={e=>{setNegative(e.target.value);dirty.current=true;if(source)setMode('edited')}}/></label>
 </details><div className="image-composer-actions"><label>图片尺寸<select value={size} disabled={busy} onChange={e=>setSize(e.target.value)}><option>1024x1024</option><option>1024x1536</option><option>1536x1024</option></select></label>
 <p className="section-hint">模型：{model}。尺寸需当前模型支持，服务报错时可修改尺寸后重试。</p>
 <button className="primary-button" disabled={!canGenerateImage({generating:busy,saving,prompt})} onClick={()=>void generate()}>{busy?'生成图片中…':'生成图片'}</button>
 </div>{error && <p role="alert" className="error-message">{error}</p>}
 {result && <section><img className="generated-image" src={result.image.url} alt="生成的游戏内容图片"/><p>{result.image.model} · {result.image.size}</p><details><summary>本张图片实际使用的提示词</summary><p>{result.requestSnapshot.prompt}</p><p>{result.requestSnapshot.negativePrompt}</p></details><label>保存归属<select disabled={saving || busy || saved} value={targetId} onChange={e=>setTargetId(e.target.value)}>{targetId && !targets.some(t=>t.id===targetId) && <option value={targetId}>来源已不可用，请选择独立保存</option>}<option value="">单独保存，暂不关联内容条目</option>{targets.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>{!targetId && <label>图片档案名称（可选）<input disabled={saving || saved} value={name} onChange={e=>setName(e.target.value)} placeholder="自由创作"/></label>}<button className="primary-button" disabled={!canSaveImage({generating:busy,saving,saved,hasResult:!!result,targetId,targets})} onClick={()=>void save()}>{saving?'保存中…':saved?'已保存':'保存图片'}</button>{saved && <p role="status">图片及生成时的提示词已保存到资产库。</p>}</section>}
 </section>
}
