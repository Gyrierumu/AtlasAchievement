const sampleGames = require('../src/data/sampleGames');
const guideModel = require('../src/shared/guideViewModel');
const { db, get, all, run, exec } = require('../src/db/db');

const SLUG = 'god-of-war-ragnarok';
const EXPECTED_TROPHY_COUNT = 36;

const FORBIDDEN_PUBLIC_TEXT = [
  'Em revisão',
  'Este guia ainda está passando por revisão editorial',
  'Base game sem DLCs',
  'Comece pelo roadmap',
  'Avance pela campanha',
  'Prossiga pela rota planejada',
  'Artefacts',
  'Odin’s Ravens',
  "Odin's Ravens",
  'Nornir Chests',
  'Legendary Chests',
  'Trials of Muspelheim',
  'Battle Gná',
  'Complete all of the Crater Hunts',
  'Complete the Trials of Muspelheim',
  'Battle Níðhögg',
  'Descrição em revisão editorial.',
  '[object Object]',
  'undefined'
];

function serializeRoadmapStep(step, index = 0, total = 1) {
  const normalized = guideModel.normalizeRoadmapStep(step, index, total);
  return JSON.stringify({
    title: normalized.title,
    focus: normalized.focus,
    objective: normalized.objective,
    actions: normalized.actions,
    warning: normalized.warning,
    result: normalized.result
  });
}

function assertSeed(seedGame) {
  if (!seedGame) throw new Error(`Seed nao encontrado para ${SLUG}.`);
  if (!Array.isArray(seedGame.trophies) || seedGame.trophies.length !== EXPECTED_TROPHY_COUNT) {
    throw new Error(`Seed de ${SLUG} deve ter ${EXPECTED_TROPHY_COUNT} trofeus.`);
  }
  if (!Array.isArray(seedGame.roadmap) || seedGame.roadmap.length !== 6) {
    throw new Error(`Seed de ${SLUG} deve ter 6 etapas de roadmap.`);
  }
  if (seedGame.roadmap[0]?.title !== 'Avance a história em uma dificuldade confortável') {
    throw new Error('Primeira etapa do roadmap nao esta no padrao editorial esperado.');
  }
}

