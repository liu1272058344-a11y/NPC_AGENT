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
