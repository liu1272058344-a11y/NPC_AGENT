export function captureImageRequest(input,idFactory=()=>crypto.randomUUID()) {
 if(typeof input.prompt !== 'string' || !input.prompt.trim()) throw new Error('请填写生图提示词。')
 return structuredClone({requestId:idFactory(),prompt:input.prompt,negativePrompt:input.negativePrompt || '',provider:input.provider,model:input.model,parameters:input.parameters || {},source:input.source || null,mode:input.mode || 'manual'})
}
export function imageSavePayload(result,target=null,name='自由创作') {
 const request=result.requestSnapshot
 const archive=target || {id:`image:${request.requestId}`,name:name.trim() || '自由创作',summary:request.prompt.slice(0,120),profile:{category:request.source?.category || 'unknown',worldId:'',origin:'manual'}}
 return {archive,sourceUrl:result.image.url,idempotencyKey:`content-image:${request.requestId}`,prompt:{id:`image-prompt:${request.requestId}:${archive.id}`,prompt:request.prompt,negativePrompt:request.negativePrompt,provider:request.provider,modelId:request.model,snapshot:{...request,size:result.image.size}},provider:request.provider,modelId:request.model}
}
