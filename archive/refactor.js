const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(jsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Firebase Firestore syntax replacements
  content = content.replace(/await coll\.doc\((.*?)\)\.set\((.*?),\s*\{\s*merge:\s*true\s*\}\);/g, 'await window.fs.setDoc(window.fs.doc(coll, $1), $2, { merge: true });');
  content = content.replace(/await coll\.doc\((.*?)\)\.set\((.*?)\);/g, 'await window.fs.setDoc(window.fs.doc(coll, $1), $2);');
  
  content = content.replace(/const batch = db\.batch\(\);/g, 'const batch = window.fs.writeBatch(window.db);');
  content = content.replace(/batch\.set\(coll\.doc\((.*?)\),\s*(.*?),\s*\{\s*merge:\s*true\s*\}\)/g, 'batch.set(window.fs.doc(coll, $1), $2, { merge: true })');
  
  content = content.replace(/await tColl\.where\((.*?),\s*'(.*?)',\s*(.*?)\)\.get\(\)/g, 'await window.fs.getDocs(window.fs.query(tColl, window.fs.where($1, "$2", $3)))');
  content = content.replace(/await coll\.doc\((.*?)\)\.get\(\)/g, 'await window.fs.getDoc(window.fs.doc(coll, $1))');
  
  content = content.replace(/trackerColl\.onSnapshot\(/g, 'window.fs.onSnapshot(trackerColl, ');
  content = content.replace(/taskColl\.onSnapshot\(/g, 'window.fs.onSnapshot(taskColl, ');

  // Bootstrap service auth refactor
  if (file === 'bootstrap-service.js') {
    content = content.replace(/await auth\.signInAnonymously\(\)/g, 'await window.signInAnonymously(window.auth)');
    content = content.replace(/auth\.onAuthStateChanged\(/g, 'window.onAuthStateChanged(window.auth, ');
    
    // Add waiting mechanism at the top of DOMContentLoaded
    if (!content.includes('waitForFirebase')) {
      content = content.replace(
        "document.addEventListener('DOMContentLoaded', () => {",
        "document.addEventListener('DOMContentLoaded', () => {\n  const waitForFirebase = setInterval(() => {\n    if (window.auth) {\n      clearInterval(waitForFirebase);\n      initBootstrap();\n    }\n  }, 50);\n  function initBootstrap() {"
      );
      content = content.replace(
        "console.info('Smart Task Flow Bootstrap initialized');",
        "console.info('Smart Task Flow Bootstrap initialized');\n  }"
      );
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Refactored ${file}`);
  }
});
