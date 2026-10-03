import test from 'node:test'
import assert from 'node:assert/strict'
import {archiveCatalog,loadArchiveImages} from '../src/content/archiveCatalog.mjs'
test('independent images and unknown legacy records stay separate from six content types',()=>{
 const archives=[{id:'tree',name:'古树',category:'character',worldId:'w',imageCount:1,promptCount:1},{id:'free',name:'手写图',profile:{category:'unknown',origin:'manual'},imageCount:2},{id:'old',name:'旧资料',profile:{},imageCount:0}]
 const sessions={blank:{id:'blank',kind:'prop',messages:[],input:'',name:'',status:'draft'},draft:{id:'draft',kind:'scene',messages:[{role:'user',content:'暮色下的山谷'}],status:'draft'},tree:{id:'tree',kind:'character',name:'古树修改',status:'dirty',messages:[]}}
 const result=archiveCatalog({archives,worlds:[{id:'w',name:'世界',profile:{summary:'森林'}}],sessions})
 assert.equal(result.contents.length,2);assert.equal(result.unorganized.length,1);assert.equal(result.independent.length,1)
 assert.equal(result.drafts.length,2);assert.match(result.drafts.find(d=>d.id==='draft').label,/山谷/)
 const scoped=archiveCatalog({archives,worlds:[],sessions,filters:{worldId:'w',query:'古树',category:'character',status:'image'}})
 assert.equal(scoped.contents.length,1);assert.equal(scoped.counts.character,1)
})
test('image listing deduplicates ids and reports partial detail failure',async()=>{
 const api={getRemoteArchive:async id=>{if(id==='bad')throw Error('无法读取');return {archive:{id,name:id},prompts:[],images:[{id:'shared'}]}}}
 const result=await loadArchiveImages([{id:'a'},{id:'b'},{id:'bad'}],api)
 assert.equal(result.images.length,1);assert.equal(result.errors.length,1);assert.equal(result.errors[0].id,'bad')
})
