import test from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from '../server.mjs'
test('local development serves the same session route used by the content UI',async()=>{
 const server=startServer(0);await new Promise(resolve=>server.once('listening',resolve))
 try {const response=await fetch(`http://localhost:${server.address().port}/api/internal-beta/session`);assert.equal(response.status,200);assert.equal((await response.json()).authenticated,true)}finally{server.close()}
})
test('local development preserves the legacy pipeline asset route without a workspace header',async()=>{
 const server=startServer(0);await new Promise(resolve=>server.once('listening',resolve))
 try {const response=await fetch(`http://localhost:${server.address().port}/api/assets`);assert.equal(response.status,200);assert.ok(Array.isArray((await response.json()).assets))}finally{server.close()}
})
