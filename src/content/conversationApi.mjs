export async function requestConversationTurn(session,{provider,model,world,requestId,signal,fetchImpl=fetch}){
 session=structuredClone(session)
 world=world ? structuredClone(world) : undefined
 const messages=session.messages.map(({role,content})=>({role,content}))
 const intent=session.worldValue || session.design?'revise':'create'
 const body={phase:session.kind==='world'?'world':'content',provider,model,messages,intent,requestId,selectedCategoryId:session.kind,designId:session.id,sourceWorldId:session.worldId,world,...(session.kind==='world'?{currentWorld:session.worldValue}:{contentProfile:{category:session.kind,itemId:session.id,name:session.name,revision:session.revision,worldId:session.worldId,design:session.design?.fields,currentDesign:{...session.design,legacyProfile:session.originalProfile},currentAsset:session.asset,visualBrief:session.visualBrief,overrides:session.overrides,intent}})}
 const response=await fetchImpl('/api/npc',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal})
 let result
 try{result=await response.json()}catch{throw Object.assign(new Error('生成服务返回的 JSON 格式异常，请重试。'),{code:'INVALID_JSON',requestId})}
 if(!response.ok)throw Object.assign(new Error(result.message || result.error?.message || '生成失败，请重试。'),{code:result.code || result.error?.code || 'API_ERROR',requestId})
 if(result.requestId!==requestId)throw Object.assign(new Error('已忽略过期的生成响应。'),{code:'STALE_REQUEST'})
 if((result.itemId&&result.itemId!==session.id)||(result.category&&result.category!==session.kind))throw Object.assign(new Error('生成结果与当前会话不一致，请重试。'),{code:result.category&&result.category!==session.kind?'CATEGORY_MISMATCH':'INVALID_MODEL_RESPONSE'})
 if(result.status!=='needs_clarification' && (session.kind==='world'?!result.world:result.itemId!==session.id || result.category!==session.kind || !result.design || !result.asset))throw new Error('生成结果与当前会话不一致，请重试。')
 return result
}
