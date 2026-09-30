export interface NPC {
  id: string
  name: string
  role: string
  world: string
  function: string
  personality: string[]
  background: string
  summary: string
  goal: string
  speechStyle: string
  behaviorRules: string[]
  sourcePrompt: string
}

export interface WorldProfile {
  name: string
  genre: string
  era: string
  atmosphere: string
  coreRule: string
  centralConflict: string
  summary: string
}

export interface GameContentProfile {
  id: string
  name: string
  source: 'agent' | 'manual'
  world?: WorldProfile
  npc?: NPC
  notes?: string
}

export interface ArtAssetPrompt {
  type: string
  style: string
  objects: string[]
  composition: string
  palette: string
  lighting: string
  details: string[]
  format: string
  aspectRatio: string
  promptZh: string
  promptEn: string
  negativePrompt: string
}

export interface GeneratedImageAsset {
  id: string
  url: string
  model: string
  size: string
  prompt: string
  negativePrompt: string
  type: string
  sourceId: string
  createdAt: string
}

export interface NPCDraft {
  worldOptions: string[]
  roleOptions: string[]
  functionOptions: string[]
  personalityOptions: string[]
  selectedWorld?: string
  selectedRole?: string
  selectedFunction?: string
  selectedPersonality?: string[]
}

/** Internal quality review contract. Never send this object to the frontend. */
export interface ReviewResult {
  approved: boolean
  issues: string[]
  suggestions: string[]
  score?: number
}
