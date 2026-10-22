import test from 'node:test'
import assert from 'node:assert/strict'
import { geminiConfig } from '../src/server/geminiConfig.mjs'
test('Gemini requires a server key and uses documented default model',()=>{
 assert.throws(()=>geminiConfig(undefined,{}),{code:'CONFIGURATION_ERROR'})
 assert.deepEqual(geminiConfig(undefined,{GEMINI_API_KEY:'secret'}),{provider:'gemini',key:'secret',model:'gemini-4-argon'})
 assert.equal(geminiConfig('deepseek-chat',{GEMINI_API_KEY:'secret',GEMINI_MODEL:'gemini-4-argon'}).model,'gemini-4-argon')
 assert.equal(geminiConfig('gemini-3.8-flash',{GEMINI_API_KEY:'secret'}).model,'gemini-3.8-flash')
})
