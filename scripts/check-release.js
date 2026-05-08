const fs = require('fs');
const path = require('path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const SKIPPED_DIRECTORIES = new Set(['.git']);
const ALLOWED_EXACT_FILES = new Set(['.env.example', 'package-lock.json']);
const BLOCKED_ENV_FILES = new Set(['.env', '.env.local', '.env.production', '.env.development']);
const BLOCKED_LOCAL_DIRS = new Set(['dumps', 'dump', 'backups', 'backup', 'sessions', 'tmp', 'temp']);

const SUGGESTIONS = {
  dependencies: 'Remova a pasta do pacote e rode npm ci no ambiente de destino.',
  database: 'Remova o banco local do pacote; configure DATABASE_PATH no servidor e inicialize o banco no destino.',
  env: 'Remova o arquivo de ambiente do pacote; configure variaveis diretamente no servidor.',
  log: 'Remova logs locais antes de gerar o ZIP.',
  runtime: 'Remova dados de runtime locais antes de gerar o ZIP.',
  zip: 'Mantenha ZIPs antigos fora da raiz do projeto antes de empacotar.',
  localCopy: 'Remova copias locais, backups ou bancos antigos antes do release.',
  debug: 'Remova artefatos temporarios de debug antes do release.',
  duplicateRoot: 'Gere o ZIP a partir da raiz correta, sem incluir outra copia do projeto dentro dela.'
};

function normalizePackagePath(filePath, root, isDirectory = false) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  return isDirectory && relative && !relative.endsWith('/') ? `${relative}/` : relative || '.';
}

function isAllowedExactFile(name) {
  return ALLOWED_EXACT_FILES.has(name);
}

function isDebugHtmlFile(fileName) {
  if (path.extname(fileName).toLowerCase() !== '.html') return false;
  const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
  return baseName.includes('debug') || /(^|[-_.])(tmp|temp)([-_.]|$)/.test(baseName);
}

function hasLocalCopyName(fileName) {
  const lower = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return (
    /(^|[-_.\s])(copy|copia|backup|bkp|old|antigo)([-_.\s]|$)/.test(lower) ||
    /^copy\s+of\s+/.test(lower) ||
    /(database|sqlite|banco|db).*(old|antigo|backup|bkp|copy|copia)/.test(lower) ||
    /(old|antigo|backup|bkp|copy|copia).*(database|sqlite|banco|db)/.test(lower)
  );
}

function buildFinding(reason, suggestionKey) {
  return {
    reason,
    suggestion: SUGGESTIONS[suggestionKey]
  };
}

function getBlockedFinding(entry, fullPath, root) {
  const lowerName = entry.name.toLowerCase();
  const extension = path.extname(lowerName);
  const isDirectory = entry.isDirectory();
  const isFile = entry.isFile();
  const rootPackageName = path.basename(root).toLowerCase();

  if (isDirectory && lowerName === 'node_modules') {
    return buildFinding('node_modules/ nao deve ser empacotado porque dependencias nativas precisam ser instaladas no destino.', 'dependencies');
  }

  if (isDirectory && BLOCKED_LOCAL_DIRS.has(lowerName)) {
    return buildFinding(`${entry.name}/ contem dados locais, temporarios, sessoes, dumps ou backups.`, 'runtime');
  }

  if (isDirectory && lowerName === rootPackageName && path.resolve(fullPath) !== root) {
    return buildFinding(`pasta duplicada ${path.basename(root)}/ encontrada dentro do pacote.`, 'duplicateRoot');
  }

  if (isAllowedExactFile(entry.name)) return null;

  if (BLOCKED_ENV_FILES.has(lowerName)) {
    return buildFinding(`${entry.name} pode conter segredos ou configuracao local.`, 'env');
  }

  if (isFile && lowerName === '.ds_store') {
    return buildFinding('.DS_Store e um artefato local do sistema operacional.', 'runtime');
  }

  if (isFile && (lowerName === 'npm-debug.log' || lowerName === 'yarn-error.log' || lowerName.endsWith('.log'))) {
    return buildFinding(`${entry.name} e um log local/de debug.`, 'log');
  }

  if (isFile && lowerName === 'database.sqlite') {
    return buildFinding('database.sqlite e um banco SQLite local e nao deve ser empacotado.', 'database');
  }

  if (isFile && (lowerName.endsWith('.db-journal') || ['.sqlite', '.sqlite3', '.db'].includes(extension))) {
    return buildFinding(`${entry.name} e um artefato de banco local.`, 'database');
  }

  if (isFile && extension === '.zip') {
    return buildFinding(`${entry.name} parece ser um ZIP antigo dentro do projeto.`, 'zip');
  }

  if (isFile && isDebugHtmlFile(entry.name)) {
    return buildFinding(`${entry.name} parece ser HTML temporario de debug.`, 'debug');
  }

  if (hasLocalCopyName(entry.name)) {
    return buildFinding(`${entry.name} indica copia local, backup ou banco antigo.`, 'localCopy');
  }

  return null;
}

function walkReleaseTree(currentDirectory, root, results) {
  for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
    const fullPath = path.join(currentDirectory, entry.name);
    const isDirectory = entry.isDirectory();
    const finding = getBlockedFinding(entry, fullPath, root);

    if (finding) {
      results.push({
        packagePath: normalizePackagePath(fullPath, root, isDirectory),
        reason: finding.reason,
        suggestion: finding.suggestion
      });
    }

    if (!isDirectory || SKIPPED_DIRECTORIES.has(entry.name)) continue;
    if (finding) continue;

    walkReleaseTree(fullPath, root, results);
  }

  return results;
}

function scanReleaseTree(root = DEFAULT_ROOT) {
  const resolvedRoot = path.resolve(root);
  const results = walkReleaseTree(resolvedRoot, resolvedRoot, []);
  return results.sort((a, b) => a.packagePath.localeCompare(b.packagePath));
}

function formatBlockedArtifacts(blockedArtifacts) {
  return blockedArtifacts
    .map(item => `- ${item.packagePath}\n  Motivo: ${item.reason}\n  Sugestao: ${item.suggestion}`)
    .join('\n');
}

function runReleaseCheck(root = DEFAULT_ROOT) {
  const blockedArtifacts = scanReleaseTree(root);

  if (blockedArtifacts.length > 0) {
    console.error('Release bloqueado: foram encontrados arquivos locais/sensiveis. Remova os itens abaixo antes de gerar o ZIP.');
    console.error(formatBlockedArtifacts(blockedArtifacts));
    return 1;
  }

  console.log('Release check passed: no forbidden release artifacts were found.');
  return 0;
}

if (require.main === module) {
  process.exit(runReleaseCheck());
}

module.exports = {
  scanReleaseTree,
  formatBlockedArtifacts,
  runReleaseCheck
};
