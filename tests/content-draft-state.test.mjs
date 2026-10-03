import test from 'node:test'
import assert from 'node:assert/strict'
import { draftLabel, transitionDraft, validateDraftName } from '../src/content/draftState.mjs'
test('draft identity and unsaved label reflect naming without changing association',()=>{
 assert.equal(draftLabel({category:'map',name:''}),'新地图（未保存）')
 assert.equal(draftLabel({category:'map',name:'港湾',saved:false}),'港湾（未保存）')
 assert.equal(validateDraftName('  ').valid,false)
})
test('switch decisions retain, restore or cancel edits using saved snapshot',()=>{
 const state={selected:'a',drafts:{a:{id:'a',category:'map',name:'新版',dirty:true,savedSnapshot:{id:'a',category:'map',name:'旧版',worldId:'w'}},b:{id:'b'}}}
 assert.equal(transitionDraft(state,{targetId:'b'}).needsDecision,true)
 assert.equal(transitionDraft(state,{targetId:'b',decision:'cancel'}).state.selected,'a')
 assert.equal(transitionDraft(state,{targetId:'b',decision:'keep'}).state.drafts.a.name,'新版')
 const discarded=transitionDraft(state,{targetId:'b',decision:'discard'}).state
 assert.equal(discarded.selected,'b');assert.equal(discarded.drafts.a.name,'旧版');assert.equal(discarded.drafts.a.worldId,'w')
})
