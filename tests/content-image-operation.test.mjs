import test from 'node:test'
import assert from 'node:assert/strict'
import { canGenerateImage } from '../src/content/imageRequest.mjs'
test('another generation cannot replace the result while its save is pending',()=>{
 assert.equal(canGenerateImage({generating:false,saving:true,prompt:'tree'}),false)
 assert.equal(canGenerateImage({generating:false,saving:false,prompt:'tree'}),true)
 assert.equal(canGenerateImage({generating:true,saving:false,prompt:'tree'}),false)
})
import {canSaveImage} from '../src/content/imageRequest.mjs'
test('saving requires an available result and valid explicit target',()=>{
 const base={generating:false,saving:false,saved:false,hasResult:true,targetId:'gone',targets:[]}
 assert.equal(canSaveImage(base),false)
 assert.equal(canSaveImage({...base,targetId:''}),true)
 assert.equal(canSaveImage({...base,targetId:'',generating:true}),false)
})
import {resolveImageTargets} from '../src/content/imageRequest.mjs'
test('accepted local target survives cancelled incoming handoff, deleted saved targets stay absent',()=>{
 const old={id:'a',name:'A',profile:{}},incoming={id:'b',name:'B',profile:{}}
 assert.deepEqual(resolveImageTargets([incoming],old,false).map(t=>t.id),['a','b'])
 assert.deepEqual(resolveImageTargets([],old,true),[])
 assert.equal(resolveImageTargets([{...old,name:'renamed'}],old,false)[0].name,'renamed')
})
