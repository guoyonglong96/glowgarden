// Glowgarden boot: canvas, game loop, screenshot staging (?shot=),
// and headless self-tests (?selftest=1, ?uitest=1) that report into
// the page so a script can read them without a human playing.
import { createGame, startRun, startWave, SCREEN } from "./state.js";
import { stepGame } from "./update.js";
import { draw } from "./render.js";
import { attachInput } from "./input.js";
import { stageShot, autoBuild } from "./shots.js";
import { tryPlace, tryUpgrade, trySell } from "./towers.js";
import { START_GOLD, TOWERS } from "./config.js";
import { mulberry32 } from "./rng.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const params = new URLSearchParams(location.search);
const game = createGame();
window.__game = game;
attachInput(canvas, game);

let frozen = false;
if (params.has("shot")) {
  const seed = Number(params.get("seed") || 7);
  stageShot(params.get("shot"), game, seed);
  frozen = true;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!frozen) {
    if (game.screen === SCREEN.WAVE || game.screen === SCREEN.BUILD) {
      stepGame(game, dt * game.speed);
    } else if (game.screen === SCREEN.TITLE || game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
      game.time += dt;
    }
  }
  draw(ctx, game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- Headless self-test: ?selftest=1 ---------------------------------
// Plays the real rules without a browser human: place, start a wave,
// fight it, upgrade, sell, and lose a run with no towers. Results go
// into #selftest and document.title for --dump-dom to read.
function runSelfTest() {
  const out = [];
  function check(name, ok, info) {
    out.push((ok ? "PASS " : "FAIL ") + name + (info !== undefined ? " (" + info + ")" : ""));
  }
  const g = createGame();
  startRun(g);
  check("start puts game in BUILD", g.screen === SCREEN.BUILD, g.screen);
  const placedEmber = tryPlace(g, 0);
  g.selectedKind = 'frost';
  const placed = placedEmber && tryPlace(g, 1);
  check("place ember+frost spends gold", placed && g.towers.length === 2 && g.gold === START_GOLD - 60 - 90, "gold=" + g.gold);
  g.selectedKind = "bloom";
  check("cannot afford bloom on the change", tryPlace(g, 2) === false);
  check("wave starts", startWave(g) === true && g.screen === SCREEN.WAVE);
  let guard = 0;
  while (g.screen === SCREEN.WAVE && guard < 60 * 120) { stepGame(g, 1 / 60); guard += 1; }
  check("wave 1 resolves (clear or leak)", g.screen !== SCREEN.WAVE, "screen=" + g.screen + " kills=" + g.kills + " lives=" + g.lives);
  check("towers killed something", g.kills > 0, "kills=" + g.kills);
  check("score and gold moved", g.score > 0 && g.stats.earned > 0, "score=" + g.score);
  g.gold = 500;
  const t0 = g.towers[0];
  check("upgrade to level 2", t0 && tryUpgrade(g, t0) === true && t0.level === 2, "level=" + (t0 && t0.level));
  const before = g.gold;
  check("sell removes tower and refunds", trySell(g, t0) === true && g.towers.length === 1 && g.gold > before, "gold=" + g.gold);
  check("no NaN positions", g.enemies.every(function (e) { return Number.isFinite(e.x) && Number.isFinite(e.y); }));
  // A run with no towers must eventually lose.
  const g2 = createGame();
  startRun(g2);
  let guard2 = 0;
  while (g2.screen !== SCREEN.LOSE && guard2 < 60 * 600) {
    if (g2.screen === SCREEN.BUILD) startWave(g2);
    stepGame(g2, 1 / 60);
    guard2 += 1;
  }
  check("no-tower run loses", g2.screen === SCREEN.LOSE, "screen=" + g2.screen + " wave=" + g2.wave);
  // A real-economy run must be able to win all 10 waves: no free gold,
  // no staged towers, just the starting purse and what the run earns.
  // Seeded, so the check answers the same way every run.
  const g3 = createGame();
  startRun(g3);
  g3.rng = mulberry32(7);
  // Open with embers on the best plots, then let the mixed autopilot
  // fill the rest: a real player mixes kinds, never one kind alone.
  const emberPlots = [3, 0, 5, 8, 10];
  let guard3 = 0;
  while (g3.screen !== SCREEN.WIN && g3.screen !== SCREEN.LOSE && guard3 < 60 * 900) {
    if (g3.screen === SCREEN.BUILD) {
      g3.selectedKind = 'ember';
      for (let i = 0; i < emberPlots.length; i += 1) {
        if (g3.gold < 60) break;
        tryPlace(g3, emberPlots[i]);
      }
      while (autoBuild(g3)) { /* spend the rest */ }
      startWave(g3);
    }
    stepGame(g3, 1 / 60);
    guard3 += 1;
  }
  check("real-economy run wins all 10 waves", g3.screen === SCREEN.WIN, "screen=" + g3.screen + " wave=" + g3.wave + " lives=" + g3.lives);
  // A mixed run must win too, played honestly: no free towers, no free
  // gold, just the starting purse and what the run earns, spending it
  // the way the mixed autopilot does. Seeded, so it answers the same
  // way every run.
  const g4 = createGame();
  g4.rng = mulberry32(11);
  startRun(g4);
  // Harmony-first: plant different kinds on the neighbour pairs, then
  // let the mixed autopilot fill the rest.
  const harmonySeq = [[0, 'ember'], [1, 'frost'], [3, 'ember'], [6, 'frost'], [5, 'bloom'], [7, 'frost'], [8, 'ember']];
  let guard4 = 0;
  while (g4.screen !== SCREEN.WIN && g4.screen !== SCREEN.LOSE && guard4 < 60 * 900) {
    if (g4.screen === SCREEN.BUILD) {
      for (let i = 0; i < harmonySeq.length; i += 1) {
        const s = harmonySeq[i];
        g4.selectedKind = s[1];
        if (g4.gold >= TOWERS[s[1]].cost) tryPlace(g4, s[0]);
      }
      while (autoBuild(g4)) { /* spend */ }
      startWave(g4);
    }
    stepGame(g4, 1 / 60);
    guard4 += 1;
  }
  check("harmony-first run wins all 10 waves", g4.screen === SCREEN.WIN, "screen=" + g4.screen + " wave=" + g4.wave + " lives=" + g4.lives);
  // A lone Frost lantern must be able to kill a wave-1 moth: a tower
  // that cannot kill the weakest enemy alone is a broken tower.
  const g5 = createGame();
  startRun(g5);
  g5.selectedKind = "frost";
  tryPlace(g5, 1);
  startWave(g5);
  let guard5 = 0;
  while (g5.screen === SCREEN.WAVE && guard5 < 60 * 120) { stepGame(g5, 1 / 60); guard5 += 1; }
  check("lone frost kills a wave-1 moth", g5.kills > 0, "kills=" + g5.kills);
  // A seeded rng survives startRun, so ?shot=&seed= replays the same frame.
  const g6 = createGame();
  const seeded = mulberry32(7);
  g6.rng = seeded;
  startRun(g6);
  check("startRun keeps a seeded rng", g6.rng === seeded);
  const passed = out.filter(function (l) { return l.indexOf("PASS") === 0; }).length;
  const text = "SELFTEST " + passed + "/" + out.length + "\n" + out.join("\n");
  const el = document.getElementById("selftest");
  if (el) el.textContent = text;
  document.title = "SELFTEST " + passed + "/" + out.length;
  window.__selftest = text;
}

// ---- Headless UI test: ?uitest=1 -------------------------------------
// Clicks the real canvas the way a player would: pick Ember, click a
// plot, press START WAVE, then simulates 10 seconds of play. Click
// positions are mapped through the canvas's own rectangle, so the test
// holds at any viewport size, and it asserts instead of just reporting.
function runUiTest() {
  const el = document.getElementById("selftest");
  const out = [];
  function check(name, ok, info) {
    out.push((ok ? "PASS " : "FAIL ") + name + (info !== undefined ? " (" + info + ")" : ""));
  }
  function clickAt(gx, gy) {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + (gx / 1280) * r.width;
    const cy = r.top + (gy / 720) * r.height;
    canvas.dispatchEvent(new MouseEvent("click", { clientX: cx, clientY: cy, bubbles: true }));
  }
  startRun(game);
  clickAt(143, 660); // Ember card
  clickAt(150, 240); // Plot 0
  check("click places ember on plot 0", game.towers.length === 1, "towers=" + game.towers.length);
  clickAt(1085, 32); // START WAVE button
  check("click starts wave 1", game.screen === SCREEN.WAVE, "screen=" + game.screen);
  for (let i = 0; i < 600; i += 1) stepGame(game, 1 / 60);
  check("10s of play kills moths", game.kills > 0, "kills=" + game.kills + " screen=" + game.screen);
  const passed = out.filter(function (l) { return l.indexOf("PASS") === 0; }).length;
  const text = "UITEST " + passed + "/" + out.length + "\n" + out.join("\n");
  if (el) el.textContent = text;
  document.title = "UITEST " + passed + "/" + out.length;
  window.__uitest = text;
}

if (params.has("selftest")) {
  try { runSelfTest(); } catch (err) { document.title = "SELFTEST ERROR " + err.message; }
} else if (params.has("uitest")) {
  try { runUiTest(); } catch (err) { document.title = "UITEST ERROR " + err.message; }
}
