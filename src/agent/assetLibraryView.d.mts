import type { ArtAssetPrompt, GeneratedImageAsset, NPC } from '../types/npc'

export type AssetLibraryEntry =
  | { id: string; kind: 'npc'; title: string; subtitle: string; detail: string }
  | { id: string; kind: 'prompt'; title: string; subtitle: string; detail: string; prompt: ArtAssetPrompt }
  | { id: string; kind: 'image'; title: string; subtitle: string; detail: string; image: GeneratedImageAsset }

export function createGeneratedImageAsset(input: Omit<GeneratedImageAsset, 'id' | 'createdAt'>, id?: string): GeneratedImageAsset
export function buildAssetLibraryEntries(npc: NPC | null, prompts: ArtAssetPrompt[], images?: GeneratedImageAsset[]): AssetLibraryEntry[]
export type AssetLibraryDetail =
  | { kind: 'npc'; npc: NPC; prompts: ArtAssetPrompt[] }
  | { kind: 'prompt'; prompt: ArtAssetPrompt }
  | { kind: 'image'; image: GeneratedImageAsset }

export function buildAssetLibraryDetail(entryId: string, npc: NPC | null, prompts: ArtAssetPrompt[], images?: GeneratedImageAsset[]): AssetLibraryDetail | null
