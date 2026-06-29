
console.info('Smart Task Flow bootstrap-service.js v20260626-final-stable loaded');
async function initializeAuthAndData(){
  if(window.isFirebaseAvailable&&window.auth){
    const initAuth=async()=>{if(typeof __initial_auth_token!=='undefined'&&__initial_auth_token)await window.auth.signInWithCustomToken(__initial_auth_token);else await window.signInAnonymously(window.auth);};
    try{await initAuth();window.onAuthStateChanged(window.auth, user=>{isAuthReady=!!user;if(user)fetchInitialData();});}
    catch(e){console.error('Auth initialization failed',e);updateUI();}
  }else updateUI();
}
function restoreCurrentTrackerSelection(){try{const saved=localStorage.getItem('flow_current_tracker');if(saved&&trackers.some(t=>t.id===saved))currentTrackerId=saved;}catch(e){console.warn('Tracker restore skipped because localStorage is unavailable.',e);}updateTrackerUI();}
function initializeApplicationEvents(){if(typeof window.initEventBindings==='function')window.initEventBindings();else console.warn('initEventBindings missing; UI loaded without extra event binding.');}
async function bootstrapApp(){
  initializeApplicationEvents();
  restoreCurrentTrackerSelection();
  await initializeAuthAndData();
}
window.bootstrapApp=bootstrapApp;
