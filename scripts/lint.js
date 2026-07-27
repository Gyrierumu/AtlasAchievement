const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const sourceRoots = ['server.js', 'src', 'scripts', 'tests'];
const failures = [];

function listJavaScriptFiles(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const entry = fs.statSync(absolutePath);
  if (entry.isFile()) return absolutePath.endsWith('.js') ? [absolutePath] : [];

  return fs.readdirSync(absolutePath, { withFileTypes: true })
    .flatMap(child => listJavaScriptFiles(path.join(relativePath, child.name)));
}

const files = sourceRoots.flatMap(listJavaScriptFiles);

for (const file of files) {
  const relativeFile = path.relative(root, file);
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    if (/[ \t]+$/.test(line)) {
      failures.push(`${relativeFile}:${index + 1} contém espaço no fim da linha`);
    }
  });

  if (!source.endsWith('\n')) {
    failures.push(`${relativeFile} deve terminar com uma nova linha`);
  }

  const syntaxCheck = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8'
  });
  if (syntaxCheck.status !== 0) {
    failures.push(`${relativeFile} falhou na validação de sintaxe:\n${syntaxCheck.stderr.trim()}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Lint concluído em ${files.length} arquivos JavaScript.`);
