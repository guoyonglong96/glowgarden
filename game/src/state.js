// The game state: one object holds the whole run, and every rule that
// changes it lives here (start, waves, gold, lives, win and lose).
import {
  START_GOLD, START_LIVES, TOTAL_WAVES, WAVES, WAVE_BONUS,
  PLOTS, ENEMIES,
} from './config.js';

export const SCREEN = {
  TITLE: 'title', BUILD: 'build', WAVE: 'wave',
  PAUSED: 'paused', WIN: 'win', LOSE: 'lose',
};

export function createGame() {
  return {
    screen: SCREEN.TITLE,
    prevScreen: SCREEN.BUILD,
    wave: 0,
    gold: START_GOLD,
    lives: START_LIVES,
    score: 0,
    kills: 0,
    leaked: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    floats: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveActive: false,
    time: 0,
    speed: 1,
    selectedKind: 'ember',
    selectedTower: null,
    hoverPlot: -1,
    mouse: { x: 0, y: 0 },
    message: '',
    messageTimer: 0,
    shake: 0,
    banner: '',
    bannerUntil: 0,
    waveTotal: 0,
    stats: { placed: 0, earned: 0 },
    rng: Math.random,
  };
}

export function resetGame(game) {
  const fresh = createGame();
  // A seeded rng is a property of the session, not the run: keep it, so
  // screenshot staging (?shot=&seed=) really replays the same way.
  const keepRng = game.rng;
  Object.keys(fresh).forEach(function (k) { game[k] = fresh[k]; });
  game.rng = keepRng;
}

export function startRun(game) {
  resetGame(game);
  game.screen = SCREEN.BUILD;
  game.message = 'Place lanterns, then press SPACE to start Wave 1.';
  game.messageTimer = 6;
}

export function buildWaveQueue(game) {
  const def = WAVES[game.wave];
  const queue = [];
  const kinds = ['moth', 'wisp', 'beetle', 'brute', 'boss'];
  const pools = {};
  kinds.forEach(function (k) { pools[k] = def[k] || 0; });
  let total = 0;
  kinds.forEach(function (k) { total += pools[k]; });
  while (total > 0) {
    kinds.forEach(function (k) {
      if (pools[k] > 0 && total > 0) {
        const run = Math.min(pools[k], k === 'brute' ? 1 : 3);
        for (let i = 0; i < run; i += 1) queue.push(k);
        pools[k] -= run; total -= run;
      }
    });
  }
  return queue;
}

export function startWave(game) {
  if (game.screen !== SCREEN.BUILD || game.wave >= TOTAL_WAVES) return false;
  game.spawnQueue = buildWaveQueue(game);
  game.waveTotal = game.spawnQueue.length;
  game.spawnTimer = 0.5;
  game.waveActive = true;
  game.screen = SCREEN.WAVE;
  game.selectedTower = null;
  game.banner = game.wave + 1 >= TOTAL_WAVES
    ? 'FINAL WAVE — THE MOTH QUEEN'
    : 'WAVE ' + (game.wave + 1);
  game.bannerUntil = game.time + 2.0;
  game.message = 'Wave ' + (game.wave + 1) + ' of ' + TOTAL_WAVES + ' - hold the garden!';
  game.messageTimer = 3;
  return true;
}

export function waveCleared(game) {
  const bonus = WAVE_BONUS(game.wave + 1);
  game.gold += bonus;
  game.score += bonus * 2;
  game.stats.earned += bonus;
  game.wave += 1;
  game.waveActive = false;
  if (game.wave >= TOTAL_WAVES) {
    game.screen = SCREEN.WIN;
    return 'win';
  }
  game.screen = SCREEN.BUILD;
  game.message = 'Wave cleared! Bonus +' + bonus + ' gold. Build, then start Wave ' + (game.wave + 1) + '.';
  game.messageTimer = 5;
  return 'clear';
}

export function loseLife(game, enemy) {
  const def = ENEMIES[enemy.kind];
  game.lives -= def.lives;
  game.leaked += 1;
  game.shake = 0.35;
  game.floats.push({ x: enemy.x, y: enemy.y - 20, text: '-' + def.lives + ' heart', life: 1.2, color: '#ff5d73' });
  if (game.lives <= 0) {
    game.lives = 0;
    game.screen = SCREEN.LOSE;
    return 'lose';
  }
  return 'leak';
}

export function awardKill(game, enemy) {
  const def = ENEMIES[enemy.kind];
  game.gold += def.gold;
  game.score += def.gold * 10;
  game.kills += 1;
  game.stats.earned += def.gold;
  game.floats.push({ x: enemy.x, y: enemy.y - 14, text: '+' + def.gold + ' gold', life: 0.9, color: '#ffd76b' });
}

export function setMessage(game, text, seconds) {
  game.message = text;
  game.messageTimer = seconds || 3;
}

export function towerAt(game, plotIndex) {
  for (let i = 0; i < game.towers.length; i += 1) {
    if (game.towers[i].plot === plotIndex) return game.towers[i];
  }
  return null;
}
