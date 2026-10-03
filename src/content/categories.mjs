export const contentCategories = Object.freeze({
 clothing: {label:'服饰',fields:{purpose:'用途',wearer:'适用对象',structure:'结构与轮廓',materials:'材质',palette:'色彩',presentation:'展示要求'},focus:'设计服饰与穿戴物。适用对象可以是非人实体，也可以无人展示，不强制人类模特。保留功能、结构、材质与展示要求。'},
  character: { label:'角色', fields:{ identity:'身份与玩法职责', entityKind:'实体类别（人、动物、植物、石头、机械等）', appearance:'外形与视觉特征', expression:'表达与交互方式（可不说话）', behavior:'行为与性格', equipment:'装备或附属物（适用时填写）', background:'背景与目标' }, focus:'角色可以是人、动物、植物、石头或机械，按游戏用途定义，不默认添加人类服装、武器或语言。不适用字段省略，未知字段不要编造。明确主体身份、行为与轮廓，环境服务于角色。黑客身份应体现操作和工具，避免无依据地强化战术特工特征。' },
  map: { label:'地图', fields:{ scale:'尺度与观察视角', regions:'区域与功能区', landmarks:'地标', connections:'道路与区域连接', routes:'入口出口与玩法动线' }, focus:'优先表达区域、连通关系和动线。输出地图设计概念，不以人物立绘替代地图。视角遵守用户要求。' },
  scene: { label:'场景', fields:{ purpose:'地点用途', layout:'空间与建筑布局', interactions:'交互点', atmosphere:'时间天气与氛围', narrative:'叙事细节' }, focus:'突出空间布局、环境与交互用途。人物仅在用户需要时作为尺度或活动参照。' },
  prop: { label:'道具', fields:{ function:'用途与交互', shape:'形制与轮廓', materials:'材质与结构', scale:'尺寸与展示视角', condition:'状态与归属' }, focus:'突出物件的结构、材质、轮廓和功能。展示视角与背景应便于观察道具，避免生成以人物为中心的画面。' },
})
export const categoryLabel = category => contentCategories[category]?.label || '待分类'
export const libraryCategoryLabel = category => category === 'world' ? '世界观' : categoryLabel(category)
export function classifyLegacyAsset(record) {
  if (record.category === 'world') return 'world'
  if (contentCategories[record.category]) return record.category
  const profile = record.profile || record.profile_json || {}
  if (profile.category === 'world') return 'world'
  if (contentCategories[profile.category]) return profile.category
  if (profile.personality || record.personality) return 'character'
  const type = String(record.type || profile.type || '')
  if (/地图|关卡布局|\bmap\b/i.test(type)) return 'map'
  if (/道具|物件|武器|装备|\bprop\b|\bitem\b/i.test(type)) return 'prop'
  if (/场景|地点|环境|\bscene\b|environment|location/i.test(type)) return 'scene'
  if (/角色|立绘|三视图|表情|\bnpc\b|character/i.test(type)) return 'character'
  return 'unknown'
}
