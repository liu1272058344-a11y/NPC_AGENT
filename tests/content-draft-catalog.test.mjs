import test from 'node:test'
import assert from 'node:assert/strict'
import {draftCatalog} from '../src/content/draftCatalog.mjs'
test('blank legacy drafts are hidden but meaningful drafts remain recoverable',()=>{
 const result=draftCatalog({empty:{id:'empty',name:'',fields:{}},old:{id:'old',name:'',requirements:'古树'},named:{id:'named',name:'记忆石'}})
 assert.deepEqual(result.named.map(d=>d.id),['named']);assert.deepEqual(result.recoverable.map(d=>d.id),['old'])
})
