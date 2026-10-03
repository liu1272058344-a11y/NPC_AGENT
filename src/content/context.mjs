const revision = value => value?.revision || 1
export function buildContentContext({world,item={},overrides={}}) {
 const fields = {...(item.design?.fields || {}),...(item.fields || {})}
 const conflicts = Object.entries(overrides).filter(([key,value])=>world?.[key] && world[key] !== value).map(([field,value])=>({field,inherited:world[field],override:value}))
 const confirmed = {world:world || null,fields:Object.fromEntries(Object.entries(fields).filter(([,value])=>value && value !== '待完善')),visualBrief:item.visualBrief || '',visualDirection:world?.visualDirection || '',...overrides}
 const source = {worldId:world?.id || item.worldId || '',worldRevision:world ? revision(world) : null,itemId:item.id || item.itemId,itemRevision:revision(item),unavailable:!!item.worldId && !world}
 const pending = [...new Set([...Object.keys(fields).filter(key=>!fields[key] || fields[key]==='待完善'),...Object.keys(item.fieldStatus || {}).filter(key=>item.fieldStatus[key]==='pending')])]
 return {source,confirmed,pending,conflicts}
}
export function isPromptStale(snapshot,world,item) {
 if (!snapshot) return false
 const source=snapshot.source || snapshot
 return source.itemId !== item?.id || source.itemRevision !== revision(item) || (source.worldId || '') !== (world?.id || item?.worldId || '') || (source.worldId && (!world || source.worldRevision !== revision(world)))
}
