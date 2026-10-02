const text=value=>typeof value==='string'?value.trim():''
const list=value=>Array.isArray(value)?value.map(text).filter(Boolean):[]
const stableHash=value=>{let hash=2166136261;for(const character of value){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(36)}
const negativePrompt='low quality, low resolution, blurry, deformed anatomy, malformed hands, extra fingers, duplicate subject, cropped, text, logo, watermark, UI, frame'
const genreEnglish=value=>/废土|末日|灾后/.test(value)?'post-apocalyptic survival':value

export const buildWorldImageHandoff=(world,{linkWorld=true}={})=>{
 const persistedId=linkWorld?text(world?.id):'',name=text(world?.name)||'未命名世界',genre=text(world?.genre),era=text(world?.era),atmosphere=text(world?.atmosphere),rule=text(world?.coreRule),conflict=text(world?.centralConflict),summary=text(world?.summary)
 const id=persistedId
 const archiveId=`world-visual:${id||`local-${stableHash(JSON.stringify(world||{}))}`}`
 const promptEn=`cinematic environment concept art for a ${genreEnglish(genre)} game world, ${name}, ${era}, ${atmosphere} atmosphere, visual storytelling centered on ${rule}, environmental signs of ${conflict}, ${summary}, expansive establishing shot, strong foreground midground and background separation, production design sheet quality, highly detailed game art, coherent architecture and props, dramatic natural lighting, no main character`
 return {asset:{type:'世界场景概念图',style:'cinematic game environment concept art',objects:[name,rule,conflict].filter(Boolean),composition:'expansive establishing shot with clear foreground, midground and background',palette:atmosphere||'cohesive world palette',lighting:'dramatic environmental lighting',details:[era,summary].filter(Boolean),format:'digital concept art',aspectRatio:'16:9',promptZh:`${name}世界场景概念图，${genre}，${era}，${atmosphere}，核心规则：${rule}，核心冲突：${conflict}。${summary}`,promptEn,negativePrompt},archive:{id:archiveId,name:`${name} · 场景概念图`,summary,profile:{category:'scene',worldId:id,world:{...world,id:id||undefined},sourceKind:'world'}}}
}

export const buildCharacterImageHandoff=(npc,world=null,{linkWorld=true}={})=>{
 const id=text(npc?.id)||`local-${stableHash(JSON.stringify(npc||{}))}`,name=text(npc?.name)||'未命名角色',role=text(npc?.role),personality=list(npc?.personality),background=text(npc?.background),summary=text(npc?.summary),worldName=text(npc?.world)||text(world?.name),atmosphere=text(world?.atmosphere),era=text(world?.era)
 const promptEn=`full-body character concept art, ${name}, ${role}, from ${worldName}, ${summary}, personality: ${personality.join(', ')}, visual backstory: ${background}, ${era} setting, ${atmosphere} atmosphere, distinctive silhouette, practical layered costume and role-specific equipment, front three-quarter view, neutral readable pose, professional game character design, highly detailed, coherent materials, cinematic studio lighting, plain unobtrusive background`
 return {asset:{type:'角色立绘',style:'professional full-body game character concept art',objects:[name,role,...personality].filter(Boolean),composition:'full body, front three-quarter view, readable silhouette',palette:atmosphere||'cohesive character palette',lighting:'cinematic studio lighting',details:[background,text(npc?.goal)].filter(Boolean),format:'digital character concept art',aspectRatio:'3:4',promptZh:`${name}全身角色立绘，身份：${role}，所属世界：${worldName}，性格：${personality.join('、')}。${summary}。${background}`,promptEn,negativePrompt},archive:{id,name,summary,profile:{...npc,id,category:'character',worldId:linkWorld?text(world?.id):'',world:linkWorld?world||null:null,sourceKind:'character'}}}
}
