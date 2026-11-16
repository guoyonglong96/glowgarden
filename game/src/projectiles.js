// Projectiles, particles and floating text: everything that flies,
// sparkles or pops up after a shot, a hit or a kill.
import { ENEMIES } from './config.js';
import { damageEnemy, burst } from './enemies.js';

export function updateProjectiles(game, dt) {
  for (let i = game.projectiles.length - 1; i >= 0; i -= 1) {
    const p = game.projectiles[i];
    if (!p.target || p.target.dead) { game.projectiles.splice(i, 1); continue; }
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step + 6) {
      hitTarget(game, p);
      game.projectiles.splice(i, 1);
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
  }
}

function hitTarget(game, p) {
  const target = p.target;
  if (p.splash > 0) {
    // Bloom petals hurt the target and everything near it.
    for (let i = 0; i < game.enemies.length; i += 1) {
      const e = game.enemies[i];
      if (e.dead) continue;
      const d = Math.hypot(e.x - target.x, e.y - target.y);
      if (d <= p.splash) damageEnemy(game, e, p.damage, p);
    }
    burst(game, target.x, target.y, '#ff7ad9', 10);
  } else {
    damageEnemy(game, target, p.damage, p);
    burst(game, target.x, target.y, p.color, 5);
  }
}

export function updateParticles(game, dt) {
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const pt = game.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { game.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96;
  }
  for (let i = game.floats.length - 1; i >= 0; i -= 1) {
    const f = game.floats[i];
    f.life -= dt;
    f.y -= 28 * dt;
    if (f.life <= 0) game.floats.splice(i, 1);
  }
}

export function updateFx(game, dt) {
  updateProjectiles(game, dt);
  updateParticles(game, dt);
  if (game.messageTimer > 0) game.messageTimer -= dt;
}
