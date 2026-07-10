const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
const inputCssDir = path.join(__dirname, 'src');
const inputCssPath = path.join(inputCssDir, 'input.css');

if (!fs.existsSync(inputCssDir)) {
  fs.mkdirSync(inputCssDir);
}

let html = fs.readFileSync(indexPath, 'utf-8');

// 1. Extract style block
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
let customCss = '';
if (styleMatch) {
  customCss = styleMatch[1];
  // Remove the style block from HTML
  html = html.replace(/<style>[\s\S]*?<\/style>/, '');
}

// 2. Remove Tailwind CDN and insert CSS link
html = html.replace(
  '<script src="https://cdn.tailwindcss.com"></script>',
  '<link rel="stylesheet" href="./dist/output.css">'
);

// 3. Write input.css
const cssContent = `@import "tailwindcss";\n${customCss}`;
fs.writeFileSync(inputCssPath, cssContent, 'utf-8');

// 4. Update index.html
fs.writeFileSync(indexPath, html, 'utf-8');

console.log('Migration complete. Created src/input.css and updated index.html.');
