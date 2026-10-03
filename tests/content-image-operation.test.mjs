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
