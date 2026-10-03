import test from 'node:test'
import assert from 'node:assert/strict'
import {studioNavigation,resolveStudioPage} from '../src/content/studioNavigation.mjs'
test('one image destination and a general content studio',()=>{
 assert.equal(studioNavigation.some(n=>n.id==='Visual Production'),false)
 assert.equal(studioNavigation.find(n=>n.id==='Character Studio').label,'游戏内容工作室')
 assert.equal(resolveStudioPage('Image Generation'),'images');assert.equal(resolveStudioPage('Visual Production'),'studio')
})
test('gameplay and world creation share one conversational builder',()=>{
 assert.equal(studioNavigation.some(n=>n.id==='Game Design'),false)
 assert.equal(studioNavigation.find(n=>n.id==='World Builder').label,'游戏内容构建')
 assert.equal(resolveStudioPage('World Builder'),'builder')
 assert.equal(resolveStudioPage('Game Design'),'builder')
})
