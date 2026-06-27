const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const sampleGames = require('../src/data/sampleGames');
const { getCanonicalGameSlug } = require('../src/utils/slug');
const {
  ROOT,
  DEFAULT_DATA_DIR,
  parseArgs,
  normalizeDataDir,
  normalizeGuideFileName
} = require('./data-sync-utils');
const {
  validateManifest,
  loadGuideRecords,
  assertNoGuideRecordConflicts
} = require('./import-data');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function getNpmInvocation() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath]
    };
  }

  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: []
  };
}

function runNpmScript(scriptName) {
  const npm = getNpmInvocation();
  execFileSync(npm.command, [...npm.args, 'run', scriptName], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit'
  });
}

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    if (error.status === 128) return '';
    throw error;
  }
}

function assertUniqueManifestSlugs(manifest) {
  const seen = new Set();
  for (const entry of manifest.games) {
    const slug = String(entry.slug || '').trim().toLowerCase();
    if (!slug) {
      throw new Error('Manifest invalido: todo item em games precisa de slug.');
    }
    if (seen.has(slug)) {
      throw new Error(`Manifest invalido: slug duplicado em data/guides/manifest.json: ${slug}`);
    }
    seen.add(slug);
  }
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function collectDataGuideValidationErrors(manifest, records) {
  const errors = [];
  const manifestSlugByName = new Map();
  const sampleSlugByName = new Map();
  const manifestSlugs = new Set(manifest.games.map(entry => entry.slug));

  for (const entry of manifest.games) {
    const slug = String(entry.slug || '').trim().toLowerCase();
    const name = normalizeName(entry.name);
    const expectedFile = normalizeGuideFileName(slug);

    if (entry.file !== expectedFile) {
      errors.push(`manifest: ${slug} deve apontar para ${expectedFile}, recebido ${entry.file || '(vazio)'}.`);
    }

    if (name) {
      const existingSlug = manifestSlugByName.get(name);
      if (existingSlug && existingSlug !== slug) {
        errors.push(`manifest: name "${entry.name}" aparece com slugs diferentes: ${existingSlug} e ${slug}.`);
      }
      manifestSlugByName.set(name, slug);
    }
  }

  for (const game of sampleGames) {
    const name = normalizeName(game.name);
    const slug = getCanonicalGameSlug(game.slug || game.name);
    if (!name || !slug) continue;

    const existingSlug = sampleSlugByName.get(name);
    if (existingSlug && existingSlug !== slug) {
      errors.push(`sampleGames: name "${game.name}" aparece com slugs diferentes: ${existingSlug} e ${slug}.`);
    }
    sampleSlugByName.set(name, slug);
  }

  for (const record of records) {
    const expectedFile = normalizeGuideFileName(record.slug);
    const name = String(record.guide?.game?.name || '').trim();
    const nameKey = normalizeName(name);

    if (record.sourceFile !== expectedFile) {
      errors.push(`guia ${record.slug}: arquivo deve ser ${expectedFile}, recebido ${record.sourceFile}.`);
    }
    if (!name) {
      errors.push(`guia ${record.slug}: precisa de game.name.`);
    }
    if (record.guide?.game?.slug !== record.slug) {
      errors.push(`guia ${record.slug}: game.slug deve ser ${record.slug}, recebido ${record.guide?.game?.slug || '(vazio)'}.`);
    }

    const sampleSlug = sampleSlugByName.get(nameKey);
    if (sampleSlug && sampleSlug !== record.slug) {
      errors.push(`sampleGames/data: "${name}" usa slug ${sampleSlug} no seed e ${record.slug} em data/guides.`);
    }

    const redirects = Array.isArray(record.guide?.redirects) ? record.guide.redirects : [];
    for (const redirect of redirects) {
      const alias = String(redirect || '').trim().toLowerCase();
      if (!alias) continue;
      const aliasTarget = getCanonicalGameSlug(alias);
      if (alias === record.slug) {
        errors.push(`guia ${record.slug}: redirect auto-referente ${alias}.`);
      }
      if (aliasTarget !== record.slug && manifestSlugs.has(aliasTarget)) {
        errors.push(`guia ${record.slug}: redirect ${alias} resolve para ${aliasTarget || '(vazio)'}, esperado ${record.slug}.`);
      }
      if (manifestSlugs.has(alias)) {
        errors.push(`guia ${record.slug}: redirect ${alias} tambem existe como slug principal no manifest.`);
      }
    }
  }

  return errors;
}

function validateGuideFiles(dataDir) {
  const manifestPath = path.join(dataDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest nao encontrado em ${manifestPath}.`);
  }

  const manifest = readJson(manifestPath);
  validateManifest(manifest);
  assertUniqueManifestSlugs(manifest);

  const selectedSlugs = manifest.games.map(entry => entry.slug);
  const records = loadGuideRecords(dataDir, manifest, selectedSlugs);
  assertNoGuideRecordConflicts(records);
  const errors = collectDataGuideValidationErrors(manifest, records);
  if (errors.length) {
    throw new Error(`data/guides invalido:\n- ${errors.join('\n- ')}`);
  }

  return { manifest, records };
}

function parseGuideStatusLine(line) {
  const status = line.slice(0, 2).trim() || 'M';
  const rawPath = line.slice(3).trim();
  const normalizedPath = rawPath.includes(' -> ')
    ? rawPath.split(' -> ').pop().trim()
    : rawPath;
  return { status, filePath: normalizedPath.replace(/\\/g, '/') };
}

function getChangedGuideFiles() {
  const output = runGit(['status', '--short', '--', 'data/guides']);
  return output
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(Boolean)
    .map(parseGuideStatusLine);
}

function summarizeChangedSlugs(records, changedFiles) {
  const slugByFile = new Map(records.map(record => [`data/guides/${record.sourceFile}`, record.slug]));
  const changedSlugs = [];
  const changedOther = [];

  for (const item of changedFiles) {
    if (item.filePath === 'data/guides/manifest.json') {
      changedOther.push(`${item.status} manifest.json`);
      continue;
    }

    const slug = slugByFile.get(item.filePath);
    if (slug) {
      changedSlugs.push(`${item.status} ${slug}`);
    } else {
      changedOther.push(`${item.status} ${path.basename(item.filePath)}`);
    }
  }

  return {
    changedSlugs: [...new Set(changedSlugs)].sort(),
    changedOther: [...new Set(changedOther)].sort()
  };
}

async function main() {
  const args = parseArgs();
  const dataDir = normalizeDataDir(args.dataDir || DEFAULT_DATA_DIR);

  runNpmScript('export:data');
  const { manifest, records } = validateGuideFiles(dataDir);
  const changedFiles = getChangedGuideFiles();
  const summary = summarizeChangedSlugs(records, changedFiles);

  console.log('');
  console.log('prepare:guides concluido');
  console.log(`- data/guides validado: ${records.length} guias no manifest`);
  console.log(`- totais exportados: jogos=${manifest.totals?.games ?? records.length}, trofeus=${manifest.totals?.trophies ?? 'n/a'}, roadmaps=${manifest.totals?.roadmaps ?? 'n/a'}`);

  if (summary.changedSlugs.length) {
    console.log('- slugs alterados:');
    summary.changedSlugs.forEach(item => console.log(`  ${item}`));
  } else {
    console.log('- slugs alterados: nenhum diff versionavel detectado em data/guides');
  }

  if (summary.changedOther.length) {
    console.log('- outros arquivos em data/guides:');
    summary.changedOther.forEach(item => console.log(`  ${item}`));
  }

  console.log('');
  console.log('Confira: git diff data/guides');
  console.log('Agora rode: git add data/guides && git commit -m "data: atualizar guias" && git push');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
