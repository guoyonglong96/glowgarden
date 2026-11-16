// Input: mouse and keyboard. Every click is hit-tested against the
// same rectangles render.js draws (uiLayout), so what you see is
// exactly what you can click.
import { SCREEN, startRun, startWave, setMessage } from "./state.js";
import { TOWERS, TOWER_ORDER, PLOTS } from "./config.js";
import { tryPlace, tryUpgrade, trySell } from "./towers.js";
import { uiLayout } from "./render.js";
import { ensureAudio, toggleMute, sfx } from "./audio.js";

function inside(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function plotAt(game, x, y) {
  for (let i = 0; i < PLOTS.length; i += 1) {
    const p = PLOTS[i];
    if (Math.hypot(x - p.x, y - p.y) <= 26) return i;
  }
  return -1;
}

export function attachInput(canvas, game) {
  function toGame(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * 1280,
      y: ((ev.clientY - rect.top) / rect.height) * 720,
    };
  }

  canvas.addEventListener("mousemove", function (ev) {
    const p = toGame(ev);
    game.mouse = p;
    game.hoverPlot = (game.screen === SCREEN.BUILD || game.screen === SCREEN.WAVE)
      ? plotAt(game, p.x, p.y)
      : -1;
  });

  canvas.addEventListener("click", function (ev) {
    ensureAudio();
    const p = toGame(ev);
    const ui = uiLayout(game);
    if (game.screen === SCREEN.TITLE) {
      if (inside(p.x, p.y, ui.titleBtn)) { startRun(game); sfx.waveStart(); }
      return;
    }
    if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
      if (inside(p.x, p.y, ui.againBtn)) { startRun(game); sfx.waveStart(); }
      return;
    }
    if (game.screen === SCREEN.PAUSED) {
      if (inside(p.x, p.y, ui.resumeBtn)) { game.screen = game.prevScreen; }
      return;
    }
    // HUD buttons work in BUILD and WAVE.
    if (inside(p.x, p.y, ui.soundBtn)) { toggleMute(); return; }
    if (inside(p.x, p.y, ui.speedBtn)) {
      game.speed = game.speed === 1 ? 2 : 1;
      return;
    }
    if (inside(p.x, p.y, ui.pauseBtn)) {
      game.prevScreen = game.screen;
      game.screen = SCREEN.PAUSED;
      return;
    }
    if (inside(p.x, p.y, ui.startBtn)) {
      if (game.screen === SCREEN.BUILD) {
        if (startWave(game)) sfx.waveStart();
        else sfx.error();
      }
      return;
    }
    // Tower panel buttons (when a tower is selected).
    if (game.selectedTower) {
      if (inside(p.x, p.y, ui.upgradeBtn)) { tryUpgrade(game, game.selectedTower); return; }
      if (inside(p.x, p.y, ui.sellBtn)) { trySell(game, game.selectedTower); return; }
      if (inside(p.x, p.y, ui.closeBtn)) { game.selectedTower = null; return; }
    }
    // Shop cards.
    for (let i = 0; i < ui.cards.length; i += 1) {
      if (inside(p.x, p.y, ui.cards[i])) {
        game.selectedKind = ui.cards[i].kind;
        game.selectedTower = null;
        setMessage(game, TOWERS[game.selectedKind].name + " selected: click a glowing plot to build.", 2.5);
        return;
      }
    }
    // Plots: build on an empty one, select a built one.
    const plot = plotAt(game, p.x, p.y);
    if (plot >= 0) {
      const existing = game.towers.find(function (t) { return t.plot === plot; });
      if (existing) {
        game.selectedTower = existing;
        return;
      }
      if (game.screen === SCREEN.BUILD || game.screen === SCREEN.WAVE) {
        tryPlace(game, plot);
      }
      return;
    }
    // Clicked empty ground: deselect.
    game.selectedTower = null;
  });

  window.addEventListener("keydown", function (ev) {
    if (ev.repeat) return;
    const k = ev.key;
    if (k === "1" || k === "2" || k === "3") {
      const kind = TOWER_ORDER[Number(k) - 1];
      if (kind) { game.selectedKind = kind; game.selectedTower = null; }
      return;
    }
    if (k === " " || k === "Enter") {
      ev.preventDefault();
      ensureAudio();
      if (game.screen === SCREEN.TITLE || game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
        startRun(game); sfx.waveStart();
      } else if (game.screen === SCREEN.BUILD) {
        if (startWave(game)) sfx.waveStart();
      } else if (game.screen === SCREEN.PAUSED) {
        game.screen = game.prevScreen;
      }
      return;
    }
    if (k === "p" || k === "P" || k === "Escape") {
      if (game.screen === SCREEN.WAVE || game.screen === SCREEN.BUILD) {
        game.prevScreen = game.screen;
        game.screen = SCREEN.PAUSED;
      } else if (game.screen === SCREEN.PAUSED) {
        game.screen = game.prevScreen;
      }
      return;
    }
    if (k === "f" || k === "F") {
      game.speed = game.speed === 1 ? 2 : 1;
      return;
    }
    if (k === "m" || k === "M") { toggleMute(); return; }
    if (k === "r" || k === "R") {
      if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE || game.screen === SCREEN.TITLE) {
        startRun(game);
      }
      return;
    }
  });
}
