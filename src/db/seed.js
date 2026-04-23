const sampleGames = require('../data/sampleGames');
const { get, run } = require('./db');
const { slugifyGameName } = require('../utils/slug');
const { formatTimeMetadata } = require('../utils/time');

async function seed() {
  const existing = await get('SELECT COUNT(*) AS total FROM games');
  if (existing && existing.total > 0) {
    return;
  }

  for (const game of sampleGames) {
    const result = await run(
      'INSERT INTO games (name, slug, difficulty, time, time_min_hours, time_max_hours, time_sort_hours, missable, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [game.name, slugifyGameName(game.name), game.difficulty, game.time, formatTimeMetadata(game.time).time_min_hours, formatTimeMetadata(game.time).time_max_hours, formatTimeMetadata(game.time).time_sort_hours, game.missable, game.image || null]
    );

    const gameId = result.lastID;

    for (let index = 0; index < game.roadmap.length; index += 1) {
      await run(
        'INSERT INTO roadmaps (game_id, step_order, content) VALUES (?, ?, ?)',
        [gameId, index + 1, game.roadmap[index]]
      );
    }

    for (const trophy of game.trophies) {
      await run(
        `INSERT INTO trophies (game_id, trophy_code, name, type, description, tip, is_spoiler)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          gameId,
          trophy.id,
          trophy.name,
          trophy.type,
          trophy.description,
          trophy.tip,
          trophy.is_spoiler ? 1 : 0
        ]
      );
    }
  }
}

module.exports = seed;
