import type { WorldProfile } from '../types/npc'
import type { ContentCategory } from './categories.mjs'
export function createContentHandoff(world:WorldProfile,category:ContentCategory,idFactory?:()=>string):{id:string;category:ContentCategory;name:string;requirements:string;worldId:string;worldSnapshot:WorldProfile;tags:string;fields:Record<string,string>;revision:number;visualBrief:string;dirty:boolean}
