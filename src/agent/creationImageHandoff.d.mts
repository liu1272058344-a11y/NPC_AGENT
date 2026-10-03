import type { ArtAssetPrompt, NPC, WorldProfile } from '../types/npc'
export interface CreationImageHandoff { asset:ArtAssetPrompt;archive:{id:string;name:string;summary:string;profile:Record<string,unknown>} }
export function buildWorldImageHandoff(world:WorldProfile,options?:{linkWorld?:boolean}):CreationImageHandoff
export function buildCharacterImageHandoff(npc:NPC,world?:WorldProfile|null,options?:{linkWorld?:boolean}):CreationImageHandoff
