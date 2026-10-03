import { contentCategories } from './categories.mjs'
export function createContentHandoff(world,category,idFactory=()=>crypto.randomUUID()) {
 if(!world?.id || !contentCategories[category]) throw new Error('请先确认世界并选择内容类别。')
 return {id:idFactory(),category,name:'',requirements:'',worldId:world.id,worldSnapshot:{...world},tags:'',fields:{},revision:1,visualBrief:'',dirty:false}
}
