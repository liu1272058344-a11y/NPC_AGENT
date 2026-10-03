import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssetService } from '../src/server/assets/assetService.mjs'
import { createAssetDatabase } from '../src/server/assets/database.mjs'

test('archive listing includes category, world and prompt history counts', async () => {
  const service = createAssetService({ db:{ workspaceExists:async()=>true, listArchives:async()=>[{ id:'map-1', name:'旧城区', profile_json:{ category:'map', worldId:'world-1', tags:['城区'] }, prompt_count:2, image_count:1, updated_at:'2026-10-02' }], getWorkspaceUsage:async()=>({}) }, blob:{} })
  const {archives} = await service.listArchiveSummaries('w')
  assert.equal(archives[0].category,'map')
  assert.equal(archives[0].worldId,'world-1')
  assert.equal(archives[0].promptCount,2)
})
test('saving a repeated prompt never overwrites original snapshot', async () => {
  let sql
  const db=createAssetDatabase(async text=>{sql=text;return {rows:[{id:'p'}]}})
  await db.insertPrompt('w','a',{ id:'p',prompt:'original',promptZh:'中文',snapshot:{category:'map'} })
  assert.doesNotMatch(sql,/DO UPDATE SET prompt=/)
  assert.match(sql,/snapshot_json/)
})
test('metadata edits preserve existing design and verify related items', async () => {
  let saved
  const db={ getArchiveDetail:async(_w,id)=>id==='a'?{archive:{id:'a',name:'旧',profile_json:{category:'map',design:{summary:'原始设计'}}}}:null,
    upsertArchive:async(_w,a)=>{saved=a;return a} }
  const service=createAssetService({db,blob:{}})
  await service.updateArchiveMetadata('w','a',{name:'新',category:'scene',tags:['夜景']})
  assert.deepEqual(saved.profile.design,{summary:'原始设计'})
  await assert.rejects(service.updateArchiveMetadata('w','a',{relatedIds:['missing']}), {statusCode:400})
})
