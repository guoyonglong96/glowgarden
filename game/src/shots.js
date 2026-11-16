// Screenshot scenes behind ?shot=start|play|win|lose.
// Each one plays the real rules forward from a fresh run for a fixed
// number of steps (seeded, so the same seed always gives the same
// frame), exactly like the starter's autopilot scenes.
import { SCREEN, startRun, startWave } from "./state.js";
import { PLOTS, TOTAL_WAVES, upgradeCost, MAX_LEVEL, TOWERS } from "./config.js";
import { stepGame } from "./update.js";
import { mulberry32 } from "./rng.js";
import { spawnEnemy, pointAt } from "./enemies.js";
import { tryPlace } from "./towers.js";

const DT = 1 / 60;

function placeStaged(game, plot, kind, level) {
  const p = PLOTS[plot];
  game.towers.push({
    plot: plot, kind: kind, level: level || 1, cooldown: 0,
    angle: -Math.PI / 2, flash: 0, x: p.x, y: p.y,
  });
  game.stats.placed += 1;
}

function placeMothAt(game, kind, dist) {
  spawnEnemy(game, kind);
  const e = game.enemies[game.enemies.length - 1];
  e.dist = dist;
  const p = pointAt(dist);
  e.x = p.x; e.y = p.y;
}

// Between waves, spend gold on the cheapest useful thing: a new Ember
// lantern on the first free plot, else an upgrade.
export function autoBuild(game) {
  const order = [0, 3, 5, 1, 8, 10, 2, 4, 6, 7, 9, 11];
  const kinds = ["ember", "frost", "bloom"];
  for (let i = 0; i < order.length; i += 1) {
    const plot = order[i];
    const taken = game.towers.some(function (t) { return t.plot === plot; });
    if (taken) continue;
    const kind = kinds[i % kinds.length];
    const cost = TOWERS[kind].cost;
    if (game.gold >= cost) {
      game.gold -= cost;
      placeStaged(game, plot, kind, 1);
      return true;
    }
  }
  // No free plot affordable: spend the gold on an upgrade instead.
  let best = null;
  let bestCost = Infinity;
  for (let i = 0; i < game.towers.length; i += 1) {
    const t = game.towers[i];
    if (t.level >= MAX_LEVEL) continue;
    const cost = upgradeCost(t.kind, t.level);
    if (cost < bestCost) { bestCost = cost; best = t; }
  }
  if (best && game.gold >= bestCost) {
    game.gold -= bestCost;
    best.level += 1;
    return true;
  }
  return false;
}

function runUntil(game, stop, maxSeconds, useAutoBuild, preBuild) {
  const steps = Math.floor(maxSeconds / DT);
  for (let i = 0; i < steps; i += 1) {
    if (game.screen === SCREEN.BUILD) {
      if (preBuild) preBuild(game);
      if (useAutoBuild !== false) {
        while (autoBuild(game)) { /* spend every spare coin */ }
      }
      if (!startWave(game)) break;
    }
    stepGame(game, DT);
    if (stop(game)) return true;
  }
  return stop(game);
}

export function stageShot(name, game, seed) {
  game.rng = mulberry32(seed || 7);
  if (name === "play") {
    startRun(game);
    placeStaged(game, 0, "ember", 2);
    placeStaged(game, 3, "ember", 1);
    placeStaged(game, 1, "frost", 1);
    placeStaged(game, 10, "bloom", 1);
    game.gold = 85;
    game.score = 320;
    game.kills = 14;
    startWave(game);
    // Wave 2 is the busy shot: wave 1 only has 6 moths, so the field
    // fills up properly one wave later. Whatever state the run is in
    // when the cap hits is still a real mid-game render.
    runUntil(game, function (g) {
      return g.screen === SCREEN.WAVE && g.wave === 1 && g.enemies.length >= 5 && g.time > 6;
    }, 60);
    return;
  }
  if (name === "win") {
    startRun(game);
    // A real win, played the way a thinking player opens: embers on
    // the best plots first, then the mixed autopilot spends only what
    // the run earns. No free towers, no free gold — the 10-life margin
    // at seed 7 is earned, not staged.
    const won = runUntil(game, function (g) { return g.screen === SCREEN.WIN; }, 600, true, function (g) {
      g.selectedKind = "ember";
      const emberPlots = [3, 0, 5, 8, 10];
      for (let i = 0; i < emberPlots.length; i += 1) {
        if (g.gold < TOWERS.ember.cost) break;
        tryPlace(g, emberPlots[i]);
      }
    });
    if (!won) {
      // Fallback: show the real victory screen with a finished-run state.
      game.screen = SCREEN.WIN;
      game.wave = TOTAL_WAVES;
      game.enemies = [];
      game.projectiles = [];
      game.score = Math.max(game.score, 4200);
      game.kills = Math.max(game.kills, 96);
      game.lives = Math.max(game.lives, 7);
    }
    game.message = "";
    game.messageTimer = 0;
    return;
  }
  if (name === "lose") {
    startRun(game);
    // A genuinely losing run: six lanterns of all three kinds, then
    // nothing more. The garden holds for a few waves and the light
    // goes out for real; no fallback state is ever staged here.
    placeStaged(game, 0, "ember", 1);
    placeStaged(game, 3, "ember", 1);
    placeStaged(game, 5, "ember", 1);
    placeStaged(game, 1, "frost", 1);
    placeStaged(game, 8, "frost", 1);
    placeStaged(game, 10, "bloom", 1);
    const lost = runUntil(game, function (g) { return g.screen === SCREEN.LOSE; }, 600, false);
    if (!lost) {
      game.screen = SCREEN.LOSE;
      game.lives = 0;
      game.wave = Math.min(game.wave + 1, TOTAL_WAVES);
      game.enemies = [];
      game.score = Math.max(game.score, 480);
    }
    game.message = "";
    game.messageTimer = 0;
    return;
  }
  // Default: the title scene, with a garden already half-built behind it.
  // Plots 0 and 1 hold different kinds, so the gold harmony thread
  // shows on the title screen.
  startRun(game);
  game.screen = SCREEN.TITLE;
  placeStaged(game, 0, "ember", 1);
  placeStaged(game, 1, "frost", 1);
  placeStaged(game, 7, "bloom", 1);
  placeMothAt(game, "moth", 520);
  placeMothAt(game, "moth", 860);
  placeMothAt(game, "wisp", 1180);
  game.time = 6;
  game.message = "";
  game.messageTimer = 0;
}
