const { db, get, run, exec } = require('../src/db/db');
const editorialModel = require('../src/shared/editorialModel');

const FORBIDDEN_WARNING_RE = /Algumas descri[cç][oõ]es secretas usam tradu[cç][aã]o editorial PT-BR|Steam oculta|descri[cç][aã]o localizada/i;

function removeForbiddenText(value = '') {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !FORBIDDEN_WARNING_RE.test(line))
    .join('\n');
}

function cleanQualityWarnings(value = '') {
  const warnings = editorialModel.parseQualityWarnings(value)
    .filter(item => !FORBIDDEN_WARNING_RE.test(item));
  return JSON.stringify(warnings);
}

async function main() {
  const game = await get(
    `SELECT id, slug, verification_note, editorial_notes, quality_warnings
       FROM games
      WHERE slug = ?`,
    ['ghost-of-tsushima']
  );

  if (!game) {
    console.log('Ghost of Tsushima nao encontrado no SQLite atual; nada para limpar.');
    return;
  }

  const cleanedQualityWarnings = cleanQualityWarnings(game.quality_warnings || '');
  const cleanedEditorialNotes = removeForbiddenText(game.editorial_notes || '');
  const cleanedVerificationNote = removeForbiddenText(game.verification_note || '');

  await exec('BEGIN TRANSACTION');
  try {
    await run(
      `UPDATE games
          SET verification_note = ?,
              editorial_notes = ?,
              quality_warnings = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        cleanedVerificationNote,
        cleanedEditorialNotes,
        cleanedQualityWarnings,
        game.id
      ]
    );
    await exec('COMMIT');
    console.log('Aviso editorial publico de Ghost of Tsushima limpo com seguranca.');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    throw error;
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
