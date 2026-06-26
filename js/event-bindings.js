
console.info('Smart Task Flow event-bindings.js v20260626-phase12-13-final loaded');
function initPhase1213Bindings(){if(window.__phase1213Bindings)return;window.__phase1213Bindings=true;document.getElementById('btn-view-kanban')?.addEventListener('click',()=>switchView('KANBAN'));document.addEventListener('click',e=>{const btn=e.target.closest('.mobile-status-btn');if(btn){e.preventDefault();e.stopPropagation();updateTaskStatus(btn.dataset.id,btn.dataset.status);}});}
window.addEventListener('DOMContentLoaded',initPhase1213Bindings);
