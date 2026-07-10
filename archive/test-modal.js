const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

const dom = new JSDOM(html, {
  url: 'http://localhost:3000',
  runScripts: 'dangerously',
  resources: 'usable',
  beforeParse(window) {
    // Mock global dependencies like matchMedia and DOMPurify
    window.matchMedia = window.matchMedia || function() {
      return { matches: false, addListener: function() {}, removeListener: function() {} };
    };
    // Let DOMPurify load via network or mock it. We will just let scripts load.
    // JSDOM might throw errors during script loading.
  }
});

dom.window.document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded reached.');
  setTimeout(() => {
    try {
      console.log('Trying to call openTaskModal...');
      if (dom.window.openTaskModal) {
        dom.window.openTaskModal();
        const modal = dom.window.document.getElementById('modal-task');
        console.log('openTaskModal executed successfully!');
        console.log('Modal classes:', modal.className);
      } else {
        console.error('openTaskModal is not defined on window.');
      }
    } catch (e) {
      console.error('Error during openTaskModal:', e);
    }
  }, 2000); // give time for scripts to evaluate
});

// Capture virtual console errors
dom.virtualConsole.on("jsdomError", (e) => {
  console.error("JSDOM Error:", e.message);
});
dom.virtualConsole.on("error", (e) => {
  console.error("Window Error:", e);
});
