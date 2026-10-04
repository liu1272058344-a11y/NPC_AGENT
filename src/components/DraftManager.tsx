import {useState} from 'react'
import type {ConversationSession} from '../content/conversationSession.mjs'
import {contentCategories,libraryCategoryLabel} from '../content/categories.mjs'
import {draftList,isEmptyDraft} from '../content/draftManagement.mjs'

type Props={sessions:Record<string,ConversationSession>;busy:boolean;onRemove:(ids:string[])=>void;onRename:(id:string,name:string)=>void;onOpen:(id:string)=>void;onClose:()=>void}
function DraftRow({session,busy,checked,onCheck,onRename,onOpen,onRemove}: {session:ConversationSession;busy:boolean;checked:boolean;onCheck:()=>void;onRename:(name:string)=>void;onOpen:()=>void;onRemove:()=>void}){
 const [editing,setEditing]=useState(false),[name,setName]=useState(session.name)
 const label=session.name || `${libraryCategoryLabel(session.kind)} · 未命名草稿`,blocked=busy || !!session.pendingRequest
 return <article className="draft-row">
  <label className="draft-checkbox"><input type="checkbox" aria-label={`选择${label}`} checked={checked} disabled={blocked} onChange={onCheck}/></label>
  <div className="draft-row-content"><small>{libraryCategoryLabel(session.kind)} · {session.pendingRequest?'正在生成':session.status==='dirty'?'已保存档案 · 本地有修改':isEmptyDraft(session)?'空白草稿':'未保存草稿'}</small>
   {editing?<form className="draft-rename" onSubmit={e=>{e.preventDefault();if(name.trim()){onRename(name);setEditing(false)}}}><input autoFocus aria-label="草稿名称" value={name} onChange={e=>setName(e.target.value)} maxLength={120}/><button className="choice" disabled={blocked || !name.trim()}>确定</button><button type="button" className="choice" onClick={()=>setEditing(false)}>取消</button></form>:<h3>{label}</h3>}
   <p>{session.design?.summary || session.worldValue?.summary || session.input || session.messages.findLast(m=>m.role==='user')?.content || '尚未填写内容'}</p>
   <span className="section-hint">更新于 {new Date(session.updatedAt).toLocaleString('zh-CN')}</span>
  </div>
  <div className="draft-row-actions"><button className="choice" onClick={onOpen}>继续设计</button><button className="choice" disabled={blocked} onClick={()=>{setName(session.name);setEditing(true)}}>重命名</button><button className="choice danger-choice" disabled={blocked} onClick={onRemove}>{session.status==='dirty'?'丢弃本地修改':'删除'}</button></div>
 </article>
}
export function DraftManager({sessions,busy,onRemove,onRename,onOpen,onClose}:Props){
 const [query,setQuery]=useState(''),[kind,setKind]=useState(''),[selected,setSelected]=useState<string[]>([]),[pendingRemoval,setPendingRemoval]=useState<string[]>([])
 const all=draftList(sessions),rows=draftList(sessions,{query,kind}),ids=selected.filter(id=>sessions[id]&&sessions[id].status!=='saved'&&!sessions[id].pendingRequest)
 const empty=all.filter(isEmptyDraft),available=rows.filter(s=>!s.pendingRequest),allChecked=available.length>0&&available.every(s=>ids.includes(s.id))
 const remove=(targets:string[])=>{if(targets.length)setPendingRemoval(targets)}
 return <section className="panel draft-manager" aria-labelledby="draft-manager-title">
  <div className="builder-heading"><div><h2 id="draft-manager-title">管理草稿 <small>({all.length})</small></h2><p>包含空白草稿和未保存修改。这里只管理本地设计，已保存档案在工作室中管理。</p></div><button className="choice" onClick={onClose}>关闭管理</button></div>
  <div className="draft-filters"><label>搜索草稿<input aria-label="搜索草稿" placeholder="名称或对话内容" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>内容类型<select aria-label="筛选草稿类型" value={kind} onChange={e=>setKind(e.target.value)}><option value="">全部类型</option><option value="world">世界观</option>{Object.entries(contentCategories).map(([id,value])=><option key={id} value={id}>{value.label}</option>)}<option value="unknown">待分类</option></select></label></div>
  <div className="draft-batch-actions"><label className="draft-checkbox"><input type="checkbox" aria-label="选择当前列表全部草稿" checked={allChecked} disabled={busy || !available.length} onChange={()=>setSelected(allChecked?ids.filter(id=>!available.some(s=>s.id===id)):[...new Set([...ids,...available.map(s=>s.id)])])}/>选择当前列表</label><button className="choice danger-choice" disabled={busy || !ids.length} onClick={()=>remove(ids)}>删除所选 ({ids.length})</button><button className="choice" disabled={busy || !empty.length} onClick={()=>{onRemove(empty.map(s=>s.id));setSelected([])}}>清理全部空白草稿 ({empty.length})</button><span className="section-hint">显示 {rows.length} / {all.length} 项</span></div>
  {pendingRemoval.length>0&&<div className="draft-delete-confirm" role="alert"><p>确定移除 {pendingRemoval.length} 项本地设计？{pendingRemoval.some(id=>sessions[id]?.status==='dirty')?'所选项目包含未保存修改。':''}云端已保存档案保留，移除后可以撤销。</p><div className="draft-batch-actions"><button className="choice danger-choice" disabled={busy} onClick={()=>{onRemove(pendingRemoval);setPendingRemoval([]);setSelected([])}}>确认删除</button><button className="choice" onClick={()=>setPendingRemoval([])}>取消删除</button></div></div>}
  <div className="draft-list">{rows.map(s=><DraftRow key={s.id} session={s} busy={busy} checked={ids.includes(s.id)} onCheck={()=>setSelected(ids.includes(s.id)?ids.filter(id=>id!==s.id):[...ids,s.id])} onRename={name=>onRename(s.id,name)} onOpen={()=>onOpen(s.id)} onRemove={()=>remove([s.id])}/>)}</div>
  {!rows.length&&<p>{all.length?'没有符合筛选的草稿。':'没有未保存的草稿，可以新建设计。'}</p>}
 </section>
}
