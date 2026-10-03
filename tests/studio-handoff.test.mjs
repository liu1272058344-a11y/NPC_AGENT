import test from 'node:test'
import assert from 'node:assert/strict'
import {createStudioHandoff,receiveStudioHandoff} from '../src/content/studioHandoff.mjs'
test('handoff preserves exact text and refuses blanks',()=>{assert.equal(createStudioHandoff({prompt:'  古树\n水彩  '}).prompt,'  古树\n水彩  ');assert.throws(()=>createStudioHandoff({prompt:'  '}))})
test('handoff is consumed once and replacement protects edits and results',()=>{
 const incoming=createStudioHandoff({prompt:'new'},()=> 'id')
 const state={prompt:'edited',consumedId:'id',dirty:true,hasUnsavedImage:true}
 assert.equal(receiveStudioHandoff(state,incoming).state,state)
 const next={...incoming,id:'next'}
 assert.equal(receiveStudioHandoff(state,next).needsDecision,true)
 assert.equal(receiveStudioHandoff(state,next,'cancel').state.prompt,'edited')
 const accepted=receiveStudioHandoff(state,next,'replace');assert.equal(accepted.state.prompt,'new');assert.equal(accepted.state.consumedId,'next')
 assert.equal(accepted.state.hasUnsavedImage,false)
})
test('incoming handoff waits while generation or save is in flight',()=>{const next=createStudioHandoff({prompt:'new'});assert.equal(receiveStudioHandoff({prompt:'old',generating:true},next).needsDecision,true);assert.equal(receiveStudioHandoff({prompt:'old',saving:true},next).needsDecision,true)})
