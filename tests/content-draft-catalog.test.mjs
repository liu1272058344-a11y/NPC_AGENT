import test from 'node:test'
import assert from 'node:assert/strict'
import {draftCatalog} from '../src/content/draftCatalog.mjs'
test('blank legacy drafts are hidden but meaningful drafts remain recoverable',()=>{
 const result=draftCatalog({empty:{id:'empty',name:'',fields:{}},old:{id:'old',name:'',requirements:'古树'},named:{id:'named',name:'记忆石'}})
 assert.deepEqual(result.named.map(d=>d.id),['named']);assert.deepEqual(result.recoverable.map(d=>d.id),['old'])
})
import {existingDesignDraft} from '../src/content/draftCatalog.mjs'
test('reentering legacy visual design preserves local edits and prompt',()=>{const edited={id:'npc',name:'古树',asset:{promptEn:'edited'},visualBrief:'蓝色'};assert.equal(existingDesignDraft({npc:edited},'npc'),edited)})
