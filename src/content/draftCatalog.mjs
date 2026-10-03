export function draftCatalog(drafts){
 const values=Object.values(drafts)
 return {named:values.filter(d=>d.name?.trim()),recoverable:values.filter(d=>!d.name?.trim()&&(d.requirements?.trim()||Object.values(d.fields||{}).some(v=>String(v).trim())||d.asset||d.design))}
}
