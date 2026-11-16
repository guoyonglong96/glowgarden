// One simulation step: everything that moves the game forward by dt.
// main.js calls it every animation frame; shots.js calls it in a tight
// loop to stage deterministic screenshot scenes from real play.
import { SCREEN, startWave, waveCleared } from "./state.js";
import { updateSpawns, updateEnemies } from "./enemies.js";
import { updateTowers } from "./towers.js";
import { updateFx } from "./projectiles.js";
import { sfx } from "./audio.js";

export function stepGame(game, dt) {
  game.time += dt;
  if (game.screen === SCREEN.WAVE) {
    updateSpawns(game, dt);
    const outcome = updateEnemies(game, dt);
    updateTowers(game, dt);
    updateFx(game, dt);
    if (outcome === "lose") {
      sfx.lose();
      return;
    }
    if (game.waveActive && game.spawnQueue.length === 0 && game.enemies.length === 0) {
      const result = waveCleared(game);
      if (result === "win") sfx.win();
      else sfx.waveClear();
    }
  } else {
    updateFx(game, dt);
  }
}
