
console.info('Smart Task Flow kanban-renderer.js v20260626-final-stable loaded');

function getKanbanColumns(){
  return [
    {key:'PENDING',title:'대기',hint:'대기/준비 업무',color:'amber'},
    {key:'PROGRESS',title:'진행 중',hint:'진행 중 업무',color:'blue'},
    {key:'CLOSING',title:'집중 관리',hint:'High/Risk 집중',color:'rose'},
    {key:'COMPLETED',title:'완료',hint:'완료 업무',color:'emerald'}
  ];
}
function getKanbanBucket(t,today){
  const s=normalizeStatus(t.status);
  const r=getTaskRiskInfo(t,today);
  if(s==='COMPLETED') return 'COMPLETED';
  if(t.priority==='HIGH'||['HIGH','CRITICAL'].includes(r.level)||isTaskOverdueEffective(t,today)) return 'CLOSING';
  if(s==='PROGRESS') return 'PROGRESS';
  return 'PENDING';
}
function kanbanTone(c){return{amber:'border-amber-100 bg-amber-50/50',blue:'border-blue-100 bg-blue-50/50',rose:'border-rose-100 bg-rose-50/60',emerald:'border-emerald-100 bg-emerald-50/50'}[c]||'border-slate-100 bg-slate-50';}
function kanbanBadge(c){return{amber:'bg-amber-100 text-amber-700',blue:'bg-blue-100 text-blue-700',rose:'bg-rose-100 text-rose-700',emerald:'bg-emerald-100 text-emerald-700'}[c]||'bg-slate-100 text-slate-700';}
function buildKanbanCard(t,today){
  const risk=getTaskRiskInfo(t,today);
  const eff=getEffectiveStatus(t,today);
  const pct=getTaskProgress(t);
  const subs=Array.isArray(t.subTasks)?t.subTasks:[];
  const done=subs.filter(st=>normalizeStatus(st.status)==='COMPLETED').length;
  const accent=['HIGH','CRITICAL'].includes(risk.level)?'border-rose-200':eff==='OVERDUE'?'border-amber-200':'border-slate-100';
  const labelAssignee = Array.isArray(t.assignee) ? t.assignee.join(', ') : (t.assignee || '미정');
  return `<article class="rounded-2xl border ${accent} bg-white p-3 shadow-sm">
    <div class="flex items-start justify-between gap-2">
      <button type="button" class="btn-edit min-w-0 text-left" data-id="${escapeHTML(t.id)}"><div class="line-clamp-2 text-sm font-black leading-snug text-slate-900">${escapeHTML(t.title||'')}</div></button>
      <input type="checkbox" class="cb-task mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" data-id="${escapeHTML(t.id)}" ${selectedTaskIds.has(t.id)?'checked':''}>
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
      <span class="rounded-full bg-slate-50 px-2 py-1 text-slate-500">👤 ${escapeHTML(labelAssignee)}</span>
      <span class="rounded-full bg-slate-50 px-2 py-1 text-slate-500">📅 ${(t.dueDate||'').substring(5)||'미정'}</span>
      <span class="rounded-full ${(t.priority==='HIGH')?'bg-rose-50 text-rose-700':'bg-amber-50 text-amber-700'} px-2 py-1">${t.priority==='HIGH'?'높음':'보통'}</span>
    </div>
    <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div class="h-full ${eff==='COMPLETED'?'bg-emerald-500':eff==='PROGRESS'?'bg-blue-500':'bg-amber-400'}" style="width:${pct}%"></div></div>
    <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400">
      <span>진척 ${pct}%</span>
      ${subs.length > 0 ? `
        <button type="button" class="btn-toggle-kanban-subs flex items-center gap-1 hover:text-indigo-650 transition-colors font-bold text-slate-500 cursor-pointer" data-id="${escapeHTML(t.id)}">
          <span>하위 ${done}/${subs.length}</span>
          <span class="toggle-icon inline-block transition-transform duration-200 text-[9px]">🔽</span>
        </button>
      ` : `<span>하위 0/0</span>`}
    </div>
    ${subs.length > 0 ? `
      <div id="kanban-subs-${escapeHTML(t.id)}" class="kanban-subtasks-container hidden mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
        ${subs.map(st => {
          const status = normalizeStatus(st.status);
          const statusKorean = getStatusKorean(status);
          const assigneeNames = Array.isArray(st.assignee) ? st.assignee.join(', ') : (st.assignee || '미정');
          
          let statusClass = '';
          let textClass = 'text-slate-700 dark:text-slate-350';
          if (status === 'COMPLETED') {
              statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50';
              textClass = 'text-slate-400 line-through dark:text-slate-500';
          } else if (status === 'PROGRESS') {
              statusClass = 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50';
          } else {
              statusClass = 'bg-slate-50 text-slate-650 border-slate-200 dark:bg-slate-850 dark:text-slate-300 dark:border-slate-800';
          }
          
          return `
            <div class="text-[9px] flex flex-col gap-1 p-1.5 rounded bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100/50 dark:border-slate-800/50">
              <div class="flex items-center justify-between gap-1.5">
                <span class="truncate ${textClass} font-semibold">${escapeHTML(st.title)}</span>
                <span class="shrink-0 px-1 py-0.2 rounded text-[7.5px] font-bold border ${statusClass}">
                  ${statusKorean}
                </span>
              </div>
              <div class="flex items-center justify-between text-[8px] text-slate-450 dark:text-slate-500">
                <span class="truncate">👤 ${escapeHTML(assigneeNames)}</span>
                <span class="shrink-0">
                  ${st.dueDate ? '📅 ' + st.dueDate.substring(5) : ''}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : ''}
    ${risk.level!=='NONE'?`<div class="mt-2 rounded-xl border border-rose-100 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">🚨 ${risk.label} D+${risk.delay}</div>`:''}
    <div class="mt-3 grid grid-cols-3 gap-1">
      <button type="button" class="mobile-status-btn rounded-xl bg-amber-50 px-2 py-1.5 text-[11px] font-black text-amber-700" data-id="${escapeHTML(t.id)}" data-status="PENDING">대기</button>
      <button type="button" class="mobile-status-btn rounded-xl bg-blue-50 px-2 py-1.5 text-[11px] font-black text-blue-700" data-id="${escapeHTML(t.id)}" data-status="PROGRESS">진행</button>
      <button type="button" class="mobile-status-btn rounded-xl bg-emerald-50 px-2 py-1.5 text-[11px] font-black text-emerald-700" data-id="${escapeHTML(t.id)}" data-status="COMPLETED">완료</button>
    </div>
  </article>`;
}
function renderKanbanView(filtered){
  const container=document.getElementById('kanban-container');
  const empty=document.getElementById('empty-state-kanban');
  if(!container){console.warn('kanban-container not found');return;}
  container.innerHTML='';
  const today=getTodayStr();
  const list=Array.isArray(filtered)?filtered:[];
  if(!list.length){empty?.classList.remove('hidden');empty?.classList.add('flex');return;}
  empty?.classList.add('hidden');empty?.classList.remove('flex');
  const cols=getKanbanColumns().map(c=>({...c,tasks:[]}));
  const byKey=Object.fromEntries(cols.map(c=>[c.key,c]));
  list.forEach(t=>byKey[getKanbanBucket(t,today)].tasks.push(t));
  const total=list.length;
  const risk=list.filter(t=>isTaskOverdueEffective(t,today)||['HIGH','CRITICAL'].includes(getTaskRiskInfo(t,today).level)).length;
  const completed=list.filter(t=>getEffectiveStatus(t,today)==='COMPLETED').length;
  const pct=total?Math.round(completed/total*100):0;
  container.insertAdjacentHTML('beforeend',`<section class="mb-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"><div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><div class="text-[11px] font-black uppercase tracking-wide text-slate-400">업무 흐름 칸반</div><div class="text-xl font-black text-slate-900">업무 흐름 관리</div></div><div class="grid grid-cols-3 gap-2 text-center text-xs font-black sm:flex sm:text-left"><div class="rounded-2xl bg-slate-50 px-3 py-2"><div class="text-slate-400">전체</div><div class="text-slate-900">${total}</div></div><div class="rounded-2xl bg-rose-50 px-3 py-2"><div class="text-rose-400">위험</div><div class="text-rose-700">${risk}</div></div><div class="rounded-2xl bg-emerald-50 px-3 py-2"><div class="text-emerald-400">달성률</div><div class="text-emerald-700">${pct}%</div></div></div></div></section>`);
  const board=document.createElement('div');
  board.className='grid grid-cols-1 gap-3 lg:grid-cols-4';
  board.innerHTML=cols.map(col=>`<section class="min-h-[220px] rounded-3xl border p-3 ${kanbanTone(col.color)}"><div class="mb-3 flex items-center justify-between gap-2"><div><div class="text-sm font-black text-slate-800">${col.title}</div><div class="text-[11px] font-semibold text-slate-400">${col.hint}</div></div><span class="rounded-full px-2 py-1 text-xs font-black ${kanbanBadge(col.color)}">${col.tasks.length}</span></div><div class="space-y-2">${col.tasks.length?col.tasks.map(t=>buildKanbanCard(t,today)).join(''):'<div class="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 text-center text-xs font-bold text-slate-400">해당 업무 없음</div>'}</div></section>`).join('');
  container.appendChild(board);
}
