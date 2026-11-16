import { SCREEN, startRun, startWave, setMessage } from "./state.js";
import { TOWERS, TOWER_ORDER, PLOTS } from "./config.js";
import { tryPlace, tryUpgrade, trySell } from "./towers.js";
import { uiLayout } from "./render.js";
import { ensureAudio, toggleMute, sfx } from "./audio.js";

const inside = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const plotAt = (game, x, y) => {
  let found = -1;
  let i = 0;
  while (i < PLOTS.length && found < 0) {
    const p = PLOTS[i];
    if (Math.hypot(x - p.x, y - p.y) <= 26) found = i;
    i += 1;
  }
  return found;
};

const flipSpeed = (game) => {
  game.speed = 3 - game.speed;
};

const pauseGame = (game) => {
  game.prevScreen = game.screen;
  game.screen = SCREEN.PAUSED;
};

export function attachInput(canvas, game) {
  const toGame = (ev) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) / rect.width * 1280,
      y: (ev.clientY - rect.top) / rect.height * 720,
    };
  };

  canvas.addEventListener("mousemove", (ev) => {
    const p = toGame(ev);
    game.mouse = p;
    const inPlay = game.screen === SCREEN.BUILD || game.screen === SCREEN.WAVE;
    game.hoverPlot = inPlay ? plotAt(game, p.x, p.y) : -1;
  });

  canvas.addEventListener("click", (ev) => {
    ensureAudio();
    const p = toGame(ev);
    const ui = uiLayout(game);
    if (game.screen === SCREEN.TITLE) {
      if (inside(p.x, p.y, ui.titleBtn)) {
        startRun(game);
        sfx.waveStart();
      }
      return;
    }
    if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
      if (inside(p.x, p.y, ui.againBtn)) {
        startRun(game);
        sfx.waveStart();
      }
      return;
    }
    if (game.screen === SCREEN.PAUSED) {
      if (inside(p.x, p.y, ui.resumeBtn)) game.screen = game.prevScreen;
      return;
    }
    if (inside(p.x, p.y, ui.soundBtn)) {
      toggleMute();
      return;
    }
    if (inside(p.x, p.y, ui.speedBtn)) {
      flipSpeed(game);
      return;
    }
    if (inside(p.x, p.y, ui.pauseBtn)) {
      pauseGame(game);
      return;
    }
    if (inside(p.x, p.y, ui.startBtn)) {
      if (game.screen === SCREEN.BUILD) {
        if (startWave(game)) sfx.waveStart();
        else sfx.error();
      }
      return;
    }
    if (game.selectedTower !== null && game.selectedTower !== undefined) {
      if (inside(p.x, p.y, ui.upgradeBtn)) {
        tryUpgrade(game, game.selectedTower);
        return;
      }
      if (inside(p.x, p.y, ui.sellBtn)) {
        trySell(game, game.selectedTower);
        return;
      }
      if (inside(p.x, p.y, ui.closeBtn)) {
        game.selectedTower = null;
        return;
      }
    }
    let cardHit = false;
    ui.cards.forEach((card) => {
      if (cardHit === false && inside(p.x, p.y, card)) {
        game.selectedKind = card.kind;
        game.selectedTower = null;
        setMessage(game, `${TOWERS[game.selectedKind].name} selected: click a glowing plot to build.`, 2.5);
        cardHit = true;
      }
    });
    if (cardHit) return;
    const plot = plotAt(game, p.x, p.y);
    if (plot >= 0) {
      const existing = game.towers.find((t) => t.plot === plot);
      if (existing !== undefined) {
        game.selectedTower = existing;
        return;
      }
      if (game.screen === SCREEN.BUILD || game.screen === SCREEN.WAVE) tryPlace(game, plot);
      return;
    }
    game.selectedTower = null;
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;
    const k = ev.key;
    if (k === "1" || k === "2" || k === "3") {
      const kind = TOWER_ORDER[Number(k) - 1];
      if (kind !== undefined) {
        game.selectedKind = kind;
        game.selectedTower = null;
      }
      return;
    }
    if (k === " " || k === "Enter") {
      ev.preventDefault();
      ensureAudio();
      if (game.screen === SCREEN.TITLE || game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE) {
        startRun(game);
        sfx.waveStart();
      } else if (game.screen === SCREEN.BUILD) {
        if (startWave(game)) sfx.waveStart();
      } else if (game.screen === SCREEN.PAUSED) {
        game.screen = game.prevScreen;
      }
      return;
    }
    if (k === "p" || k === "P" || k === "Escape") {
      if (game.screen === SCREEN.WAVE || game.screen === SCREEN.BUILD) pauseGame(game);
      else if (game.screen === SCREEN.PAUSED) game.screen = game.prevScreen;
      return;
    }
    if (k === "f" || k === "F") {
      flipSpeed(game);
      return;
    }
    if (k === "m" || k === "M") {
      toggleMute();
      return;
    }
    if (k === "r" || k === "R") {
      if (game.screen === SCREEN.WIN || game.screen === SCREEN.LOSE || game.screen === SCREEN.TITLE) startRun(game);
    }
  });
}