async function updateGameRow(game, seedGame) {
  return run(
    `UPDATE games
        SET name = ?,
            difficulty = ?,
            time = ?,
            time_min_hours = ?,
            time_max_hours = ?,
            time_sort_hours = ?,
            time_bucket = ?,
            missable = ?,
            guide_runs = ?,
            guide_online = ?,
            guide_grind = ?,
            guide_dlc = ?,
            guide_ideal = ?,
            guide_avoid = ?,
            guide_best_moment = ?,
            runs_summary = ?,
            missable_summary = ?,
            online_summary = ?,
            grind_summary = ?,
            dlc_scope = ?,
            difficulty_reason = ?,
            time_reason = ?,
            first_run_advice = ?,
            cleanup_advice = ?,
            before_you_start = ?,
            best_for = ?,
            avoid_if = ?,
            verification_status = ?,
            editorial_status = ?,
            coverage_level = ?,
            is_verified = ?,
            verification_note = ?,
            editorial_review_status = ?,
            last_reviewed_at = ?,
            editorial_notes = ?,
            quality_warnings = ?,
            reviewed_by = ?,
            image = ?,
            cover_image = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      seedGame.name,
      seedGame.difficulty,
      seedGame.time,
      seedGame.time_min_hours,
      seedGame.time_max_hours,
      seedGame.time_sort_hours,
      seedGame.time_bucket,
      seedGame.missable,
      seedGame.runs_summary,
      seedGame.online_summary,
      seedGame.grind_summary,
      seedGame.dlc_scope,
      seedGame.best_for,
      seedGame.avoid_if,
      seedGame.first_run_advice,
      seedGame.runs_summary,
      seedGame.missable_summary,
      seedGame.online_summary,
      seedGame.grind_summary,
      seedGame.dlc_scope,
      seedGame.difficulty_reason,
      seedGame.time_reason,
      seedGame.first_run_advice,
      seedGame.cleanup_advice,
      seedGame.before_you_start,
      seedGame.best_for,
      seedGame.avoid_if,
      'verified',
      seedGame.editorial_status || 'published',
      seedGame.coverage_level || 'strong',
      1,
      'Guia revisado editorialmente.',
      'verified',
      seedGame.last_reviewed_at || '2026-05-21',
      seedGame.editorial_notes || 'Guia revisado editorialmente.',
      JSON.stringify(Array.isArray(seedGame.quality_warnings) ? seedGame.quality_warnings : []),
      'Codex',
      seedGame.image || '',
      seedGame.cover_image || '',
      game.id
    ]
  );
}

async function replaceRoadmap(gameId, roadmap) {
  await run('DELETE FROM roadmaps WHERE game_id = ?', [gameId]);
  for (let index = 0; index < roadmap.length; index += 1) {
    await run(
      'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
      [gameId, index + 1, serializeRoadmapStep(roadmap[index], index, roadmap.length)]
    );
  }
}

async function upsertTrophies(gameId, trophies) {
  let changed = 0;
  for (const trophy of trophies) {
    const result = await run(
      `INSERT INTO trophies (game_id, trophy_code, name, name_pt, type, description, tip, is_missable, is_spoiler)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(game_id, trophy_code) DO UPDATE SET
         name = excluded.name,
         name_pt = excluded.name_pt,
         type = excluded.type,
         description = excluded.description,
         tip = excluded.tip,
         is_missable = excluded.is_missable,
         is_spoiler = excluded.is_spoiler`,
      [
        gameId,
        trophy.id,
        trophy.name,
        trophy.name_pt || null,
        trophy.type,
        trophy.description || '',
        trophy.tip || '',
        trophy.is_missable ? 1 : 0,
        trophy.is_spoiler ? 1 : 0
      ]
    );
    changed += result.changes || 0;
  }
  return changed;
}

async function assertPersistedState(gameId) {
  const game = await get('SELECT * FROM games WHERE id = ?', [gameId]);
  const roadmapRows = await all('SELECT content FROM roadmaps WHERE game_id = ? ORDER BY step_order ASC', [gameId]);
  const trophyRows = await all('SELECT trophy_code, name, name_pt, description, tip, is_missable FROM trophies WHERE game_id = ? ORDER BY trophy_code ASC', [gameId]);
  const text = [
    game.name,
    game.slug,
    game.verification_status,
    game.editorial_status,
    game.verification_note,
    game.dlc_scope,
    game.first_run_advice,
    game.cleanup_advice,
    game.before_you_start,
    roadmapRows.map(row => row.content).join(' '),
    trophyRows.map(row => [row.name, row.name_pt, row.description, row.tip].join(' ')).join(' ')
  ].join(' ');

  if (game.slug !== SLUG) throw new Error('Slug persistido inesperado.');
  if (Number(game.is_verified) !== 1 || game.verification_status !== 'verified') {
    throw new Error('Guia persistido nao ficou Verificado.');
  }
  if (game.verification_note !== 'Guia revisado editorialmente.') {
    throw new Error('Mensagem publica persistida esta incorreta.');
  }
  if (!String(game.dlc_scope || '').includes('Valhalla fora da platina base')) {
    throw new Error('DLC/Valhalla persistido esta incorreto.');
  }
  if (roadmapRows.length !== 6) throw new Error('Roadmap persistido deve ter 6 etapas.');
  if (trophyRows.length !== EXPECTED_TROPHY_COUNT) {
    throw new Error(`Banco ficou com ${trophyRows.length} trofeus para ${SLUG}; esperado ${EXPECTED_TROPHY_COUNT}.`);
  }
  const missables = trophyRows.filter(row => Number(row.is_missable) === 1);
  if (missables.length !== 0) throw new Error('God of War Ragnarok nao deve ter perdiveis persistidos.');
  const missingPt = trophyRows.filter(row => !String(row.name_pt || '').trim());
  if (missingPt.length) throw new Error(`Trofeus sem nome PT-BR: ${missingPt.map(row => row.trophy_code).join(', ')}`);
  const missingDescription = trophyRows.filter(row => !String(row.description || '').trim());
  if (missingDescription.length) throw new Error(`Trofeus sem descricao: ${missingDescription.map(row => row.trophy_code).join(', ')}`);

  const forbidden = FORBIDDEN_PUBLIC_TEXT.find(item => text.includes(item));
  if (forbidden) throw new Error(`Texto antigo ainda persistido: ${forbidden}`);
}

async function main() {
  const seedGame = sampleGames.find(game => game.slug === SLUG);
  assertSeed(seedGame);

  const game = await get('SELECT id, slug FROM games WHERE slug = ?', [SLUG]);
  if (!game) {
    console.log(`${SLUG} nao encontrado no SQLite atual; nada para sincronizar.`);
    return;
  }

  await exec('BEGIN TRANSACTION');
  try {
    await updateGameRow(game, seedGame);
    await replaceRoadmap(game.id, seedGame.roadmap);
    const trophyChanges = await upsertTrophies(game.id, seedGame.trophies);
    await assertPersistedState(game.id);
    await exec('COMMIT');
    console.log(`${SLUG} sincronizado: Verificado, 6 etapas de roadmap e ${EXPECTED_TROPHY_COUNT} trofeus atualizados.`);
    console.log(`Trophy upserts aplicados: ${trophyChanges}.`);
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
