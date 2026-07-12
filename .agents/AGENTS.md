# Task Tracker Rules

- Legacy global browser scripts are loaded from `index.html`; script order and duplicate globals matter.
- Before editing a function or global variable, search with `rg` for duplicate declarations.
- Avoid full reads of `index.html` and `js/app.js`; search first, then open a small range.
- Follow the existing renderer/service split; do not move architecture unless asked.

## Verification

- CSS build: `npm run build:css`
- Mobile regression: `npm run smoke:mobile`
- JS syntax: `node --check path/to/file.js`
- Whitespace: `git diff --check`
- Do not open an interactive browser unless explicitly requested or automated checks cannot answer the UI question.
