import test from 'node:test'
import assert from 'node:assert/strict'
import { captureImageRequest, imageSavePayload } from '../src/content/imageRequest.mjs'
test('manual image input needs no archive and sends literal text without added style',()=>{
 const request=captureImageRequest({prompt:'一棵蓝色的树',negativePrompt:'',provider:'p',model:'m',parameters:{size:'1024'},mode:'manual'},()=> 'r1')
 assert.equal(request.prompt,'一棵蓝色的树');assert.equal(request.source,null);assert.equal(request.mode,'manual')
 assert.throws(()=>captureImageRequest({prompt:'  '}),/填写/)
})
test('image save uses generation snapshot after inputs and target selection change',()=>{
 const source={itemId:'old',worldId:'w1',design:{appearance:'古树'}}
 const request=captureImageRequest({prompt:'tree',negativePrompt:'blurry',provider:'p',model:'m',source,mode:'edited'},()=> 'r2')
 source.design.appearance='changed'
 const payload=imageSavePayload({image:{url:'https://example.test/tree.png',size:'1024'},requestSnapshot:request},null,'独立树图')
 assert.equal(payload.prompt.prompt,'tree');assert.equal(payload.prompt.snapshot.source.design.appearance,'古树');assert.equal(payload.archive.profile.worldId,'');assert.equal(payload.provider,'p');assert.equal(payload.idempotencyKey,'content-image:r2')
 const linked=imageSavePayload({image:{url:'https://example.test/tree.png'},requestSnapshot:request},{id:'new',name:'新条目',profile:{category:'prop',worldId:'w2'}})
 assert.equal(linked.archive.id,'new');assert.equal(linked.prompt.snapshot.source.itemId,'old');assert.equal(linked.prompt.id,'image-prompt:r2:new')
})
