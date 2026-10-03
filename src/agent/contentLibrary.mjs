import { classifyLegacyAsset } from '../content/categories.mjs'
export function buildContentLibrary(archives, filters={}) {
 const all=archives.map(row=>({...row,category:classifyLegacyAsset(row),state:row.imageCount>0?'image':row.promptCount>0?'prompt':'design'}))
 const scoped=all.filter(row=>!filters.worldId || (row.worldId || 'independent')===filters.worldId)
 const counts=Object.fromEntries(['world','character','map','scene','prop','clothing','unknown'].map(category=>[category,scoped.filter(row=>row.category===category).length]))
 const query=(filters.query || '').trim().toLocaleLowerCase()
 const items=scoped.filter(row=>(!filters.category || row.category===filters.category) && (!filters.status || row.state===filters.status) && (!query || [row.name,row.summary,...(row.tags || [])].join(' ').toLocaleLowerCase().includes(query))).sort((a,b)=>String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
 return {items,counts}
}
export function applyGenerationResult(state,request,result) {
 if (state[request.itemId]?.requestId!==request.requestId) return state
 return {...state,[request.itemId]:{...state[request.itemId],...result,busy:false}}
}
