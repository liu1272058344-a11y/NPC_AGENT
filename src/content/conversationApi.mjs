export async function requestConversationTurn(session,{provider,model,world,requestId,signal,fetchImpl=fetch}){
 const messages=session.messages.map(({role,content})=>({role,content}))
 const intent=session.worldValue || session.design?'revise':'create'
 const body={phase:session.kind==='world'?'world':'content',provider,model,messages,intent,requestId,world,...(session.kind==='world'?{currentWorld:session.worldValue}:{contentProfile:{category:session.kind,itemId:session.id,name:session.name,revision:session.revision,worldId:session.worldId,design:session.design?.fields,currentDesign:session.design,currentAsset:session.asset,visualBrief:session.visualBrief,overrides:session.overrides,intent}})}
 const response=await fetchImpl('/api/npc',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal})
 const result=await response.json().catch(()=>({}))
 if(!response.ok)throw new Error(result.message || result.error?.message || '生成失败，请重试。')
 if(result.status!=='needs_clarification' && (session.kind==='world'?!result.world:result.itemId!==session.id || result.category!==session.kind || !result.design || !result.asset))throw new Error('生成结果与当前会话不一致，请重试。')
 return result
}
