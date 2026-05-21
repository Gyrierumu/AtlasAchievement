const sampleGames = require('../src/data/sampleGames');
const guideModel = require('../src/shared/guideViewModel');
const { db, get, run, exec } = require('../src/db/db');

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

async function main() {
  const seedGame = sampleGames.find(game => game.slug === 'god-of-war');
  if (!seedGame || !Array.isArray(seedGame.roadmap) || seedGame.roadmap.length !== 6) {
    throw new Error('Seed de God of War sem roadmap editorial esperado.');
  }

  const game = await get('SELECT id, slug FROM games WHERE slug = ?', ['god-of-war']);
  if (!game) {
    console.log('God of War nao encontrado no SQLite atual; nada para sincronizar.');
    return;
  }

  await exec('BEGIN TRANSACTION');
  try {
    await run(
      `UPDATE games
          SET first_run_advice = ?,
              cleanup_advice = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        seedGame.first_run_advice || '',
        seedGame.cleanup_advice || '',
        game.id
      ]
    );

    await run('DELETE FROM roadmaps WHERE game_id = ?', [game.id]);
    for (let index = 0; index < seedGame.roadmap.length; index += 1) {
      await run(
        'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
        [game.id, index + 1, serializeRoadmapStep(seedGame.roadmap[index], index, seedGame.roadmap.length)]
      );
    }

    await exec('COMMIT');
    console.log('Roadmap de god-of-war sincronizado com 6 etapas editoriais.');
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
