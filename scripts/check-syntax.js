const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const files = ['js', 'scripts'].flatMap(directory => fs.readdirSync(path.join(root, directory))
  .filter(file => file.endsWith('.js')).map(file => path.join(directory, file)));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`JavaScript syntax passed: ${files.length} files`);
