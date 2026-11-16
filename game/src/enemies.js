// Enemies: the path they walk, how they spawn, how they move, and what
// happens when one reaches the Heart Lantern.
import { PATH, ENEMIES, HP_GROWTH, WAVE_GAP } from './config.js';
import { loseLife, awardKill } from './state.js';
import { sfx } from './audio.js';

// Precomputed path segments with their lengths.
const SEGS = [];
let PATH_LEN = 0;
for (let i = 0; i < PATH.length - 1; i += 1) {
  const a = PATH[i], b = PATH[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  SEGS.push({ a: a, b: b, len: len, start: PATH_LEN });
  PATH_LEN += len;
}

export function pathLength() { return PATH_LEN; }

export function pointAt(dist) {
  const d = Math.max(0, Math.min(PATH_LEN, dist));
  for (let i = 0; i < SEGS.length; i += 1) {
    const s = SEGS[i];
    if (d <= s.start + s.len || i === SEGS.length - 1) {
      const t = s.len === 0 ? 0 : (d - s.start) / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
    }
  }
  return { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y };
}

export function spawnEnemy(game, kind) {
  const def = ENEMIES[kind];
  const hpScale = 1 + HP_GROWTH * game.wave;
  const hp = Math.round(def.hp * hpScale);
  const p = pointAt(0);
  game.enemies.push({
    kind: kind, hp: hp, maxHp: hp, dist: 0, x: p.x, y: p.y,
    slowUntil: 0, slowFactor: 1, wobble: game.rng() * Math.PI * 2,
    hitFlash: 0, dead: false,
  });
}

export function updateSpawns(game, dt) {
  if (!game.waveActive || game.spawnQueue.length === 0) return;
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    game.spawnTimer = WAVE_GAP;
    spawnEnemy(game, game.spawnQueue.shift());
  }
}

// Move every enemy along the path; returns 'lose' when the run ends.
export function updateEnemies(game, dt) {
  let result = null;
  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    const e = game.enemies[i];
    // Killed enemies are removed here: damageEnemy only marks them dead
    // so projectiles aimed at them can notice, and the wave-clear check
    // in stepGame needs the array to actually empty out.
    if (e.dead) { game.enemies.splice(i, 1); continue; }
    const slowed = game.time < e.slowUntil;
    const speed = ENEMIES[e.kind].speed * (slowed ? e.slowFactor : 1);
    e.dist += speed * dt;
    e.wobble += dt * 6;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.dist >= PATH_LEN) {
      e.dead = true;
      game.enemies.splice(i, 1);
      const outcome = loseLife(game, e);
      sfx.leak();
      burst(game, e.x, e.y, '#ff5d73', 14);
      if (outcome === 'lose') { result = 'lose'; }
      continue;
    }
    const p = pointAt(e.dist);
    // A gentle sideways wobble so moths feel alive, not on rails.
    const perp = e.kind === 'moth' ? Math.sin(e.wobble) * 4 : 0;
    e.x = p.x; e.y = p.y + perp;
  }
  return result;
}

export function burst(game, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = game.rng() * Math.PI * 2;
    const sp = 40 + game.rng() * 120;
    game.particles.push({
      x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + game.rng() * 0.4, maxLife: 0.9, color: color,
      size: 2 + game.rng() * 3,
    });
  }
}

export function damageEnemy(game, enemy, amount, source) {
  if (enemy.dead) return;
  enemy.hp -= amount;
  enemy.hitFlash = 0.12;
  if (source && source.slow) {
    enemy.slowUntil = game.time + source.slowTime;
    enemy.slowFactor = 1 - source.slow;
  }
  if (enemy.hp <= 0) {
    enemy.dead = true;
    awardKill(game, enemy);
    sfx.kill();
    burst(game, enemy.x, enemy.y, ENEMIES[enemy.kind].color, 16);
    burst(game, enemy.x, enemy.y, '#ffd76b', 6);
  }
}
