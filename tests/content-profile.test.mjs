import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeContentProfile } from '../src/content/profile.mjs'
import { worldSchema } from '../src/server/contracts.mjs'
test('legacy character keeps identity and facts without inventing entity kind',()=>{
 const value=normalizeContentProfile({id:'rock',name:'回声石',personality:['沉默'],background:'守着入口'})
 assert.equal(value.id,'rock');assert.equal(value.category,'character');assert.equal(value.entityKind,undefined);assert.equal(value.fields.background,'守着入口');assert.equal(value.fields.equipment,undefined)
})
test('nonhuman content accepts inapplicable fields and keeps pending information',()=>{
 const value=normalizeContentProfile({id:'tree',category:'character',name:'古树',entityKind:'plant',fields:{appearance:'树冠宽大'},fieldStatus:{goal:'pending'}})
 assert.equal(value.entityKind,'plant');assert.equal(value.fields.speechStyle,undefined);assert.equal(value.fieldStatus.goal,'pending');assert.equal(value.revision,1)
})
test('world preserves optional visual direction and accepts old records',()=>{
 const world={name:'森林',genre:'探索',era:'远古',atmosphere:'静谧',coreRule:'树能记忆',centralConflict:'生态衰退',summary:'森林世界'}
 assert.equal(worldSchema.safeParse(world).success,true)
 const result=worldSchema.parse({...world,id:'w1',revision:2,visualDirection:'水彩、苔藓与石材'})
 assert.equal(result.visualDirection,'水彩、苔藓与石材');assert.equal(result.revision,2)
})
