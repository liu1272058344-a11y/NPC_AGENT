export const buildAssetLibraryEntries = (npc, prompts) => {
  const entries = []
  if (npc) {
    entries.push({
      id: `npc:${npc.id || npc.name}`,
      kind: 'npc',
      title: npc.name,
      subtitle: `${npc.role} · ${npc.world}`,
      detail: '角色档案'
    })
  }
  for (const prompt of prompts) {
    entries.push({
      id: `prompt:${prompt.promptEn}`,
      kind: 'prompt',
      title: prompt.type,
      subtitle: prompt.style,
      detail: 'Prompt 档案 · Version 1',
      prompt
    })
  }
  return entries
}

export const buildAssetLibraryDetail = (entryId, npc, prompts) => {
  if (npc && entryId === `npc:${npc.id || npc.name}`) return { kind: 'npc', npc, prompts }
  const prompt = prompts.find((item) => entryId === `prompt:${item.promptEn}`)
  return prompt ? { kind: 'prompt', prompt } : null
}
