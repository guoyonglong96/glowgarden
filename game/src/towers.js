// Towers: building on plots, upgrading, selling, and picking a target
// and firing at it. Damage numbers come from config.js.
import { TOWERS, MAX_LEVEL, HARMONY_RADIUS, HARMONY_BONUS, upgradeCost, sellValue, PLOTS } from './config.js';
import { towerAt, setMessage } from './state.js';
import { sfx } from './audio.js';

export function towerStats(kind, level) {
  const base = TOWERS[kind];
  const mult = 1 + 0.6 * (level - 1);
  return {
    range: base.range + 10 * (level - 1),
    damage: Math.round(base.damage * mult),
    interval: base.interval,
    // Upgrades deepen each lantern's own trick, not just its damage:
    // frost chills harder and longer, bloom petals burst wider.
    slow: base.slow ? Math.min(0.75, base.slow + 0.05 * (level - 1)) : 0,
    slowTime: base.slowTime ? base.slowTime + 0.3 * (level - 1) : 0,
    splash: base.splash ? base.splash + 10 * (level - 1) : 0,
  };
}

// Harmony: a tower deals +HARMONY_BONUS damage while a tower of a
// different kind stands within HARMONY_RADIUS of it. Same-kind
// neighbours do not count, so a one-kind field earns nothing.
export function hasHarmony(game, tower) {
  for (let i = 0; i < game.towers.length; i += 1) {
    const other = game.towers[i];
    if (other === tower || other.kind === tower.kind) continue;
    if (Math.hypot(other.x - tower.x, other.y - tower.y) <= HARMONY_RADIUS) return true;
  }
  return false;
}

export function harmonyDamage(game, tower, damage) {
  return hasHarmony(game, tower)
    ? Math.round(damage * (1 + HARMONY_BONUS))
    : damage;
}

export function tryPlace(game, plotIndex) {
  const kind = game.selectedKind;
  const def = TOWERS[kind];
  if (towerAt(game, plotIndex)) return false;
  if (game.gold < def.cost) {
    setMessage(game, 'Not enough gold for a ' + def.name + ' (' + def.cost + ').', 2);
    sfx.error();
    return false;
  }
  game.gold -= def.cost;
  const plot = PLOTS[plotIndex];
  game.towers.push({
    plot: plotIndex, kind: kind, level: 1, cooldown: 0,
    angle: -Math.PI / 2, flash: 0, x: plot.x, y: plot.y,
  });
  game.stats.placed += 1;
  game.selectedTower = game.towers[game.towers.length - 1];
  setMessage(game, def.name + ' planted. Click it to upgrade or sell.', 2.5);
  sfx.place();
  return true;
}

export function tryUpgrade(game, tower) {
  if (!tower || tower.level >= MAX_LEVEL) return false;
  const cost = upgradeCost(tower.kind, tower.level);
  if (game.gold < cost) {
    setMessage(game, 'Upgrade needs ' + cost + ' gold.', 2);
    sfx.error();
    return false;
  }
  game.gold -= cost;
  tower.level += 1;
  setMessage(game, TOWERS[tower.kind].name + ' is now level ' + tower.level + '.', 2.5);
  sfx.upgrade();
  return true;
}

export function trySell(game, tower) {
  if (!tower) return false;
  const value = sellValue(tower.kind, tower.level);
  game.gold += value;
  game.towers.splice(game.towers.indexOf(tower), 1);
  game.selectedTower = null;
  setMessage(game, 'Sold for ' + value + ' gold.', 2);
  sfx.sell();
  return true;
}

// Furthest along the path inside range: the one closest to the Heart.
function pickTarget(game, tower, stats) {
  let best = null;
  for (let i = 0; i < game.enemies.length; i += 1) {
    const e = game.enemies[i];
    if (e.dead) continue;
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d <= stats.range && (best === null || e.dist > best.dist)) best = e;
  }
  return best;
}

export function updateTowers(game, dt) {
  for (let i = 0; i < game.towers.length; i += 1) {
    const tower = game.towers[i];
    const stats = towerStats(tower.kind, tower.level);
    tower.cooldown -= dt;
    if (tower.flash > 0) tower.flash -= dt;
    const target = pickTarget(game, tower, stats);
    if (!target) continue;
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    if (tower.cooldown > 0) continue;
    tower.cooldown = stats.interval;
    tower.flash = 0.12;
    const base = TOWERS[tower.kind];
    game.projectiles.push({
      x: tower.x, y: tower.y - 14, px: tower.x, py: tower.y - 14,
      target: target, kind: tower.kind,
      damage: harmonyDamage(game, tower, stats.damage), speed: base.projSpeed,
      splash: stats.splash, slow: stats.slow,
      slowTime: stats.slowTime, color: base.color,
    });
    sfx.shoot(tower.kind);
  }
}
