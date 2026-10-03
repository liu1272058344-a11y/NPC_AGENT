import {useCallback,useEffect,useMemo,useState} from 'react'
import {createAssetApi} from '../agent/assetApi.mjs'
import type {ImageArchiveTarget} from '../content/imageRequest.mjs'
import type {StudioHandoff} from '../content/studioHandoff.mjs'
import {getImageModelOptions} from '../agent/imageProviderConfig.mjs'
import {ContentImageEditor} from './ContentImageEditor'

type Props={handoff:StudioHandoff|null;provider:string;model:string;onModelChange?:(model:string)=>void;endpoint:string;active:boolean}
export function ImageWorkspace({handoff,provider,model,endpoint,active,onModelChange}:Props){
 const api=useMemo(()=>createAssetApi(),[])
 const [targets,setTargets]=useState<ImageArchiveTarget[]>([]),[error,setError]=useState('')
 const reload=useCallback(async()=>{try{const result=await api.listRemoteAssets();setTargets(result.archives.map(a=>({id:a.id,name:a.name,summary:a.summary,profile:a.profile||{category:a.category}})));setError('')}catch(e){setError(e instanceof Error?e.message:'无法加载保存归属，仍可自由生成。')}},[api])
 useEffect(()=>{if(active)void reload()},[active,reload])
 const initial=useMemo(()=>handoff?{...handoff,targetId:handoff.target?.id}:null,[handoff])
 return <div className="image-workspace"><div className="image-workspace-heading"><h2>今天想创作什么？</h2><p>写下画面，或使用游戏内容工作室带来的提示词。</p></div>{error&&<p role="alert" className="error-message">{error}<button className="choice" onClick={()=>void reload()}>重试加载</button></p>}<label className="image-model-picker">图片模型<select value={model} onChange={e=>onModelChange?.(e.target.value)}>{getImageModelOptions(provider).length?getImageModelOptions(provider).map(option=><option key={option.value} value={option.value}>{option.label}</option>):<option value={model}>{model}</option>}</select></label><ContentImageEditor provider={provider} model={model} endpoint={endpoint} api={api} targets={targets} initial={initial} onSaved={reload}/></div>
}
