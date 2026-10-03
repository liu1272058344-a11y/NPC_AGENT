const rules = [
  ['角色三视图', /三视图|turnaround/i],
  ['表情动作表', /表情|动作表|expression|pose sheet/i],
  ['NPC立绘', /npc|角色.*立绘|立绘.*角色|character.*(?:portrait|full.?body)|full.?body.*character/i],
  ['地点设定图', /地点.*设定|location.*design/i],
  ['场景概念图', /场景|环境.*概念|concept art|environment.*art/i],
  ['角色道具', /角色.*道具|专属.*(?:道具|装备)|character.*(?:prop|equipment)/i],
  ['UI图标', /ui\s*图标|图标|\bicon\b/i],
  ['道具物件', /道具|物件|\bprop\b|object/i]
]

export const normalizeAssetType = (value) => {
  const source = String(value || '').trim()
  for (const [label, pattern] of rules) if (pattern.test(source)) return label
  return '其他美术资源'
}
