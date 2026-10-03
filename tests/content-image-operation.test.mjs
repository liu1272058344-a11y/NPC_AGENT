import test from 'node:test'
import assert from 'node:assert/strict'
import { canGenerateImage } from '../src/content/imageRequest.mjs'
test('another generation cannot replace the result while its save is pending',()=>{
 assert.equal(canGenerateImage({generating:false,saving:true,prompt:'tree'}),false)
 assert.equal(canGenerateImage({generating:false,saving:false,prompt:'tree'}),true)
 assert.equal(canGenerateImage({generating:true,saving:false,prompt:'tree'}),false)
})
