import {classifyLegacyAsset,libraryCategoryLabel} from './categories.mjs'
export const isIndependentImage=row=>row.profile?.origin==='manual'&&!row.profile?.design&&!row.profile?.worldId&&!row.worldId
const matches=(row,filters)=> (!filters.worldId||(row.worldId || 'independent')===filters.worldId)&&(!filters.category||row.category===filters.category)&&(!filters.status||row.state===filters.status)&&(!(filters.query || '').trim()||[row.name,row.summary,...(row.tags || [])].join(' ').toLowerCase().includes(filters.query.trim().toLowerCase()))
export function archiveCatalog({archives=[],worlds=[],sessions={},filters={}}){
 const independent=archives.filter(isIndependentImage),unorganized=archives.filter(a=>!isIndependentImage(a)&&classifyLegacyAsset(a)==='unknown')
 const all=[...worlds.map(w=>({...w,category:'world',worldId:w.id,summary:w.profile.summary || '',imageCount:0,promptCount:0,state:'design'})),...archives.filter(a=>!isIndependentImage(a)&&classifyLegacyAsset(a)!=='unknown').map(a=>({...a,category:classifyLegacyAsset(a),worldId:a.worldId || a.profile?.worldId || '',tags:a.tags || a.profile?.tags || [],state:a.imageCount>0?'image':a.promptCount>0?'prompt':'design'}))]
 const counts=Object.fromEntries(['world','character','map','scene','prop','clothing'].map(type=>[type,all.filter(a=>matches(a,{...filters,category:type})).length]))
 const contents=all.filter(a=>matches(a,filters)).sort((a,b)=>String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
 const drafts=Object.values(sessions).filter(s=>s.status!=='saved'&&(s.name||s.input?.trim()||s.messages?.length||s.design||s.asset||s.worldValue)).map(s=>({...s,label:s.name || `${libraryCategoryLabel(s.kind)}草稿 · ${(s.input || s.messages?.findLast(m=>m.role==='user')?.content || s.design?.summary || '').slice(0,36)}`,category:s.kind,state:s.asset?'prompt':'design'})).filter(s=>matches(s,filters)).sort((a,b)=>String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
 return {contents,counts,drafts,independent:independent.filter(a=>matches({...a,category:'unknown',state:a.imageCount>0?'image':'prompt'},filters)),unorganized:unorganized.filter(a=>matches({...a,category:'unknown',state:a.imageCount>0?'image':a.promptCount>0?'prompt':'design'},filters))}
}
export async function loadArchiveImages(archives,api){
 const images=[],errors=[],seen=new Set();let cursor=0
 await Promise.all(Array.from({length:Math.min(4,archives.length)},async()=>{while(cursor<archives.length){const archive=archives[cursor++];try{const detail=await api.getRemoteArchive(archive.id);for(const image of detail.images || [])if(!seen.has(image.id)){seen.add(image.id);images.push({...image,archive:detail.archive,prompt:detail.prompts.find(p=>p.id===image.promptRecordId)})}}catch(e){errors.push({id:archive.id,message:e.message || '加载失败'})}}}))
 return {images:images.sort((a,b)=>String(b.createdAt || '').localeCompare(String(a.createdAt || ''))),errors}
}
